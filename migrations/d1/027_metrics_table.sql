-- Create metrics table for tracking content operations and other metrics
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient key lookups
CREATE INDEX IF NOT EXISTS idx_metrics_key ON metrics(key);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_metrics_created ON metrics(created_at);
