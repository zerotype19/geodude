-- Migration: LLM Prompt Intelligence Index
-- Aggregated table for global domain intelligence and Agent integration

CREATE TABLE IF NOT EXISTS llm_prompt_index (
  id TEXT PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  project_id TEXT,
  brand TEXT,
  site_type TEXT,
  primary_entities TEXT,    -- JSON array of top entities
  avg_llm_coverage REAL DEFAULT 0.0,  -- Average citation coverage across sources
  total_citations INTEGER DEFAULT 0,
  total_queries INTEGER DEFAULT 0,
  last_cited_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_llm_prompt_index_domain ON llm_prompt_index(domain);
CREATE INDEX IF NOT EXISTS idx_llm_prompt_index_project ON llm_prompt_index(project_id);
CREATE INDEX IF NOT EXISTS idx_llm_prompt_index_site_type ON llm_prompt_index(site_type);
CREATE INDEX IF NOT EXISTS idx_llm_prompt_index_updated ON llm_prompt_index(updated_at);

-- Index for entity-based queries (JSON array search in SQLite)
CREATE INDEX IF NOT EXISTS idx_llm_prompt_index_entities ON llm_prompt_index(primary_entities);

