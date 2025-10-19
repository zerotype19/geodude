-- Migration: LLM Prompt Cache for scalable contextual prompt service
-- Stores precomputed prompt sets to avoid recomputing on every LLM run

CREATE TABLE IF NOT EXISTS llm_prompt_cache (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  project_id TEXT,
  site_type TEXT,
  brand TEXT,
  lang TEXT,
  primary_entities TEXT,   -- JSON array
  user_intents TEXT,       -- JSON array
  branded_prompts TEXT,    -- JSON array
  nonbranded_prompts TEXT, -- JSON array
  envelope TEXT,           -- LLM context envelope
  prompt_gen_version TEXT NOT NULL DEFAULT 'v2-contextual',
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_llm_prompt_cache_domain ON llm_prompt_cache(domain);
CREATE INDEX IF NOT EXISTS idx_llm_prompt_cache_updated ON llm_prompt_cache(updated_at);
CREATE INDEX IF NOT EXISTS idx_llm_prompt_cache_project ON llm_prompt_cache(project_id);

