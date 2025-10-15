-- Page analysis for Schema / H1 / E-E-A-T
CREATE TABLE IF NOT EXISTS audit_page_analysis (
  audit_id TEXT NOT NULL,
  url TEXT NOT NULL,
  h1 TEXT,
  h1_count INTEGER,
  title TEXT,
  meta_description TEXT,
  canonical TEXT,
  robots_meta TEXT,
  schema_types TEXT,         -- comma-joined types found (Article, FAQPage, etc.)
  author TEXT,
  date_published TEXT,
  date_modified TEXT,
  images INTEGER,
  headings_h2 INTEGER,
  headings_h3 INTEGER,
  outbound_links INTEGER,
  word_count INTEGER,        -- (echo from pages table if you want)
  eeat_flags TEXT,           -- comma-joined flags (HAS_AUTHOR, MULTI_H1, etc.)
  analyzed_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (audit_id, url)
);

CREATE INDEX IF NOT EXISTS idx_page_analysis_audit ON audit_page_analysis(audit_id);
