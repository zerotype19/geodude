-- Phase Next: Assistant Visibility - Assistant Outputs
-- Store raw responses and parsed data from assistant queries

CREATE TABLE IF NOT EXISTS assistant_outputs (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL REFERENCES assistant_prompts(id) ON DELETE CASCADE,
  raw_payload TEXT NOT NULL, -- html/json as string
  parse_version TEXT,
  parsed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assistant_outputs_prompt ON assistant_outputs(prompt_id);
CREATE INDEX IF NOT EXISTS idx_assistant_outputs_parsed ON assistant_outputs(parsed_at);
