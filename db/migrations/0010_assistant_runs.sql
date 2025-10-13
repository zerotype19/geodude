-- Phase Next: Assistant Visibility - Assistant Runs
-- Track assistant query runs and their status

CREATE TABLE IF NOT EXISTS assistant_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  assistant TEXT NOT NULL, -- 'perplexity' | 'chatgpt_search' | 'copilot'
  run_started_at TEXT NOT NULL, -- ISO8601
  run_duration_ms INTEGER,
  status TEXT NOT NULL, -- 'queued' | 'running' | 'success' | 'error'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assistant_runs_project ON assistant_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_assistant_runs_assistant ON assistant_runs(assistant);
CREATE INDEX IF NOT EXISTS idx_assistant_runs_status ON assistant_runs(status);
CREATE INDEX IF NOT EXISTS idx_assistant_runs_started ON assistant_runs(run_started_at);
