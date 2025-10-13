-- Phase Next: Assistant Visibility - AI Visibility Metrics
-- Daily aggregated metrics for assistant visibility tracking

CREATE TABLE IF NOT EXISTS ai_visibility_metrics (
  day TEXT NOT NULL, -- 'YYYY-MM-DD'
  project_id TEXT NOT NULL,
  assistant TEXT NOT NULL,
  mentions_count INTEGER NOT NULL,
  unique_urls INTEGER NOT NULL,
  mva_daily REAL NOT NULL,
  impression_estimate REAL NOT NULL,
  competitor_domains TEXT, -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (day, project_id, assistant)
);

CREATE INDEX IF NOT EXISTS idx_ai_visibility_metrics_project ON ai_visibility_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_visibility_metrics_assistant ON ai_visibility_metrics(assistant);
CREATE INDEX IF NOT EXISTS idx_ai_visibility_metrics_day ON ai_visibility_metrics(day);
