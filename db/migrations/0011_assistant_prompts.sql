-- Phase Next: Assistant Visibility - Assistant Prompts
-- Store individual prompts used in assistant runs

CREATE TABLE IF NOT EXISTS assistant_prompts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES assistant_runs(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  intent_tag TEXT, -- 'definition' | 'comparison' | 'bestof' | ...
  locale TEXT DEFAULT 'en',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assistant_prompts_run ON assistant_prompts(run_id);
CREATE INDEX IF NOT EXISTS idx_assistant_prompts_intent ON assistant_prompts(intent_tag);
