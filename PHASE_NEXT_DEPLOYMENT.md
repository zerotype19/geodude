# Phase Next - Deployment & Testing Guide

## ✅ Phase 1 Complete!

All foundation components have been implemented. This guide walks through deployment and verification.

---

## 1. Database Migration

### Run Migration

```bash
# Navigate to worker directory
cd /Users/kevinmcgovern/geodude/geodude/packages/audit-worker

# Apply migration to D1
npx wrangler d1 execute optiview-db --file=./migrations/0013_phase_next_foundation.sql --local

# For production
npx wrangler d1 execute optiview-db --file=./migrations/0013_phase_next_foundation.sql
```

### Verify Tables

```bash
# Check new columns exist
npx wrangler d1 execute optiview-db --command="PRAGMA table_info(audit_criteria);" --local

# Check new tables exist
npx wrangler d1 execute optiview-db --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('citations', 'mva_metrics');" --local
```

---

## 2. Backfill Scripts

### Upsert Criteria

Create a worker endpoint to run the upsert:

```typescript
// In src/index.ts, add admin endpoint:

app.post('/api/admin/upsert-criteria', async (c) => {
  const { upsertCriteria } = await import('./scripts/upsert-criteria');
  const result = await upsertCriteria(c.env.DB);
  return c.json(result);
});
```

Then call:

```bash
curl -X POST https://api.optiview.ai/api/admin/upsert-criteria
```

### Backfill Rollups

```bash
curl -X POST https://api.optiview.ai/api/admin/backfill-rollups
```

### Migrate Citations

```bash
curl -X POST https://api.optiview.ai/api/admin/migrate-citations
```

---

## 3. Vectorize Setup

### Create Index

```bash
cd /Users/kevinmcgovern/geodude/geodude/packages/audit-worker

npx wrangler vectorize create optiview-page-embeddings \
  --dimensions=768 \
  --metric=cosine
```

### Add to wrangler.toml

```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "optiview-page-embeddings"
```

### Deploy Worker

```bash
npx wrangler deploy
```

---

## 4. Environment Variables

Add these to your worker:

```bash
# Feature flags
npx wrangler secret put PHASE_NEXT_ENABLED  # Set to: true
npx wrangler secret put PHASE_NEXT_SCORING  # Set to: false (shadow mode)
npx wrangler secret put VECTORIZE_ENABLED   # Set to: true
```

---

## 5. Verification Tests

### Test A12 (Q&A Scaffold)

Run audit on a page with FAQ schema:

```bash
curl "https://api.optiview.ai/api/audits" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"root_url": "https://example.com/faq", "site_description": "FAQ page"}'
```

Check response for `A12` in checks_json with score 2-3.

### Test C1 (AI Bot Access)

Run audit and check `ai_bot_access_json`:

```bash
curl "https://api.optiview.ai/api/audits/:id/pages" | jq '.pages[0].ai_bot_access_json'
```

Expected output:

```json
{
  "gptbot": {"allowed": true, "rule": "allow", "source": "robots.txt"},
  "claude": {"allowed": true, "rule": "no-rule", "source": "inferred"},
  "perplexity": {"allowed": true, "rule": "no-rule", "source": "inferred"}
}
```

### Test G11 (Entity Graph)

Run audit on a site with About page:

```bash
curl "https://api.optiview.ai/api/audits/:id/pages" | jq '[.pages[] | select(.url | contains("about"))]'
```

Check for `graph_hub: true` in metadata.

### Test G12 (Topic Depth)

Run audit on a content-rich page:

```bash
curl "https://api.optiview.ai/api/audits/:id/pages/:pageId" | jq '.metadata.topic_depth'
```

Expected output:

```json
{
  "top_terms": ["insurance", "coverage", "premium", ...],
  "question_patterns": ["what", "how", "cost"],
  "coverage_ratio": 0.76
}
```

### Test Performance Metrics

Check for CWV data:

```bash
curl "https://api.optiview.ai/api/audits/:id/pages" | jq '.pages[0] | {lcp_ms, cls, fid_ms}'
```

Expected output:

```json
{
  "lcp_ms": 2200,
  "cls": 0.04,
  "fid_ms": 18
}
```

### Test Vectorize Embeddings

Check Vectorize index has entries:

```bash
npx wrangler vectorize query optiview-page-embeddings \
  --vector="[0.1, 0.2, ...]" \
  --top-k=5
```

Or check logs for `[Vectorize] Upserted embedding for ...`

---

## 6. Category & E-E-A-T Rollups

### Test API Response

```bash
curl "https://api.optiview.ai/api/audits/:id/pages" | jq '.pages[0].scores'
```

Expected structure:

```json
{
  "criteria": {
    "A1": 0.9,
    "A12": 0.0,
    "G11": 0.7,
    "G12": 0.8,
    "C1": 1.0
  },
  "categoryRollups": {
    "Content & Clarity": 86,
    "Structure & Organization": 78,
    "Authority & Trust": 71,
    "Technical Foundations": 90,
    "Crawl & Discoverability": 84,
    "Experience & Performance": 68
  },
  "eeatRollups": {
    "Access & Indexability": 85,
    "Entities & Structure": 80,
    "Answer Fitness": 83,
    "Authority/Trust": 72,
    "Performance & Stability": 69
  }
}
```

