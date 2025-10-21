# Phase 5 — Production Rollout Guide

**Status**: Ready for Production Deployment  
**Target**: Enable Phase Next scoring, MVA, and Learning Loop in production  
**Risk Level**: Low (non-destructive, feature-flagged)

---

## 🎯 Objectives

1. Enable scoring for all new criteria (A12, C1, G11, G12)
2. Activate MVA competitive visibility tracking
3. Enable Learning Loop recommendations
4. Schedule background jobs (cron)
5. Deploy to production with monitoring

---

## ✅ Pre-Flight Checklist

Before proceeding, verify:

- [ ] Phase 1 staging QA passed (PHASE_1_STAGING_QA.md)
- [ ] Phase 2 UI components tested
- [ ] Database migration applied successfully
- [ ] Backfill scripts tested on staging
- [ ] No critical bugs in logs
- [ ] Backup of production database taken

---

## 📋 Step-by-Step Rollout

### Step 1: Feature Flag Configuration

**Files to Update:**

#### Backend: `packages/audit-worker/wrangler.toml`

Add/update environment variables:

```toml
[vars]
PHASE_NEXT_ENABLED = "true"
PHASE_NEXT_SCORING = "true"      # <-- FLIP FROM false
MVA_ENABLED = "true"
LEARNING_LOOP_ENABLED = "true"
VECTORIZE_ENABLED = "true"
```

#### Frontend: `apps/app/.env.production`

```bash
VITE_PHASE_NEXT_ENABLED=true
VITE_API_BASE_URL=https://api.optiview.ai
```

**Commit:**
```bash
git add .
git commit -m "chore: enable Phase Next in production"
```

---

### Step 2: Database Migration (If Not Applied)

**Apply Migration:**

```bash
cd packages/audit-worker

# Staging first
npx wrangler d1 execute optiview-db \
  --file=./migrations/0013_phase_next_foundation.sql \
  --remote

# Verify tables exist
npx wrangler d1 execute optiview-db \
  --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('citations', 'mva_metrics')" \
  --remote
```

**Expected Output:**
```
citations
mva_metrics
```

**Then Production:**

```bash
npx wrangler d1 execute optiview-db \
  --file=./migrations/0013_phase_next_foundation.sql \
  --remote \
  --env production
```

---

### Step 3: Run One-Time Backfills

**Upsert Criteria:**

```bash
curl -X POST https://api.optiview.ai/api/admin/upsert-criteria \
  -H "Cookie: ov_sess=YOUR_ADMIN_SESSION"
```

**Expected Response:**
```json
{
  "inserted": 4,
  "updated": 17
}
```

**Backfill Rollups:**

```bash
curl -X POST https://api.optiview.ai/api/admin/backfill-rollups \
  -H "Cookie: ov_sess=YOUR_ADMIN_SESSION"
```

**Expected Response:**
```json
{
  "processed": 250,
  "errors": 0
}
```

**Migrate Citations:**

```bash
curl -X POST https://api.optiview.ai/api/admin/migrate-citations \
  -H "Cookie: ov_sess=YOUR_ADMIN_SESSION"
```

**Expected Response:**
```json
{
  "migrated": 1847,
  "skipped": 23,
  "errors": 0
}
```

---

### Step 4: Enable Cron Jobs

**Update wrangler.toml:**

```toml
# Add to packages/audit-worker/wrangler.toml

[triggers]
crons = [
  "0 2 * * *",  # Daily MVA computation at 2 AM UTC
  "0 3 * * *"   # Nightly recommendations at 3 AM UTC
]
```

**Deploy Worker with Cron:**

```bash
cd packages/audit-worker
npx wrangler deploy
```

**Verify Cron Triggers:**

```bash
npx wrangler deployments list
```

Look for "crons" in the deployment details.

---

### Step 5: Deploy Frontend & Backend

**Frontend (Cloudflare Pages):**

```bash
cd apps/app
npm run build

# Deploy via Cloudflare Pages (auto-deploy on push to main)
# Or manual:
npx wrangler pages deploy dist --project-name=geodude-app
```

**Backend (Worker):**

```bash
cd packages/audit-worker
npx wrangler deploy --env production
```

**Verify Deployments:**

```bash
# Check frontend
curl https://app.optiview.ai/score-guide

# Check API
curl https://api.optiview.ai/health
```

---

### Step 6: Post-Deploy Verification

#### 6.1 Check Flags Active

```bash
curl https://api.optiview.ai/api/config \
  | jq '{
    phase_next_enabled,
    phase_next_scoring,
    mva_enabled,
    learning_loop_enabled
  }'
```

**Expected:**
```json
{
  "phase_next_enabled": true,
  "phase_next_scoring": true,
  "mva_enabled": true,
  "learning_loop_enabled": true
}
```

#### 6.2 Run Test Audit

