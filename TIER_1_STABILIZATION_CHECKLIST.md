# Tier 1: Stabilization Checklist (Days 1-5)

**Status**: In Progress  
**Start Date**: October 21, 2025  
**Goal**: Validate Phase Next v2.0.0 stability before new features

---

## 📋 Day 1 (0-24h): System Health

### ✅ Deployment Verification
- [x] Worker deployed (v22ec9f33)
- [x] Frontend deployed
- [x] Database migrated (3 tables, 20+ columns)
- [x] All flags enabled
- [ ] No rollback triggers observed

### 🧪 Test Audits (Run 3-5 domains)

**Small Sites (< 50 pages):**
- [ ] example.com
- [ ] small-business.com
  
**Medium Sites (50-200 pages):**
- [ ] mid-sized-site.com

**Large Sites (200+ pages):**
- [ ] toyota.com
- [ ] usaa.com

**For Each Audit, Verify:**
- [ ] Completes successfully (< 2 min expected)
- [ ] New checks present (A12, C1, G11, G12)
- [ ] Category rollups calculated (non-zero)
- [ ] E-E-A-T rollups calculated (non-zero)
- [ ] No console errors in UI
- [ ] Scores look reasonable (no huge regressions)

### 📊 Database Population Check

```bash
# Run after test audits
cd packages/audit-worker

# Check audit_criteria (should have 21 rows after backfill)
npx wrangler d1 execute optiview --remote \
  --command="SELECT COUNT(*) as count FROM audit_criteria"

# Check citations table (may still be 0)
npx wrangler d1 execute optiview --remote \
  --command="SELECT COUNT(*) as count FROM citations"

# Check mva_metrics (should populate after 2 AM cron)
npx wrangler d1 execute optiview --remote \
  --command="SELECT COUNT(*) as count FROM mva_metrics"

# Verify new columns exist and populate
npx wrangler d1 execute optiview --remote \
  --command="SELECT url, is_cited, citation_count FROM audit_pages LIMIT 5"
```

**Expected Results:**
- [ ] `audit_criteria`: 0 (will populate after backfill script)
- [ ] `citations`: 0-N (depends on citation runs)
- [ ] `mva_metrics`: 0 (will populate after 2 AM cron)
- [ ] `audit_pages`: New columns present but may be NULL/0

### 🔍 Log Monitoring

```bash
# Watch for errors
npx wrangler tail --format=pretty | grep -i "error"

# Watch for warnings
npx wrangler tail --format=pretty | grep -i "warning"

# Watch new checks
npx wrangler tail --format=pretty | grep -E "(A12|C1|G11|G12)"

# Watch Vectorize
npx wrangler tail --format=pretty | grep -i "vectorize"
```

**Look For:**
- [ ] No 500 errors
- [ ] No unhandled exceptions
- [ ] Vectorize writes succeeding
- [ ] New checks executing
- [ ] No timeout issues

---

## 📋 Day 2 (24-48h): Cron Validation

### ⏰ Cron Execution Verification

**2 AM UTC - MVA Computation:**
```bash
# Check logs around 2 AM
npx wrangler tail --format=pretty | grep "MVA"

# Expected output:
# [MVA Cron] Starting daily MVA computation...
# [MVA Cron] Computing MVA for N audits...
# [MVA Cron] Daily MVA computation complete
```

- [ ] MVA cron ran successfully
- [ ] No errors in logs
- [ ] Completed in < 5 minutes
- [ ] `mva_metrics` table populated

**Verify MVA Data:**
```bash
npx wrangler d1 execute optiview --remote \
  --command="SELECT COUNT(*) FROM mva_metrics WHERE computed_at >= datetime('now', '-24 hours')"

# Should return rows if cron ran
```

**3 AM UTC - Recommendations (Learning Loop):**
```bash
# Check logs around 3 AM
npx wrangler tail --format=pretty | grep "Nearest Winner"

# Expected output:
# [Nearest Winner] Processing audit X...
# [Nearest Winner] Found N uncited pages
# [Nearest Winner] Generated M recommendations
```

- [ ] Recommendations cron ran successfully
- [ ] No errors in logs
- [ ] Completed in < 10 minutes
- [ ] `audit_pages.recommendation_json` populated

