-- 0005_citations_cache.sql
-- Cache Brave Search results for 24h to avoid repeated API calls

CREATE TABLE IF NOT EXISTS citations_cache (
  domain TEXT NOT NULL,
  query  TEXT NOT NULL,
  url    TEXT NOT NULL,
  title  TEXT,
  cached_at INTEGER NOT NULL,
  PRIMARY KEY (domain, query, url)
);

CREATE INDEX IF NOT EXISTS idx_citations_cache_domain_query ON citations_cache(domain, query);

