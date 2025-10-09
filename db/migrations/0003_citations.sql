-- M9: Citations Lite
-- Track where domain appears in AI answer sources

CREATE TABLE IF NOT EXISTS citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id TEXT NOT NULL,
  engine TEXT NOT NULL,      -- 'stub' | 'bing' | 'perplexity' | etc.
  query TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  cited_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_citations_audit ON citations(audit_id);

