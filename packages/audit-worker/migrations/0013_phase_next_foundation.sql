-- Phase Next Foundation Migration
-- Non-destructive, additive changes to support:
-- - Practical categories & E-E-A-T rollups
-- - New checks (A12, C1, G11, G12)
-- - Citations join & MVA metrics
-- - Performance data (CWV)
-- - Learning loop recommendations

-- ============================================================================
-- 1) Expand audit_criteria master table (columns already exist or handled by v2)
-- ============================================================================
-- ALTER TABLE audit_criteria ADD COLUMN IF NOT EXISTS category TEXT;             -- Practical category
-- ALTER TABLE audit_criteria ADD COLUMN IF NOT EXISTS eeat_pillar TEXT;          -- E-E-A-T pillar
-- ALTER TABLE audit_criteria ADD COLUMN IF NOT EXISTS impact_level TEXT;         -- High | Medium | Low

CREATE INDEX IF NOT EXISTS idx_audit_criteria_category ON audit_criteria(category);
CREATE INDEX IF NOT EXISTS idx_audit_criteria_eeat ON audit_criteria(eeat_pillar);
CREATE INDEX IF NOT EXISTS idx_audit_criteria_impact ON audit_criteria(impact_level);

-- ============================================================================
-- 2) Add performance metrics to page-level analysis (columns already exist)
-- ============================================================================
-- ALTER TABLE audit_page_analysis ADD COLUMN IF NOT EXISTS lcp_ms INTEGER;
-- ALTER TABLE audit_page_analysis ADD COLUMN IF NOT EXISTS cls REAL;
-- ALTER TABLE audit_page_analysis ADD COLUMN IF NOT EXISTS fid_ms INTEGER;

-- ============================================================================
-- 3) Store page classification (column already exists)
-- ============================================================================
-- ALTER TABLE audit_page_analysis ADD COLUMN IF NOT EXISTS page_type TEXT;      -- answer|faq|product|article|category|docs

CREATE INDEX IF NOT EXISTS idx_audit_page_analysis_page_type ON audit_page_analysis(page_type);

-- ============================================================================
-- 4) Bots access results (columns already exist)
-- ============================================================================
-- ALTER TABLE audit_page_analysis ADD COLUMN IF NOT EXISTS ai_bot_access_json TEXT;   -- JSON: { gptbot: "allow|block", claude: "...", perplexity: "..." }
-- ALTER TABLE audit_page_analysis ADD COLUMN IF NOT EXISTS render_parity INTEGER DEFAULT 0;     -- 1 if SSR/HTML ~= rendered DOM for key content blocks

-- ============================================================================
-- 5) Citations table (unified, replaces ai_citations/ai_referrals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  audit_id TEXT NOT NULL,
  assistant TEXT NOT NULL,                -- 'chatgpt' | 'claude' | 'perplexity' | 'brave'
  cited_url TEXT NOT NULL,                -- normalized absolute URL
  cited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  snippet TEXT,                           -- quoted passage in assistant
  question TEXT,                          -- the prompt/query used
  evidence_url TEXT                       -- (optional) link to proof drawer artifact
);

CREATE INDEX IF NOT EXISTS idx_citations_project ON citations(project_id);
CREATE INDEX IF NOT EXISTS idx_citations_audit ON citations(audit_id);
CREATE INDEX IF NOT EXISTS idx_citations_url ON citations(cited_url);
CREATE INDEX IF NOT EXISTS idx_citations_assistant ON citations(assistant);
CREATE INDEX IF NOT EXISTS idx_citations_cited_at ON citations(cited_at);

-- ============================================================================
-- 6) Aggregates computed post-ingest (columns likely already exist)
-- ============================================================================
-- ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS is_cited INTEGER DEFAULT 0;        -- boolean
-- ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS citation_count INTEGER DEFAULT 0;
-- ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS assistants_citing TEXT;            -- JSON array ["chatgpt","claude"]

CREATE INDEX IF NOT EXISTS idx_audit_pages_is_cited ON audit_pages(is_cited);

-- ============================================================================
-- 7) Learning deltas & recommendations (columns likely already exist)
-- ============================================================================
-- ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS nearest_cited_url TEXT;
-- ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS recommendation_json TEXT;          -- JSON with diffs and actions

-- ============================================================================
-- 8) MVA metrics (domain-level visibility analytics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mva_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  audit_id TEXT,
  window TEXT NOT NULL,                   -- '7d' | '30d'
  assistant TEXT NOT NULL,                -- 'chatgpt' | 'claude' | 'perplexity' | 'all'
  mva_index INTEGER,                      -- 0-100
  mentions_count INTEGER,
  unique_urls INTEGER,
  impression_estimate INTEGER,
  competitor_json TEXT,                   -- [{domain, mentions, share}]
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mva_metrics_project ON mva_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_mva_metrics_audit ON mva_metrics(audit_id);
CREATE INDEX IF NOT EXISTS idx_mva_metrics_window ON mva_metrics(window);
CREATE INDEX IF NOT EXISTS idx_mva_metrics_assistant ON mva_metrics(assistant);

-- ============================================================================
-- 9) Category & E-E-A-T rollup storage (per page)
-- ============================================================================
-- Store as JSON in metadata for now, can normalize later if needed
-- audit_page_analysis.metadata will include:
-- {
--   "category_scores": { "Content & Clarity": 85, "Structure & Organization": 72, ... },
--   "eeat_scores": { "Access & Indexability": 90, "Entities & Structure": 78, ... },
--   "classification_v2": { ... existing ... },
--   "prompts_v2": { ... existing ... }
-- }

-- ============================================================================
-- 10) Shadow checks metadata (A12, C1, G11, G12)
-- ============================================================================
-- These will be stored in checks_json with a "preview" flag
-- No schema changes needed, handled in application logic

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Next steps:
-- 1. Run backfill script to populate category/eeat/impact from CRITERIA registry
-- 2. Migrate existing citations data from ai_citations/ai_referrals
-- 3. Enable PHASE_NEXT_ENABLED=true to start computing new checks