```bash
curl -X POST https://api.optiview.ai/v1/audits \
  -H "Content-Type: application/json" \
  -H "Cookie: ov_sess=YOUR_SESSION" \
  -d '{
    "root_url": "https://example.com",
    "site_description": "Example test site"
  }'
```

Wait for completion, then verify:

```bash
curl https://api.optiview.ai/v1/audits/:auditId/pages \
  | jq '.pages[0].scores | keys'
```

**Expected to include:** `["A1", "A2", ..., "A12", "C1", ..., "G11", "G12"]`

#### 6.3 Verify Category Rollups

```bash
curl https://api.optiview.ai/v1/audits/:auditId/pages \
  | jq '.pages[0].scores.categoryRollups'
```

**Expected:**
```json
{
  "Content & Clarity": 86,
  "Structure & Organization": 78,
  "Authority & Trust": 71,
  "Technical Foundations": 90,
  "Crawl & Discoverability": 84,
  "Experience & Performance": 68
}
```

#### 6.4 Verify E-E-A-T Rollups

```bash
curl https://api.optiview.ai/v1/audits/:auditId/pages \
  | jq '.pages[0].scores.eeatRollups'
```

**Expected:**
```json
{
  "Access & Indexability": 85,
  "Entities & Structure": 80,
  "Answer Fitness": 83,
  "Authority/Trust": 72,
  "Performance & Stability": 69
}
```

#### 6.5 Verify MVA (If Citations Present)

```bash
curl "https://api.optiview.ai/v1/audits/:auditId/citations/summary?window=30d"
```

**Expected:**
```json
{
  "mva_index": 62,
  "mentions_count": 48,
  "unique_urls": 19,
  "impression_estimate": 146,
  "competitors": [...]
}
```

#### 6.6 Verify Recommendations

```bash
curl https://api.optiview.ai/v1/pages/:pageId/recommendations
```

**Expected:**
```json
{
  "page_id": 123,
  "nearest_cited_url": "https://example.com/guide",
  "nearest_cited_by": ["chatgpt", "claude"],
  "recommendations": {
    "diffs": [...]
  }
}
```

---

### Step 7: Regression Testing

**Test Domains:**

1. **toyota.com** (automotive, large site)
2. **usaa.com** (financial services)
3. **cologuard.com** (healthcare/diagnostics)

**For Each Domain:**

- [ ] Run fresh audit
- [ ] Verify new checks (A12, C1, G11, G12) have scores
- [ ] Check category rollups render
- [ ] Verify no score regressions >10 points
- [ ] Check UI for errors (browser console)
- [ ] Verify Visibility tab (if citations exist)
- [ ] Check "Learn from Success" panel (uncited pages)

**Score Comparison:**

```bash
# Before Phase Next (save baseline)
echo "Baseline: AEO=85, GEO=78"

# After Phase Next (verify similar range)
curl https://api.optiview.ai/v1/audits/:newAuditId \
  | jq '{aeo_score, geo_score, geo_adjusted_score}'
```

**Expected:** Scores within ±5 points (shadow checks now active)

---

### Step 8: Manual Cron Trigger Tests

**Trigger MVA Cron:**

```bash
curl -X POST https://api.optiview.ai/api/admin/cron/mva \
  -H "Cookie: ov_sess=YOUR_ADMIN_SESSION"
```

**Check Logs:**

```bash
npx wrangler tail --format=pretty | grep "MVA"
```

**Expected:**
```
[MVA Cron] Starting daily MVA computation...
[MVA Cron] Computing MVA for 47 audits...
[MVA Cron] Daily MVA computation complete
```

**Trigger Recommendations Cron:**

```bash
curl -X POST https://api.optiview.ai/api/admin/cron/recommendations \
  -H "Cookie: ov_sess=YOUR_ADMIN_SESSION"
```

**Check Logs:**

```bash
npx wrangler tail --format=pretty | grep "Nearest Winner"
```

---

### Step 9: UI Health Checks

**Score Guide:**
- [ ] Visit https://app.optiview.ai/score-guide
- [ ] Business view shows 6 categories
- [ ] Technical view shows all 21 checks
- [ ] Preview badges visible on A12, C1, G11, G12
- [ ] View toggle persists on reload

**Audit Detail:**
- [ ] Visit https://app.optiview.ai/audits/:id
- [ ] Category rollups tab renders (default)
- [ ] E-E-A-T rollups tab renders
- [ ] Fix First panel shows prioritized items
- [ ] Citation chips appear on cited pages

**Visibility Tab:**
- [ ] Visit https://app.optiview.ai/audits/:id/visibility
- [ ] MVA index displays
- [ ] Top cited pages table loads
- [ ] Competitors table loads
- [ ] No console errors

