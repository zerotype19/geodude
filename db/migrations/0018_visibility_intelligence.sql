-- Visibility Intelligence Platform Tables
-- Migration: 0018_visibility_intelligence.sql

-- 1) Intents generated per audited domain
CREATE TABLE IF NOT EXISTS visibility_intents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  domain TEXT NOT NULL,                 -- audited domain (normalized, e.g., example.com)
  intent_type TEXT NOT NULL,            -- "brand", "product", "howto", "faq", "compare", etc.
  query TEXT NOT NULL,                  -- rendered query for the assistant/search
  source_hint TEXT,                     -- optional: "chatgpt", "perplexity", "claude", or "generic"
  weight REAL NOT NULL DEFAULT 1.0,     -- intent weighting for scoring
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2) A run groups all connector executions for a domain
CREATE TABLE IF NOT EXISTS visibility_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  audit_id TEXT,                        -- reference to audit if from audit context
  domain TEXT NOT NULL,                 -- eTLD+1 domain (e.g., example.com)
  audited_url TEXT,                     -- full audited URL
  hostname TEXT,                        -- full hostname (e.g., www.example.com)
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT, 
  mode TEXT NOT NULL DEFAULT 'scheduled',  -- 'on_demand' | 'scheduled'
  intents_count INTEGER NOT NULL DEFAULT 0,
  sources TEXT NOT NULL,                -- json: ["chatgpt","perplexity","claude"]
  status TEXT NOT NULL DEFAULT 'processing' -- 'processing' | 'complete' | 'failed'
);

-- 3) Results per (intent x source)
CREATE TABLE IF NOT EXISTS visibility_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  domain TEXT NOT NULL,                 -- eTLD+1 domain
  audited_url TEXT,                     -- full audited URL
  hostname TEXT,                        -- full hostname
  source TEXT NOT NULL,                 -- 'chatgpt' | 'perplexity' | 'claude'
  intent_id TEXT NOT NULL,
  query TEXT NOT NULL,
  visibility_score REAL NOT NULL,       -- normalized (0..100) for this intent/source
  rank INTEGER,                         -- if the source exposes rank/position
  raw_payload JSON,                     -- normalized JSON of the SERP/answer panel
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4) Extracted citations (one-to-many from results)
CREATE TABLE IF NOT EXISTS visibility_citations (
  id TEXT PRIMARY KEY,
  result_id TEXT NOT NULL,
  ref_url TEXT NOT NULL,
  ref_domain TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  rank INTEGER,
  is_audited_domain INTEGER NOT NULL DEFAULT 0
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_vi_intents_domain ON visibility_intents(domain);
CREATE INDEX IF NOT EXISTS idx_vi_intents_project_domain ON visibility_intents(project_id, domain);
CREATE INDEX IF NOT EXISTS idx_vi_runs_audit ON visibility_runs(audit_id);
CREATE INDEX IF NOT EXISTS idx_vi_runs_domain ON visibility_runs(domain);
CREATE INDEX IF NOT EXISTS idx_vi_runs_project_domain ON visibility_runs(project_id, domain);
CREATE INDEX IF NOT EXISTS idx_vi_results_run ON visibility_results(run_id);
CREATE INDEX IF NOT EXISTS idx_vi_results_domain ON visibility_results(domain, source);
CREATE INDEX IF NOT EXISTS idx_vi_results_project_domain ON visibility_results(project_id, domain);
CREATE INDEX IF NOT EXISTS idx_vi_citations_result ON visibility_citations(result_id);
CREATE INDEX IF NOT EXISTS idx_vi_citations_domain ON visibility_citations(ref_domain);
CREATE INDEX IF NOT EXISTS idx_vi_citations_audited ON visibility_citations(is_audited_domain);
