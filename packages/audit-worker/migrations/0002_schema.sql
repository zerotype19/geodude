PRAGMA foreign_keys=ON;

CREATE TABLE audits (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  root_url TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running', -- running|complete|failed
  aeo_score REAL,
  geo_score REAL,
  config_json TEXT
);

CREATE TABLE audit_pages (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,
  content_type TEXT,
  html_static TEXT,      -- truncated to first ~200k chars
  html_rendered TEXT,    -- truncated to first ~200k chars
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
);

CREATE TABLE audit_page_analysis (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  title TEXT,
  h1 TEXT,
  canonical TEXT,
  schema_types TEXT,     -- JSON array
  jsonld TEXT,           -- minified array
  has_answer_box INTEGER, -- 0/1
  has_jump_links INTEGER, -- 0/1
  facts_block INTEGER,    -- 0/1
  references_block INTEGER, -- 0/1
  tables_count INTEGER,
  outbound_links INTEGER,
  author_json TEXT,      -- JSON
  org_json TEXT,         -- JSON
  robots_ai_policy TEXT, -- JSON {gptbot, claude, perplexity}
  parity_pass INTEGER,   -- 0/1 (static vs rendered parity for key blocks)
  aeo_score REAL,
  geo_score REAL,
  checks_json TEXT,      -- array of {id, score, weight, evidence}
  analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (page_id) REFERENCES audit_pages(id) ON DELETE CASCADE
);
