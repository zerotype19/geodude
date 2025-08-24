-- Add session context columns for project switching
-- This migration adds the missing columns that were supposed to be in 0006_session_context.sql

ALTER TABLE session ADD COLUMN current_org_id TEXT;
ALTER TABLE session ADD COLUMN current_project_id TEXT;

-- Add index for faster context lookups
CREATE INDEX IF NOT EXISTS idx_session_context ON session(current_org_id, current_project_id);
