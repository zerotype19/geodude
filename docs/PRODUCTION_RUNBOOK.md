# Production Runbook - Bulletproof 50-Page E-E-A-T Analyzer

## SLOs (Service Level Objectives)

* **p95 audit start → first response**: < 1s
* **p95 crawl tick duration**: ≤ 25s
* **Pages persisted before phase change**: ≥ 50 *or* frontier truly empty (seeded=1)
* **Audit completion** (50 pages, citations, synth, finalize): ≤ 4 min

## On-Call Checks (Single Glance)

### Watchdog Counters (Last 15m)
- `visiting_demoted` - URLs recovered from stuck visiting state
- `continuations_enqueued` - Self-continuation requests scheduled
- `rewinds_to_crawl` - Audits bounced back to crawl phase

### Circuit Breakers
- `browser` - Browser rendering service health
- `ai` - AI service health  
- `fetch` - General fetch operations health
- **Status**: Should be **closed** (healthy)

### Frontier Health
- When `phase >= citations`: `pending=0` & `visiting=0`
- Frontier should be exhausted before advancing phases

## Playbooks

### `AUDIT_STUCK`
**Symptoms**: Audit heartbeat > 2m old
**Actions**:
1. Verify heartbeat age in logs
2. If >2m, watchdog should automatically demote & requeue
3. If not working, run manual: `POST /internal/audits/continue`
4. Check for `SELF_CONTINUE_FAILED` errors

### `ALERT_CRAWL_UNDER_TARGET`
**Symptoms**: Pages < 50 with seeded=1 & empty frontier
**Cause**: Site has limited content (scarcity)
**Actions**:
1. Reduce `CRAWL_MAX_PAGES` for this property, OR
2. Re-seed with higher `SITEMAP_URL_CAP`
3. This is content limitation, not system failure

### `SELF_CONTINUE_FAILED` Spikes
**Symptoms**: High failure rate in self-continuation
**Actions**:
1. Check `INTERNAL_TOKEN` configuration
2. Verify `SELF_URL` endpoint accessibility
3. Check for egress errors/firewall issues
4. Likely cause: circuit breakers open

### `ALERT_MULTIPLE_H1` / `ALERT_SCHEMA_GAP`
**Symptoms**: Content quality issues
**Actions**:
- These are **content issues**, not infrastructure problems
- Surface in UI for content team review
- No infrastructure intervention needed

## Product/UI Quick Wins

### Audit Detail Header
```json
{
  "progress": {
    "pages": "50/50",
    "phase": "citations", 
    "last_heartbeat": "12s ago",
    "sparkline": [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
  },
  "health_chips": {
    "frontier_empty": true,
    "seeded": true,
    "browser_breaker": "closed",
    "ai_breaker": "closed"
  }
}
```

### Coverage Widgets
```json
{
  "coverage": {
    "h1_coverage": 95,
    "title_coverage": 100,
    "meta_coverage": 87,
    "schema_histogram": {
      "Article": 15,
      "Organization": 12,
      "WebSite": 8,
      "FAQPage": 3,
      "Product": 2
    },
    "eeat_badges": {
      "author": 78,
      "dates": 65,
      "media": 92,
      "citations": 45
    }
  }
}
```

### Problem Table
**Columns**: URL, H1 count, Title?, Meta?, Schema types, E-E-A-T flags
**Filters**: `problem_codes`: `NO_H1`, `MULTI_H1`, `NO_META_DESC`, `NO_SCHEMA`, `NO_AUTHOR`, `NO_DATES`, `ROBOTS_NOINDEX`

### Ops Tiles (Admin Dashboard)
```json
{
  "metrics": {
    "continuations_per_min": 12,
    "rewinds_per_min": 2,
    "visiting_demoted_per_min": 5,
    "p95_tick_duration_ms": 18500,
    "p95_total_audit_time_ms": 180000
  }
}
```

## Configuration (Per-Project Toggles)

