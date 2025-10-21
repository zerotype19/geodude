# Phase 1 - Staging QA Checklist

Quick smoke test and data sanity verification for Phase 1 deployment.

**Expected Time**: 15-30 minutes

---

## A. Database & Schema Verification

### 1. Check New Tables Exist

```bash
npx wrangler d1 execute optiview-db --command="
  SELECT name FROM sqlite_master 
  WHERE type='table' 
  AND name IN ('citations', 'mva_metrics')
" --remote
```

**Expected**: 2 rows returned (citations, mva_metrics)

### 2. Check New Columns on audit_pages

```bash
npx wrangler d1 execute optiview-db --command="
  PRAGMA table_info(audit_pages)
" --remote | grep -E "(is_cited|citation_count|assistants_citing|nearest_cited_url|recommendation_json)"
```

**Expected**: 5 new columns visible

### 3. Check New Columns on audit_page_analysis

```bash
npx wrangler d1 execute optiview-db --command="
  PRAGMA table_info(audit_page_analysis)
" --remote | grep -E "(lcp_ms|cls|fid_ms|page_type|ai_bot_access_json|render_parity)"
```

**Expected**: 6 new columns visible

### 4. Check audit_criteria Has Metadata

```bash
npx wrangler d1 execute optiview-db --command="
  SELECT id, category, eeat_pillar, impact_level 
  FROM audit_criteria 
  WHERE category IS NOT NULL 
  LIMIT 5
" --remote
```

**Expected**: At least 5 rows with category/eeat/impact populated

---

## B. Backfill & Data Population

### 1. Run Upsert Criteria (if not done)

```bash
curl -X POST https://api.optiview.ai/api/admin/upsert-criteria \
  -H "Cookie: ov_sess=YOUR_SESSION"
```

**Expected**: `{ "inserted": X, "updated": Y }` where X+Y = 21

### 2. Check Criteria Count

```bash
npx wrangler d1 execute optiview-db --command="
  SELECT COUNT(*) as total FROM audit_criteria
" --remote
```

**Expected**: total >= 21

### 3. Run Backfill Rollups (if not done)

```bash
curl -X POST https://api.optiview.ai/api/admin/backfill-rollups \
  -H "Cookie: ov_sess=YOUR_SESSION"
```

**Expected**: `{ "processed": X, "errors": 0 }`

### 4. Verify Rollups in Metadata

```bash
npx wrangler d1 execute optiview-db --command="
  SELECT metadata 
  FROM audit_page_analysis 
  WHERE metadata LIKE '%category_scores%' 
  LIMIT 1
" --remote
```

**Expected**: JSON with `category_scores` and `eeat_scores` objects

---

## C. Shadow Checks Verification

### 1. Run Test Audit

Pick a domain with FAQ content (e.g., `example.com/faq`):

```bash
curl -X POST https://api.optiview.ai/v1/audits \
  -H "Content-Type: application/json" \
  -H "Cookie: ov_sess=YOUR_SESSION" \
  -d '{
    "root_url": "https://example.com",
    "site_description": "Example site with FAQ"
  }'
```

Save audit ID from response.

### 2. Check Shadow Checks Present

```bash
curl "https://api.optiview.ai/v1/audits/:auditId/pages" \
  -H "Cookie: ov_sess=YOUR_SESSION" \
  | jq '.pages[0].scores.criteria | keys | map(select(. == "A12" or . == "C1" or . == "G11" or . == "G12"))'
```