**Page Detail:**
- [ ] Visit https://app.optiview.ai/audits/:id/pages/:pageId
- [ ] "Learn from Success" panel appears (uncited pages)
- [ ] Recommendations list displays
- [ ] Nearest cited page link works

---

### Step 10: Performance Monitoring

**Key Metrics:**

| Metric | Target | Command |
|--------|--------|---------|
| Audit Completion Time | < 2 min | Check audit duration in API |
| API Response Time | < 500ms | `curl -w "@curl-format.txt"` |
| Vectorize Writes | > 95% success | Check worker logs |
| MVA Cron Duration | < 5 min | Check cron logs |
| Recommendations Match Rate | > 80% | Query DB |

**Monitor for 72 Hours:**

```bash
# Day 1: Watch for errors
npx wrangler tail --format=pretty | grep -i "error"

# Day 2: Check cron execution
npx wrangler tail --format=pretty | grep -E "(MVA|Nearest Winner)"

# Day 3: Verify data quality
curl https://api.optiview.ai/api/admin/health
```

---

### Step 11: Rollback Plan (If Needed)

**If critical issues arise:**

1. **Disable Scoring:**
   ```bash
   npx wrangler secret put PHASE_NEXT_SCORING
   # Set to: false
   ```

2. **Disable Features:**
   ```bash
   npx wrangler secret put MVA_ENABLED
   # Set to: false
   
   npx wrangler secret put LEARNING_LOOP_ENABLED
   # Set to: false
   ```

3. **Redeploy Previous Version:**
   ```bash
   git revert HEAD
   npx wrangler deploy
   ```

4. **Monitor Recovery:**
   ```bash
   npx wrangler tail | grep "Phase Next"
   ```

---

## 📝 Release Notes

Create `PHASE_NEXT_RELEASE_NOTES.md`:

```markdown
# Optiview Phase Next – Release Notes

**Release Date**: October 21, 2025  
**Version**: 2.0.0  
**Status**: ✅ Production

---

## 🎉 Overview

Phase Next represents Optiview's largest upgrade to date, introducing business-friendly scoring categories, E-E-A-T alignment, AI assistant citation tracking, competitive visibility metrics (MVA), and self-learning recommendations powered by Vectorize.

---

## ✨ Key Features

### 1. Practical Categories & E-E-A-T Framework
- **6 Business Categories**: Content & Clarity, Structure & Organization, Authority & Trust, Technical Foundations, Crawl & Discoverability, Experience & Performance
- **5 E-E-A-T Pillars**: Access & Indexability, Entities & Structure, Answer Fitness, Authority/Trust, Performance & Stability
- **Weighted Rollups**: Category and pillar scores (0-100 scale)

### 2. New Shadow Mode Checks (Now Active)
- **A12**: Q&A Scaffold Detection (FAQ schema, DL elements)
- **C1**: AI Bot Access Status (GPTBot, Claude-Web, Perplexity)
- **G11**: Entity Graph Completeness (orphan detection, hub analysis)
- **G12**: Topic Depth & Semantic Coverage

### 3. AI Citation Tracking & MVA
- **Unified Citations**: ChatGPT, Claude, Perplexity, Brave
- **MVA Index**: Competitive visibility score (0-100)
- **Competitor Analysis**: Top 10 competitors with share %
- **Impression Estimates**: Weighted by assistant reach

### 4. Learning Loop (Vectorize-Powered)
- **Nearest Winner Matching**: Find similar cited pages
- **Actionable Recommendations**: Specific fixes per uncited page
- **8 Comparison Criteria**: A1, A3, A5, A11, A12, G10, G11, G12
- **"Learn from Success" Panel**: Page-level guidance

### 5. Enhanced UI
- **Score Guide**: Business & Technical views with toggle
- **Visibility Tab**: MVA metrics, citations, competitors
- **Fix First Panel**: Prioritized actions by impact
- **Citation Chips**: Assistant badges on cited pages
- **Preview Badges**: Visual distinction for new checks

---

## 🚀 What's Changed

### Backend
- 4 new criteria now affect composite scores
- Citations auto-join to pages after ingestion
- MVA computed daily via cron (2 AM UTC)
- Recommendations generated nightly (3 AM UTC)
- Vectorize embeddings for all pages

### Frontend
- Score Guide redesigned with categories
- Audit Detail with rollup visualizations
- New Visibility tab for citations/MVA
- Page Detail with "Learn from Success"
- Dark mode support throughout

### Performance
- Crawl time: < 2 minutes for 50-page site
- API response: < 500ms average
- Vectorize write success: > 95%
- MVA cron completion: < 5 minutes

---

## 📊 Metrics & Impact

- **21 Total Checks**: 17 existing + 4 new
- **6 Categories**: Business-friendly groupings
- **5 E-E-A-T Pillars**: Technical foundation
- **3 Background Jobs**: Citations, MVA, Recommendations
- **768-Dim Embeddings**: Semantic similarity matching

---

## 🎯 Flags Enabled

```bash
PHASE_NEXT_ENABLED=true
PHASE_NEXT_SCORING=true       # New checks affect scores
MVA_ENABLED=true
LEARNING_LOOP_ENABLED=true
VECTORIZE_ENABLED=true
```

---

## 🔄 Migration & Compatibility

- **Non-Destructive**: All changes are additive
- **Backward Compatible**: Existing audits unchanged
- **Backfill Complete**: Historical data enriched
- **No Breaking Changes**: All APIs maintain compatibility

---

## 📋 Recommended Next Steps

1. **Monitor for 72 hours**: Watch citations flow and cron jobs
2. **Capture dashboards**: Before/after for client showcase
3. **Export MVA trends**: Weekly competitive analysis
4. **Gather feedback**: User impressions of new UI
5. **Iterate on prompts**: Refine LLM queries based on results

---

## 🆘 Support & Troubleshooting

**If you encounter issues:**

1. Check worker logs: `npx wrangler tail`
2. Verify feature flags: `curl /api/config`
3. Review staging QA: `PHASE_1_STAGING_QA.md`
4. Contact: admin@optiview.ai

**Rollback Instructions:**
See `PHASE_5_PRODUCTION_ROLLOUT.md` Step 11

---

## 🙏 Acknowledgments

Phase Next represents 4 phases of development:
- Phase 1: Foundation (database, checks, vectorize)
- Phase 2: UI Refresh (categories, rollups, visualizations)
- Phase 3: Citations & MVA (competitive visibility)
- Phase 4: Learning Loop (recommendations)

Total: 33 files, ~7,900 lines of code

---

**Status**: ✅ Live in Production  
**Version**: 2.0.0  
**Date**: October 21, 2025
```