**Verify Recommendations Data:**
```bash
npx wrangler d1 execute optiview --remote \
  --command="SELECT COUNT(*) FROM audit_pages WHERE recommendation_json IS NOT NULL"

# Should return > 0 if uncited pages exist
```

### 🎯 Spot-Check 3 Domains

**Domain 1: Toyota.com**
- [ ] Run fresh audit
- [ ] Verify A12, C1, G11, G12 scores
- [ ] Check category rollups match expectations
- [ ] Compare to previous audit (if exists)
- [ ] Document any score differences

**Domain 2: USAA.com**
- [ ] Run fresh audit
- [ ] Verify financial services compliance
- [ ] Check authority/trust scores high
- [ ] Validate schema detection (A5)
- [ ] Document findings

**Domain 3: Cologuard.com**
- [ ] Run fresh audit
- [ ] Verify healthcare/YMYL handling
- [ ] Check A3 (author attribution) scores
- [ ] Validate E-E-A-T pillars
- [ ] Document compliance indicators

### 📊 Scoring Validation

For each domain, check:
- [ ] AEO score reasonable (60-95 typical)
- [ ] GEO score reasonable (55-90 typical)
- [ ] No category at 0 (unless intentional)
- [ ] E-E-A-T pillars balanced
- [ ] New checks contributing appropriately

**Compare Before/After:**
```bash
# If you have pre-Phase Next audit IDs:
# Document score differences for reporting

Domain        | Pre-PN | Post-PN | Delta | Notes
--------------|--------|---------|-------|------
toyota.com    | 85     | 83      | -2    | A12 penalty for no Q&A
usaa.com      | 78     | 81      | +3    | C1 boost for bot access
cologuard.com | 82     | 80      | -2    | G12 depth opportunity
```

### 🔄 API Endpoint Testing

**Test New Endpoints:**
```bash
# Category rollups
curl https://api.optiview.ai/v1/audits/:auditId/pages \
  | jq '.pages[0].scores.categoryRollups'

# E-E-A-T rollups
curl https://api.optiview.ai/v1/audits/:auditId/pages \
  | jq '.pages[0].scores.eeatRollups'

# MVA summary (if data exists)
curl "https://api.optiview.ai/v1/audits/:auditId/citations/summary?window=30d" \
  | jq '.'

# Recommendations (if uncited pages exist)
curl https://api.optiview.ai/v1/pages/:pageId/recommendations \
  | jq '.recommendations.diffs'
```

**Expected:**
- [ ] All endpoints return 200
- [ ] Response time < 500ms
- [ ] Data structures match contracts
- [ ] No CORS errors
- [ ] Proper error handling

---

## 📋 Day 3 (48-72h): Data Quality

### 📈 Performance Metrics

**Audit Completion Times:**
- [ ] < 50 pages: < 30 seconds
- [ ] 50-200 pages: < 90 seconds
- [ ] 200+ pages: < 3 minutes

**API Response Times:**
- [ ] GET requests: < 200ms (p95)
- [ ] POST audit: < 500ms (p95)
- [ ] Export (when added): < 5s

**Worker Metrics (Cloudflare Dashboard):**
- [ ] CPU time < 10ms average
- [ ] Memory < 50MB average
- [ ] Request success rate > 99%
- [ ] No errors logged

### 🧮 Citation Validation

**If Citation Data Exists:**
```bash
# Check citation aggregation
npx wrangler d1 execute optiview --remote \
  --command="
    SELECT 
      a.root_url,
      COUNT(c.id) as citation_count,
      COUNT(DISTINCT c.assistant) as assistants
    FROM audits a
    JOIN citations c ON a.id = c.audit_id
    GROUP BY a.id
    LIMIT 10
  "
```

**Verify:**
- [ ] Citations linked to correct audits
- [ ] Assistant names normalized
- [ ] URLs normalized correctly
- [ ] `audit_pages` flags updated
- [ ] `assistants_citing` populated

**Match Rate:**
- [ ] > 95% of citations match to audit_pages
- [ ] < 5% unmatched (acceptable for external links)

### 🎨 UI Validation

**Score Guide:**
- [ ] Visit https://app.optiview.ai/score-guide
- [ ] Toggle Business/Technical works
- [ ] 6 categories visible
- [ ] Preview badges on A12, C1, G11, G12
- [ ] "Why it matters" text displays
- [ ] Responsive on mobile

