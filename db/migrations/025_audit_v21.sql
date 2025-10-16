-- Migration 025: Audit v2.1 Schema Updates
-- Extends analysis table to support EEAT, FAQ, and structure signals
-- Adds new scoring system with 5 pillars and versioning

-- Extend analysis table to support EEAT, FAQ, and structure signals
ALTER TABLE audit_page_analysis
ADD COLUMN canonical_url TEXT,
ADD COLUMN robots_meta TEXT,
ADD COLUMN has_jsonld INTEGER DEFAULT NULL,
ADD COLUMN schema_types TEXT,                -- comma-delimited list of @type
ADD COLUMN faq_schema_present INTEGER DEFAULT NULL,
ADD COLUMN author TEXT,
ADD COLUMN date_published TEXT,
ADD COLUMN date_modified TEXT,
ADD COLUMN headings_h2 INTEGER DEFAULT NULL,
ADD COLUMN headings_h3 INTEGER DEFAULT NULL,
ADD COLUMN outbound_links INTEGER DEFAULT NULL,
ADD COLUMN outbound_domains INTEGER DEFAULT NULL,
ADD COLUMN https_ok INTEGER DEFAULT NULL,
ADD COLUMN load_time_ms INTEGER DEFAULT NULL;

-- Scoring snapshot per audit with versioning
CREATE TABLE IF NOT EXISTS audit_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id TEXT NOT NULL,
  crawlability_score REAL NOT NULL,
  structured_score REAL NOT NULL,
  answerability_score REAL NOT NULL,
  trust_score REAL NOT NULL,
  visibility_score REAL NOT NULL,
  overall_score REAL NOT NULL,
  score_model_version TEXT NOT NULL DEFAULT 'v2.1',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Citations / visibility table (if not exists)
CREATE TABLE IF NOT EXISTS ai_citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT,
  domain TEXT,
  url TEXT,
  source TEXT,             -- chatgpt | claude | perplexity | brave
  snippet TEXT,
  occurred_at TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_scores_audit_id 
  ON audit_scores(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_scores_created_at 
  ON audit_scores(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_citations_domain 
  ON ai_citations(domain);
CREATE INDEX IF NOT EXISTS idx_ai_citations_source 
  ON ai_citations(source);
