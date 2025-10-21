-- Phase Next Foundation Migration (Fixed)
-- Non-destructive, additive changes to support:
-- - Practical categories & E-E-A-T rollups
-- - New checks (A12, C1, G11, G12)
-- - Citations join & MVA metrics
-- - Performance data (CWV)
-- - Learning loop recommendations

-- ============================================================================
-- 1) Create audit_criteria table if it doesn't exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_criteria (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  eeat_pillar TEXT,
  impact_level TEXT,
  weight REAL DEFAULT 1.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add columns if table already existed
-- SQLite doesn't have IF NOT EXISTS for ALTER COLUMN in older versions, so we'll skip errors
-- The actual columns are added in the next section

-- ============================================================================
-- 2) Expand audit_criteria with new metadata
-- ============================================================================
-- These will silently fail if columns already exist (SQLite behavior)

CREATE INDEX IF NOT EXISTS idx_audit_criteria_category ON audit_criteria(category);
CREATE INDEX IF NOT EXISTS idx_audit_criteria_eeat ON audit_criteria(eeat_pillar);
CREATE INDEX IF NOT EXISTS idx_audit_criteria_impact ON audit_criteria(impact_level);

-- ============================================================================
-- 3) Add performance metrics to page-level analysis
-- ============================================================================
ALTER TABLE audit_page_analysis ADD COLUMN lcp_ms INTEGER;
ALTER TABLE audit_page_analysis ADD COLUMN cls REAL;
ALTER TABLE audit_page_analysis ADD COLUMN fid_ms INTEGER;

-- ============================================================================
-- 4) Store page classification
-- ============================================================================
ALTER TABLE audit_page_analysis ADD COLUMN page_type TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_page_analysis_page_type ON audit_page_analysis(page_type);

-- ============================================================================
-- 5) Bots access results
-- ============================================================================
ALTER TABLE audit_page_analysis ADD COLUMN ai_bot_access_json TEXT;
ALTER TABLE audit_page_analysis ADD COLUMN render_parity INTEGER DEFAULT 0;

-- ============================================================================
-- 6) Citations table (unified, replaces ai_citations/ai_referrals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  audit_id TEXT NOT NULL,
  assistant TEXT NOT NULL,
  cited_url TEXT NOT NULL,
  cited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  snippet TEXT,
  question TEXT,
  evidence_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_citations_project ON citations(project_id);
CREATE INDEX IF NOT EXISTS idx_citations_audit ON citations(audit_id);
CREATE INDEX IF NOT EXISTS idx_citations_url ON citations(cited_url);
CREATE INDEX IF NOT EXISTS idx_citations_assistant ON citations(assistant);
CREATE INDEX IF NOT EXISTS idx_citations_cited_at ON citations(cited_at);

-- ============================================================================
-- 7) Aggregates computed post-ingest
-- ============================================================================
ALTER TABLE audit_pages ADD COLUMN is_cited INTEGER DEFAULT 0;
ALTER TABLE audit_pages ADD COLUMN citation_count INTEGER DEFAULT 0;
ALTER TABLE audit_pages ADD COLUMN assistants_citing TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_pages_is_cited ON audit_pages(is_cited);

-- ============================================================================
-- 8) Learning deltas & recommendations
-- ============================================================================
ALTER TABLE audit_pages ADD COLUMN nearest_cited_url TEXT;
ALTER TABLE audit_pages ADD COLUMN recommendation_json TEXT;

-- ============================================================================
-- 9) MVA metrics (domain-level visibility analytics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mva_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  audit_id TEXT,
  window TEXT NOT NULL,
  assistant TEXT NOT NULL,
  mva_index INTEGER,
  mentions_count INTEGER,
  unique_urls INTEGER,
  impression_estimate INTEGER,
  competitor_json TEXT,
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mva_metrics_project ON mva_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_mva_metrics_audit ON mva_metrics(audit_id);
CREATE INDEX IF NOT EXISTS idx_mva_metrics_window ON mva_metrics(window);
CREATE INDEX IF NOT EXISTS idx_mva_metrics_assistant ON mva_metrics(assistant);

-- ============================================================================
-- Migration Complete
-- ============================================================================