**Audit Detail:**
- [ ] Category rollups tab (default)
- [ ] E-E-A-T rollups tab
- [ ] Fix First panel visible
- [ ] Citation chips (if data exists)
- [ ] Filters work ("Cited only", etc.)
- [ ] No console errors

**Page Detail:**
- [ ] Category scores display
- [ ] Criteria cards show pass/fail
- [ ] Preview badges on new checks
- [ ] "Learn from Success" panel (if uncited)
- [ ] Recommendations actionable

### 📊 Capture Benchmarks

**Take Screenshots:**
1. Score Guide (Business view)
2. Category rollups for 3 domains
3. E-E-A-T pillars visualization
4. Fix First panel
5. Citation chips (if available)
6. "Learn from Success" panel

**Save for Later:**
- Before/after score comparisons
- MVA trends (when available)
- User testimonials
- Performance metrics

---

## 📋 Day 4-5: Feedback & Iteration

### 👥 User Feedback

**Questions to Ask:**
1. Is the Score Guide clearer?
2. Are category rollups helpful?
3. Do recommendations make sense?
4. Any confusion or errors?
5. What would you like to see next?

**Channels:**
- [ ] Email 5 key users
- [ ] Slack announcement
- [ ] In-app survey (if available)
- [ ] Direct interviews (2-3 users)

### 📝 Document Issues

**Create Issues for:**
- [ ] Any bugs found
- [ ] Performance issues
- [ ] UI/UX improvements
- [ ] Documentation gaps
- [ ] Feature requests

**Priority:**
- P0: Blocks usage (fix immediately)
- P1: Major impact (fix this week)
- P2: Minor impact (fix next sprint)
- P3: Nice to have (backlog)

### 🔄 Iteration Plan

**Hot Fixes (If Needed):**
- [ ] Critical bugs (P0)
- [ ] Data accuracy issues
- [ ] Performance problems
- [ ] Security concerns

**Quick Wins:**
- [ ] Remove preview badges (if stable)
- [ ] Adjust category weights (if needed)
- [ ] Improve copy/labels
- [ ] Fix minor UI bugs

---

## ✅ Stabilization Complete Criteria

Mark as complete when ALL of the following are true:

### Technical
- [ ] 72 hours of stable operation
- [ ] Zero P0/P1 issues outstanding
- [ ] All cron jobs executing successfully
- [ ] Performance metrics within targets
- [ ] No data corruption or loss

### Data Quality
- [ ] New checks (A12, C1, G11, G12) populating correctly
- [ ] Category rollups calculating accurately
- [ ] E-E-A-T scores reasonable
- [ ] Citations matching > 95%
- [ ] Recommendations relevant

### User Experience
- [ ] Score Guide usable
- [ ] Audit Detail loads < 2s
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Positive user feedback

### Business
- [ ] 10+ audits completed successfully
- [ ] 3+ users actively using new features
- [ ] No complaints or escalations
- [ ] Documentation adequate
- [ ] Team trained

---

## 🚦 Go/No-Go Decision (End of Day 5)

### ✅ GO if:
- All criteria above met
- Team confident in stability
- No major issues unresolved
- User feedback positive
- Ready for Tier 2

### ⚠️ PAUSE if:
- Any P0 issues outstanding
- Performance degraded
- User confusion/complaints
- Data quality concerns
- Need more monitoring time

### 🛑 ROLLBACK if:
- Critical production issues
- Data corruption detected
- Security vulnerability
- System instability
- User demands reverting

---

## 📞 Escalation

**For Issues:**
- P0: Immediate Slack ping + rollback consideration
- P1: Slack thread + track in issues
- P2/P3: Create GitHub issue

**Support:**
- Slack: #phase-next-production
- Email: support@optiview.ai
- Logs: `npx wrangler tail`

---

## 🎯 Next Steps After Stabilization

Once Tier 1 complete:
1. ✅ Move to Tier 2 (Activation)
2. ✅ Remove preview badges
3. ✅ Run backfill scripts
4. ✅ Publish internal announcement
5. ✅ Export first MVA trends
6. ✅ Plan Phase 6 kickoff

---

**Status**: In Progress  
**Last Updated**: October 21, 2025  
**Owner**: Platform Team