---

## 🎯 Success Criteria

### Day 1 (Immediate)
- [ ] No production errors in logs
- [ ] New audits complete successfully
- [ ] UI loads without errors
- [ ] Scores look reasonable

### Day 3 (Short-term)
- [ ] MVA cron runs successfully
- [ ] Recommendations cron runs successfully
- [ ] Citations data flows correctly
- [ ] User feedback positive

### Week 1 (Medium-term)
- [ ] 100+ audits with new checks
- [ ] MVA trends visible
- [ ] Recommendations helpful
- [ ] No performance degradation

---

## 📊 Post-Launch Monitoring

**Daily (First Week):**
```bash
# Check for errors
npx wrangler tail | grep -i "error" | tail -50

# Verify cron execution
npx wrangler tail | grep -E "(MVA|Nearest Winner|Citations Join)"

# Check health endpoint
curl https://api.optiview.ai/api/admin/health | jq '.'
```

**Weekly:**
- Export MVA trends for top 10 projects
- Review recommendation match rates
- Check Vectorize index health
- Monitor API response times

**Monthly:**
- User feedback survey
- Score accuracy validation
- Competitive analysis review
- Feature usage analytics

---

## 🎉 Launch Announcement

**Internal:**

> 🚀 **Optiview Phase Next is LIVE!**
> 
> We've just deployed the largest upgrade to Optiview ever:
> - 6 practical categories for business users
> - 5 E-E-A-T pillars for technical SEO
> - AI citation tracking across ChatGPT, Claude, Perplexity
> - Competitive visibility with MVA index
> - Self-learning recommendations via Vectorize
> 
> Check out the new Score Guide, Visibility tab, and "Learn from Success" panel!
> 
> Questions? See PHASE_NEXT_RELEASE_NOTES.md

**External (Blog/Social):**

> Introducing Optiview 2.0: Business-friendly AEO/GEO scoring, live AI citations, and competitive visibility tracking. Now with self-learning recommendations to help you rank in ChatGPT, Claude, and Perplexity. [Learn more →]

---

## ✅ Final Checklist

Before marking complete:

- [ ] All flags enabled in production
- [ ] Database migration applied
- [ ] Backfill scripts executed
- [ ] Cron jobs configured and tested
- [ ] Frontend and backend deployed
- [ ] Post-deploy verification passed
- [ ] Regression testing completed
- [ ] Performance monitoring active
- [ ] Release notes published
- [ ] Team notified
- [ ] Documentation updated

---

**Phase 5 Status: Ready for Production Deployment**

**Commit Message:**
```bash
git commit -m "release: phase-next-production v2.0.0

- Enable PHASE_NEXT_SCORING=true
- Activate MVA and Learning Loop
- Configure cron jobs (MVA, recommendations)
- Deploy complete Phase Next system to production

Phases completed: 1-5
Files: 33
LOC: ~7,900
New checks: A12, C1, G11, G12 (active)
New features: MVA, Recommendations, Visibility tab"
```

---

🎉 **Optiview Phase Next is ready for production!**

