-- Add progress tracking columns to visibility_runs
ALTER TABLE visibility_runs ADD COLUMN progress INTEGER DEFAULT 0;
ALTER TABLE visibility_runs ADD COLUMN heartbeat_at TEXT;
ALTER TABLE visibility_runs ADD COLUMN error TEXT;

-- Add index for heartbeat monitoring
CREATE INDEX IF NOT EXISTS idx_vi_runs_heartbeat ON visibility_runs(heartbeat_at);

-- Create vi_logs table for debugging
CREATE TABLE IF NOT EXISTS vi_logs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  intent_id TEXT,
  source TEXT,
  event TEXT NOT NULL,
  detail TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES visibility_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_vi_logs_run_id ON vi_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_vi_logs_created_at ON vi_logs(created_at);
