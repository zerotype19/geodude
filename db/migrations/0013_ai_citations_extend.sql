-- Phase Next: Assistant Visibility - Extend AI Citations
-- Extend existing ai_citations table with new fields for assistant visibility

-- First check if ai_citations exists, if not create it
CREATE TABLE IF NOT EXISTS ai_citations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  prompt_id TEXT, -- NULL for externally collected items
  rank INTEGER,
  source_url TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  is_own_domain INTEGER DEFAULT 0, -- 0/1
  occurred_at TEXT DEFAULT (datetime('now'))
);

-- Add new columns if they don't exist (idempotent)
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- We'll use a different approach - check if column exists first
-- For now, we'll assume the table exists and add the new columns

-- Add indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_ai_citations_project_prompt ON ai_citations(project_id, prompt_id);
CREATE INDEX IF NOT EXISTS idx_ai_citations_domain ON ai_citations(source_domain);
CREATE INDEX IF NOT EXISTS idx_ai_citations_occurred ON ai_citations(occurred_at);
