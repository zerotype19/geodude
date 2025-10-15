# Go-Live Checklist - Bulletproof 50-Page E-E-A-T Analyzer

## Pre-Deployment (15 min)

### ✅ Configuration Verification
- **`wrangler.toml` envs match prod defaults**:
  - `PAGE_BATCH_SIZE = "5"`
  - `CRAWL_TIMEBOX_MS = "25000"`
  - `CRAWL_MAX_PAGES = "50"`
  - `CRAWL_MAX_DEPTH = "3"`
  - `NAV_SEED_LIMIT = "75"`
  - `SITEMAP_URL_CAP = "500"`
  - `CRAWL_MAX_URLS_IN_FRONTIER = "2000"`
  - `CRAWL_MAX_ENQUEUE_PER_PAGE = "100"`

### ✅ Feature Flags
- `CRAWL_BFS_FRONTIER_ENABLED=1` (enable new crawler)
- `RENDER_FALLBACK_ONLY=0` (allow browser rendering)

### ✅ Database Migrations Applied
- `audit_frontier` table created
- `audit_page_analysis` table created  
- `audit_locks` table created
- All indexes created
- `phase_state` column added to `audits`

## Smoke Tests (Copy/Paste)

### 1. Start Audit Test
```bash
curl -X POST "https://api.optiview.ai/v1/audits/start" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Expect: 200 response with status=running
```

### 2. Phase Progression Test
```bash
# Poll audit status every 10 seconds
curl -s "https://api.optiview.ai/v1/audits/{audit_id}" | jq '{status, phase, pages_crawled}'

# Expect: 
# - Phase stays "crawl" until 50 pages
# - Heartbeats update every <30s
# - Pages increment: 5, 10, 15, 20, 25, 30, 35, 40, 45, 50
```

### 3. Summary Endpoint Test
```bash
curl -s "https://api.optiview.ai/v1/audits/{audit_id}/summary" | jq '{audit: {pages_crawled, phase}, coverage: {pages}}'

# Expect: pages_crawled increments, phase changes to "citations" when pages=50
```

### 4. Analysis API Tests
```bash
# Coverage metrics
curl -s "https://api.optiview.ai/v1/audits/{audit_id}/analysis/coverage" | jq '{pages, h1_ok, title_ok, meta_ok}'
# Expect: non-zero counts

# Problems detection  
curl -s "https://api.optiview.ai/v1/audits/{audit_id}/analysis/problems" | jq '{problems: (.problems | length)}'
# Expect: empty array or expected issues

# Detailed pages
curl -s "https://api.optiview.ai/v1/audits/{audit_id}/analysis/pages?limit=10" | jq '{results: (.results | length), total: .pagination.total}'
# Expect: 10 results, total > 0
```

## Watchdog Sanity (Logs)

### ✅ Expected Log Patterns
- `CRAWL_TICK {processed: >0}` appears every tick
- `CRAWL_ADVANCED` only after `pages >= 50` OR frontier empty & `seeded=1`
- `VISITING_RECOVERED {n}` can be >0 under load (normal)
- `BOUNCE_BACK_TO_CRAWL` should be rare
- `SELF_CONTINUE_FAILED` should be 0

### ❌ Red Flags
- `CRAWL_ADVANCED` with `pages < 50` and `frontier > 0` (race condition)
- High `SELF_CONTINUE_FAILED` count (auth/network issues)
- `BOUNCE_BACK_TO_CRAWL` frequently (continuation timing issues)

## First 72 Hours - What to Watch

### 📊 Key Metrics
- **Continuations/min**: Rising steadily; ≤ a few per audit
- **Rewinds/min**: ≈ 0 (non-zero = late continuations)
- **Breaker state**: Must remain **closed** (browser/ai/fetch)
- **p95 tick duration**: ≤ 25s
- **p95 total audit time**: ≤ 4m
- **ALERT_CRAWL_UNDER_TARGET**: Only on genuinely small sites

### 🔍 Monitoring Queries
```sql
-- Watchdog health (run every 15 minutes)
SELECT 
  COUNT(*) as running_audits,
  AVG(julianday('now') - julianday(phase_heartbeat_at)) * 1440 as avg_heartbeat_age_minutes
FROM audits 
WHERE status = 'running';

-- Performance check
SELECT 
  id, status, phase,
  (SELECT COUNT(*) FROM audit_pages WHERE audit_id = audits.id) as pages_crawled,
  (SELECT COUNT(*) FROM audit_frontier WHERE audit_id = audits.id AND status = 'pending') as frontier_pending
FROM audits 
WHERE created_at > datetime('now', '-1 hour')
ORDER BY created_at DESC;
```

## UI Wiring Map (Endpoint → Widget)

### 🎯 Audit Header Widget
**Endpoint**: `GET /v1/audits/:id/summary`
```typescript
const auditHeader = {
  pages: `${data.audit.pages_crawled}/50`,
  phase: data.audit.phase,
  lastHeartbeat: formatTimeAgo(data.audit.phase_heartbeat_at),
  seeded: true, // from phase_state
  frontierEmpty: data.audit.frontier_pending === 0,
  breakerState: "all_closed" // from watchdog counters
};
```