**Expected**: `["A12", "C1", "G11", "G12"]` (or subset if some didn't trigger)

### 3. Check A12 (Q&A Scaffold) Evidence

```bash
curl "https://api.optiview.ai/v1/audits/:auditId/pages/:pageId" \
  -H "Cookie: ov_sess=YOUR_SESSION" \
  | jq '.metadata.qa_scaffold'
```

**Expected**: JSON with `faq_schema`, `dl_elements`, `question_headings`, etc.

### 4. Check C1 (Bot Access) Evidence

```bash
curl "https://api.optiview.ai/v1/audits/:auditId/pages/:pageId" \
  -H "Cookie: ov_sess=YOUR_SESSION" \
  | jq '.ai_bot_access_json'
```

**Expected**: JSON with `gptbot`, `claude`, `perplexity` objects

---

## D. Performance Metrics (CWV)

### 1. Check CWV Populated

```bash
curl "https://api.optiview.ai/v1/audits/:auditId/pages" \
  -H "Cookie: ov_sess=YOUR_SESSION" \
  | jq '.pages[] | select(.perf != null) | {url, lcp_ms, cls, fid_ms}' \
  | head -20
```

**Expected**: At least some pages have `lcp_ms`, `cls`, `fid_ms` values

### 2. Check Sampling Logic

```bash
curl "https://api.optiview.ai/v1/audits/:auditId/pages" \
  -H "Cookie: ov_sess=YOUR_SESSION" \
  | jq '[.pages[] | select(.perf != null)] | length'
```

**Expected**: 
- If total pages ≤ 50: should match total pages
- If total pages > 50: should be ~100

---

## E. Rollups Verification

### 1. Check Category Rollups Present

```bash
curl "https://api.optiview.ai/v1/audits/:auditId/pages" \
  -H "Cookie: ov_sess=YOUR_SESSION" \
  | jq '.pages[0].scores.categoryRollups'
```

**Expected**: Object with 6 categories and scores 0-100:

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

### 2. Check E-E-A-T Rollups Present

```bash
curl "https://api.optiview.ai/v1/audits/:auditId/pages" \
  -H "Cookie: ov_sess=YOUR_SESSION" \
  | jq '.pages[0].scores.eeatRollups'
```

**Expected**: Object with 5 pillars and scores 0-100

---

## F. Citations & Flags

### 1. Check Citations Migrated (if you had old data)

```bash
npx wrangler d1 execute optiview-db --command="
  SELECT COUNT(*) as total FROM citations
" --remote
```

**Expected**: Count > 0 if migration ran

### 2. Check Citation Aggregates

```bash
curl "https://api.optiview.ai/v1/audits/:auditId/pages" \
  -H "Cookie: ov_sess=YOUR_SESSION" \
  | jq '.pages[] | select(.is_cited == true) | {url, citation_count, assistants_citing}'
```

**Expected**: At least one page with `is_cited: true` and assistants array

---

## G. Environment Flags

### 1. Verify Feature Flags

Check worker environment:

```bash
npx wrangler secret list
```

**Expected to see**:
- `PHASE_NEXT_ENABLED` (should be "true")
- `PHASE_NEXT_SCORING` (should be "false" for shadow mode)
- `VECTORIZE_ENABLED` (should be "true" if using Vectorize)

### 2. Check Logs for Phase Next

```bash
npx wrangler tail --format=pretty | grep -i "phase"
```

**Watch for**:
- `[Phase Next] Computing shadow checks...`
- `[Phase Next] A12 score: X, C1 score: Y...`
- No errors related to Phase Next

---

## H. Vectorize (Optional)

### 1. Check Vectorize Index Exists

```bash
npx wrangler vectorize list
```

**Expected**: `optiview-page-embeddings` in list

### 2. Check Embeddings Populated

```bash
npx wrangler vectorize query optiview-page-embeddings \
  --vector="[0.1,0.2,...]" \
  --top-k=1
```

**Expected**: At least 1 result returned (if embeddings were created)

### 3. Check Logs for Embedding Operations

```bash
npx wrangler tail --format=pretty | grep -i "vectorize"
```

**Watch for**:
- `[Vectorize] Upserted embedding for...`
- No errors

---

## I. Composite Score Verification (Shadow Mode)

### 1. Compare Scores Before/After Phase Next

Run audit on same domain twice (once with `PHASE_NEXT_ENABLED=false`, once with `true`):

```bash
# Check composite scores
curl "https://api.optiview.ai/v1/audits/:auditId" \
  | jq '{aeo_score, geo_score, geo_adjusted_score}'
```

**Expected**: Scores should be **identical** while `PHASE_NEXT_SCORING=false`

### 2. Verify Preview Flags

Shadow checks should have `preview: true` in metadata:

```bash
curl "https://api.optiview.ai/v1/audits/:auditId/pages/:pageId" \
  | jq '.checks[] | select(.id == "A12" or .id == "C1") | {id, preview}'
```

**Expected**: `{ "id": "A12", "preview": true }`

---

## J. Quick Sanity Tests

### ✅ Pass Criteria

- [ ] New tables exist (citations, mva_metrics)
- [ ] New columns populated on audit_pages
- [ ] New columns populated on audit_page_analysis
- [ ] audit_criteria has 21+ rows with metadata
- [ ] Shadow checks (A12, C1, G11, G12) computed
- [ ] Category rollups present (6 categories)
- [ ] E-E-A-T rollups present (5 pillars)
- [ ] CWV metrics captured for sampled pages
- [ ] Composite scores unchanged (shadow mode)
- [ ] No Phase Next errors in logs
- [ ] Feature flags set correctly

### 🔴 Red Flags

- Migration errors in D1
- Missing rollups in API responses
- Shadow checks returning null/undefined
- Composite scores changed with shadow mode
- Vectorize errors (if enabled)
- Performance metrics all null

---

## K. Rollback Plan (If Needed)

If critical issues found:

```bash
# Disable Phase Next
npx wrangler secret put PHASE_NEXT_ENABLED  # Set to: false

# Redeploy worker
cd packages/audit-worker
npx wrangler deploy
```

---

## L. Sign-Off

Once all checks pass:

```
✅ Phase 1 Foundation verified on staging
✅ Ready for Phase 2 UI Refresh
✅ Ready for production deployment

Verified by: _____________
Date: _____________
```

---

**Next**: Proceed with Phase 2 UI implementation!

