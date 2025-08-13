-- Project settings for retention, plan tiers, and features
-- Migration 007: Add project_settings table

CREATE TABLE IF NOT EXISTS project_settings (
  project_id INTEGER PRIMARY KEY,
  retention_days_events INTEGER DEFAULT 180,
  retention_days_referrals INTEGER DEFAULT 365,
  plan_tier TEXT DEFAULT 'free',
  xray_trace_enabled INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(project_id) REFERENCES project(id) ON DELETE CASCADE
);

-- Add admin flag to user table
ALTER TABLE user ADD COLUMN is_admin INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_settings_plan_tier ON project_settings(plan_tier);
CREATE INDEX IF NOT EXISTS idx_user_is_admin ON user(is_admin);

-- Insert default settings for existing projects
INSERT OR IGNORE INTO project_settings (project_id, retention_days_events, retention_days_referrals, plan_tier, xray_trace_enabled)
SELECT id, 180, 365, 'free', 0 FROM project;