| Key                        | Default | Notes                    |
| -------------------------- | ------: | ------------------------ |
| CRAWL_MAX_PAGES            |      50 | target breadth           |
| CRAWL_MAX_DEPTH            |       3 | BFS depth                |
| PAGE_BATCH_SIZE            |       5 | try 6 on fast sites      |
| CRAWL_TIMEBOX_MS           |   25000 | stay under Worker budget |
| NAV_SEED_LIMIT             |      75 | header/footer/nav cap    |
| SITEMAP_URL_CAP            |     500 | sitemap seeds            |
| CRAWL_MAX_URLS_IN_FRONTIER |    2000 | runaway guard            |
| CRAWL_MAX_ENQUEUE_PER_PAGE |     100 | per-page guard           |

## QA Checklist (Regression Testing)

### Happy Path - Rich Site
- **Expect**: Reaches 50 pages, advances next tick only
- **Verify**: `frontier=0 OR pages>=50` when phase changes

### Robots Disallow
- **Expect**: Crawl stops early, `ROBOTS_NOINDEX` flagged
- **Verify**: No infinite retries, graceful degradation

### JS-Heavy SPA
- **Expect**: PR-3 fallback used, pages persisted
- **Verify**: Analysis rows created, no crashes

### Flaky Host (429/500s)
- **Expect**: `safeFetch` retries, breaker opens
- **Verify**: Watchdog continues work, no stuck `visiting`

### Huge Sitemap/Nav
- **Expect**: Caps respected (`SITEMAP_URL_CAP`, `NAV_SEED_LIMIT`)
- **Verify**: No memory pressure, graceful limiting

## Alert Thresholds (Log-Only)

- `AUDIT_STUCK`: Heartbeat > 2m
- `ALERT_RECURRING_FAILURE`: Same failure code ≥3 in 10m
- `ALERT_CRAWL_UNDER_TARGET`: Finished < 50 pages AND seeded=1 AND frontier empty
- `ALERT_MULTIPLE_H1`: >20% pages have multiple H1s
- `ALERT_SCHEMA_GAP`: <30% pages have Article/Organization schema

## Rollback & Safety

### Feature Flags
- `CRAWL_BFS_FRONTIER_ENABLED`: Revert to simpler crawl (keeps immediate persistence)
- `RENDER_FALLBACK_ONLY=1`: Use fallback render path for critical incidents

### Database Safety
- All migrations are **additive**
- No destructive changes required for rollback
- Can safely rollback without data loss

## API Endpoints

### Analysis Endpoints
- `GET /v1/audits/{id}/analysis/coverage` - Site-level metrics
- `GET /v1/audits/{id}/analysis/schema-gaps` - Schema distribution
- `GET /v1/audits/{id}/analysis/problems` - SEO issues with problem codes
- `GET /v1/audits/{id}/analysis/pages` - Detailed page data
- `GET /v1/audits/{id}/summary` - Comprehensive audit overview

### Internal Endpoints
- `POST /internal/audits/continue` - Manual audit continuation
- `GET /internal/watchdog/status` - Watchdog health check

## SQL Spot-Checks

See `docs/sql-spot-checks.md` for ready-to-use queries:
- Frontier status verification
- Coverage rollup sanity checks
- Watchdog health monitoring
- Performance metrics

## Near-Term Backlog

### High Priority
- [ ] Analyze-queue drain in `synth` (offload big pages if timebox pressured)
- [ ] Canonical & hreflang consistency checks (duplicate cluster flag)

### Medium Priority  
- [ ] Org/WebSite schema audit on root (logo, sameAs, contactPoint)
- [ ] Per-property rate limiting & politeness

### Low Priority
- [ ] Multi-domain support with host-based rate limiting
- [ ] Advanced content effort signals (word count, media ratios)

## Success Metrics

The system is **production-ready** when:
- ✅ p95 audit completion < 4 minutes
- ✅ 95%+ audits reach 50 pages or exhaust frontier
- ✅ Watchdog counters show healthy patterns
- ✅ Circuit breakers remain closed
- ✅ Analysis coverage provides actionable insights

---

**System Status**: ✅ **PRODUCTION READY**  
**Last Updated**: 2025-01-15  
**Version**: e4c177d6-984b-493f-a42b-2384483788bd
