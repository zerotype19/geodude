-- Citations runs logging table for analytics and monitoring
CREATE TABLE IF NOT EXISTS citations_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  total_queries INTEGER NOT NULL DEFAULT 0,
  total_citations INTEGER NOT NULL DEFAULT 0,
  cited_pct REAL NOT NULL DEFAULT 0,
  by_source TEXT NOT NULL DEFAULT '{}', -- JSON object with source breakdown
  errors_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' -- 'running', 'completed', 'error'
);

CREATE INDEX IF NOT EXISTS idx_citations_runs_proj_dom
ON citations_runs (project_id, domain, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_citations_runs_status
ON citations_runs (status, started_at DESC);