### 📊 Coverage Bars Widget
**Endpoint**: `GET /v1/audits/:id/analysis/coverage`
```typescript
const coverageBars = {
  h1Coverage: Math.round((data.h1_ok / data.pages) * 100),
  titleCoverage: Math.round((data.title_ok / data.pages) * 100),
  metaCoverage: Math.round((data.meta_ok / data.pages) * 100),
  authorCoverage: Math.round((data.has_author / data.pages) * 100),
  datesCoverage: Math.round((data.has_dates / data.pages) * 100),
  schemaHistogram: {
    Article: data.schema_article,
    Organization: data.schema_organization,
    WebSite: data.schema_website,
    FAQPage: data.schema_faq
  }
};
```

### 🚨 Problems Table Widget
**Endpoint**: `GET /v1/audits/:id/analysis/problems?limit=50`
```typescript
const problemsTable = {
  columns: ['URL', 'H1 Count', 'Title?', 'Meta?', 'Schema', 'E-E-A-T', 'Issues'],
  filters: ['NO_H1', 'MULTI_H1', 'NO_META_DESC', 'NO_SCHEMA', 'NO_AUTHOR', 'NO_DATES', 'ROBOTS_NOINDEX'],
  rows: data.problems.map(row => ({
    url: row.url,
    h1Count: row.h1_count,
    hasTitle: !!row.title,
    hasMeta: !!row.meta_description,
    schemaTypes: row.schema_types || 'None',
    eeatFlags: row.eeat_flags,
    problemCodes: row.problem_codes
  }))
};
```

### 📄 Pages List Widget
**Endpoint**: `GET /v1/audits/:id/analysis/pages?limit=20&page=1`
```typescript
const pagesTable = {
  columns: ['URL', 'H1 Count', 'Title', 'Meta', 'Schema Types', 'E-E-A-T', 'Word Count'],
  pagination: data.pagination,
  rows: data.results.map(row => ({
    url: row.url,
    h1Count: row.h1_count,
    title: row.title || 'Missing',
    meta: row.meta_description || 'Missing',
    schemaTypes: row.schema_types || 'None',
    eeatFlags: row.eeat_flags,
    wordCount: row.word_count
  }))
};
```

## On-Call Quick Plays

### 🚨 Audit "Stuck" (No Heartbeat > 2m)
```bash
# 1. Check if watchdog is running
grep "AUDIT_STUCK" logs | tail -5

# 2. Manual continuation if needed
curl -X POST "https://api.optiview.ai/internal/audits/continue" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer internal" \
  -d '{"auditId": "aud_1234567890_abc"}'
```

### ⚡ Early Phase Advance
```bash
# Check logs for race condition
grep "CRAWL_ADVANCED" logs | grep -v "pages.*50"

# Verify bounce-back fired
grep "BOUNCE_BACK_TO_CRAWL" logs | tail -5

# Check seeded flag
SELECT json_extract(phase_state,'$.crawl.seeded') as seeded FROM audits WHERE id='aud_123';
```

### 🐌 Throughput Slow (Pages Not Reaching 50)
```bash
# Temporary fix: increase batch size
# Update wrangler.toml: PAGE_BATCH_SIZE = "6"
# Deploy and monitor p95 tick duration

# Check frontier status
SELECT status, COUNT(*) FROM audit_frontier WHERE audit_id='aud_123' GROUP BY status;
```

## Data Hygiene & Safety

### ✅ URL Normalization
- Host lowercase only (path preserved)
- Strip tracking params: `utm_*`, `fbclid`, `gclid`, `mc_*`, `ref`, `affiliate_id`
- Collapse `index.html` to `/`
- Consistent trailing slash handling

### ✅ Analysis Bounds
- HTML size cap: ≤ 1.5 MB
- JSON-LD nodes cap: ≤ 8 nodes
- Skip `<script>/<style>` blocks in regex passes
- Target: <75-100ms analysis per page

## Tiny Backlog (Optional, High ROI)

### 🔄 Performance Optimizations
- [ ] **Analyze-queue drain in `synth`** for very large pages (keeps crawl ticks snappy)
- [ ] **Per-property caps** exposed in UI for fine-tuning

### 🔍 Content Analysis Enhancements
- [ ] **Canonical/hreflang** consistency checks
- [ ] **Org/WebSite schema audit** on root (logo, sameAs, contactPoint)

### 📊 Advanced Features
- [ ] **Multi-domain support** with host-based rate limiting
- [ ] **Content effort signals** (word count, media ratios)

## Success Criteria

### ✅ Go-Live Success
- p95 audit completion < 4 minutes
- 95%+ audits reach 50 pages or exhaust frontier
- Watchdog counters show healthy patterns
- Circuit breakers remain closed
- Analysis coverage provides actionable insights

### ✅ UI Integration Success
- All widgets render with real data
- Real-time progress updates work
- Problem detection surfaces actionable issues
- Coverage metrics provide clear insights

---

**System Status**: ✅ **GO-LIVE READY**  
**Last Updated**: 2025-01-15  
**Version**: e4c177d6-984b-493f-a42b-2384483788bd  
**Documentation**: Complete runbook and UI contracts available