---

## 7. Shadow Mode Verification

### Check Preview Pills in UI

New checks (A12, C1, G11, G12) should show "(Preview)" badge in UI.

### Verify Score Not Affected

Run audit before and after Phase Next:

```bash
# Check composite score unchanged
curl "https://api.optiview.ai/api/audits/:id" | jq '{aeo_score, geo_score}'
```

Scores should be identical (shadow checks don't affect composite yet).

---

## 8. QA Checklist

- [ ] Migration runs without errors
- [ ] All new columns exist in D1
- [ ] `citations` and `mva_metrics` tables created
- [ ] Backfill scripts complete successfully
- [ ] Vectorize index created and bound
- [ ] Feature flags set correctly
- [ ] A12 detects FAQ/Q&A patterns
- [ ] C1 parses robots.txt correctly
- [ ] G11 identifies hubs and orphans
- [ ] G12 computes topic coverage
- [ ] CWV metrics captured for sampled pages
- [ ] Vectorize embeddings upserted
- [ ] Category rollups computed
- [ ] E-E-A-T rollups computed
- [ ] Shadow mode works (no score impact)
- [ ] Preview badges shown in UI
- [ ] No regressions in existing audits

---

## 9. Monitoring

### Log Patterns to Watch

```bash
# Check for errors
wrangler tail | grep -i "error"

# Check new checks executing
wrangler tail | grep -E "(A12|C1|G11|G12)"

# Check Vectorize operations
wrangler tail | grep "Vectorize"

# Check performance outliers
wrangler tail | grep "Perf Outlier"
```

### KV Metrics

If you're logging to KV, check:

```bash
npx wrangler kv:key get "PHASE_NEXT_CHECKS_RUN" --binding=AUDIT_LOGS
npx wrangler kv:key get "PHASE_NEXT_VECTORIZE_UPSERTS" --binding=AUDIT_LOGS
```

---

## 10. Rollback Plan

If issues arise:

### Disable Phase Next

```bash
npx wrangler secret put PHASE_NEXT_ENABLED  # Set to: false
```

### Revert Migration (if needed)

```sql
-- Drop new tables
DROP TABLE IF EXISTS citations;
DROP TABLE IF EXISTS mva_metrics;

-- Remove new columns (SQLite doesn't support DROP COLUMN easily)
-- Instead, create backup and recreate tables without new columns
```

### Clear Vectorize

```bash
npx wrangler vectorize delete optiview-page-embeddings
```

---

## 11. Next Steps (After Phase 1 Verified)

1. **Phase 2: UI Refresh**
   - Update Score Guide with categories
   - Add rollup visualizations to Audit Detail
   - Implement Business/Technical toggle

2. **Phase 3: Citations & MVA**
   - Automate citation ETL
   - Compute MVA metrics
   - Build Visibility tab

3. **Phase 4: Learning Loop**
   - Implement nearest cited page matching
   - Build recommendation engine
   - Add "Learn from Success" panel

4. **Phase 5: Production Rollout**
   - Flip `PHASE_NEXT_SCORING=true`
   - Remove preview badges
   - Update documentation

---

## 12. Support & Troubleshooting

### Common Issues

**Issue: Migration fails with "table already exists"**
- Solution: Check if migration already ran. Use `IF NOT EXISTS` clauses.

**Issue: Vectorize binding not found**
- Solution: Verify `wrangler.toml` has `[[vectorize]]` binding and redeploy.

**Issue: New checks return null/undefined**
- Solution: Check feature flag `PHASE_NEXT_ENABLED=true` is set.

**Issue: Category rollups show 0**
- Solution: Run backfill script to compute rollups for existing audits.

**Issue: Performance metrics not captured**
- Solution: Verify Browser Rendering is enabled and pages are being sampled.

---

## Files Created (Phase 1)

```
packages/audit-worker/
├── migrations/
│   └── 0013_phase_next_foundation.sql
├── src/
│   ├── scoring/
│   │   ├── criteria.ts          (NEW)
│   │   └── rollups.ts           (NEW)
│   ├── analysis/
│   │   ├── qaScaffold.ts        (NEW - A12)
│   │   ├── botAccess.ts         (NEW - C1)
│   │   ├── entityGraph.ts       (NEW - G11)
│   │   └── perf.ts              (NEW - Performance)
│   ├── llm/
│   │   └── topicDepth.ts        (NEW - G12)
│   ├── vectorize/
│   │   ├── embed.ts             (NEW)
│   │   └── index.ts             (NEW)
│   └── scripts/
│       ├── upsert-criteria.ts   (NEW)
│       ├── backfill-rollups.ts  (NEW)
│       └── migrate-citations.ts (NEW)
```

---

**Phase 1 Status: ✅ COMPLETE**

All foundation components implemented and ready for deployment!

