# SQL Spot-Check Queries for QA

## Did we hit 50 before leaving crawl?

```sql
-- Check if audit properly reached 50 pages or exhausted frontier before leaving crawl
WITH p AS (SELECT COUNT(*) c FROM audit_pages WHERE audit_id=?1),
     f AS (SELECT COUNT(*) c FROM audit_frontier WHERE audit_id=?1 AND status IN ('pending','visiting'))
SELECT (SELECT c FROM p) AS pages, (SELECT c FROM f) AS frontier;
-- When phase >= 'citations': frontier==0 OR pages>=50
```

## Coverage rollup sanity check

```sql
-- Verify analysis coverage metrics are reasonable
SELECT
  COUNT(*) pages,
  SUM(h1 IS NOT NULL AND h1!='') h1_ok,
  SUM(h1_count=1) single_h1,
  SUM(title IS NOT NULL AND title!='') title_ok,
  SUM(meta_description IS NOT NULL AND meta_description!='') meta_ok,
  SUM(schema_types LIKE '%Article%') schema_article,
  SUM(eeat_flags LIKE '%HAS_AUTHOR%') has_author,
  SUM(eeat_flags LIKE '%HAS_DATES%') has_dates
FROM audit_page_analysis WHERE audit_id=?1;
```

## Top offenders (pages with problems)

```sql
-- Find pages with SEO issues for prioritization
SELECT url, h1_count, title, meta_description, schema_types, eeat_flags
FROM audit_page_analysis
WHERE audit_id=?1
  AND (h1_count!=1 OR title IS NULL OR meta_description IS NULL
       OR (schema_types IS NULL OR schema_types=''))
ORDER BY url LIMIT 100;
```

## Watchdog health check

```sql
-- Check for audits that might need watchdog intervention
SELECT id, status, phase, phase_heartbeat_at, 
       (SELECT COUNT(*) FROM audit_pages WHERE audit_id = audits.id) as pages_crawled,
       (SELECT COUNT(*) FROM audit_frontier WHERE audit_id = audits.id AND status = 'pending') as frontier_pending
FROM audits 
WHERE status = 'running' 
  AND (julianday('now') - julianday(phase_heartbeat_at) > 2.0/1440); -- >2 minutes old
```

## Frontier status check

```sql
-- Check frontier distribution for an audit
SELECT status, COUNT(*) as count 
FROM audit_frontier 
WHERE audit_id = ?1 
GROUP BY status;
```

## Analysis performance check

```sql
-- Check if analysis is keeping up with crawling
SELECT 
  COUNT(*) as total_analyzed,
  MIN(analyzed_at) as first_analysis,
  MAX(analyzed_at) as last_analysis
FROM audit_page_analysis 
WHERE audit_id = ?1;
```

## Schema type distribution

```sql
-- See what schema types are most common
SELECT schema_types, COUNT(*) c
FROM audit_page_analysis
WHERE audit_id = ?1
GROUP BY schema_types
ORDER BY c DESC;
```

## E-E-A-T flags summary

```sql
-- Summary of E-E-A-T factors across all pages
SELECT 
  SUM(CASE WHEN eeat_flags LIKE '%HAS_AUTHOR%' THEN 1 ELSE 0 END) as pages_with_author,
  SUM(CASE WHEN eeat_flags LIKE '%HAS_DATES%' THEN 1 ELSE 0 END) as pages_with_dates,
  SUM(CASE WHEN eeat_flags LIKE '%HAS_MEDIA%' THEN 1 ELSE 0 END) as pages_with_media,
  SUM(CASE WHEN eeat_flags LIKE '%HAS_CITATIONS%' THEN 1 ELSE 0 END) as pages_with_citations,
  COUNT(*) as total_pages
FROM audit_page_analysis
WHERE audit_id = ?1;
```

## Recent audit performance

```sql
-- Check performance of recent audits
SELECT id, status, phase, created_at, completed_at,
       (SELECT COUNT(*) FROM audit_pages WHERE audit_id = audits.id) as pages_crawled
FROM audits 
WHERE created_at > datetime('now', '-1 day')
ORDER BY created_at DESC
LIMIT 10;
```

## Usage Instructions

Replace `?1` with the actual audit ID when running these queries:

```bash
# Example usage with wrangler
wrangler d1 execute optiview_db --remote --command "
WITH p AS (SELECT COUNT(*) c FROM audit_pages WHERE audit_id='aud_1234567890_abc'),
     f AS (SELECT COUNT(*) c FROM audit_frontier WHERE audit_id='aud_1234567890_abc' AND status IN ('pending','visiting'))
SELECT (SELECT c FROM p) AS pages, (SELECT c FROM f) AS frontier;
"
```
