-- Migration: LLM Prompt Runs tracking table
-- Stores metadata about prompt generation for debugging and analytics

CREATE TABLE IF NOT EXISTS llm_prompt_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  domain TEXT NOT NULL,
  brand TEXT,
  site_type TEXT,
  primary_entities TEXT,  -- JSON array
  user_intents TEXT,      -- JSON array
  envelope TEXT,
  branded_prompts TEXT,   -- JSON array
  nonbranded_prompts TEXT,-- JSON array
  prompt_gen_version TEXT NOT NULL DEFAULT 'v2-contextual',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_llm_prompt_runs_domain ON llm_prompt_runs (domain);
CREATE INDEX IF NOT EXISTS idx_llm_prompt_runs_created ON llm_prompt_runs (created_at);

