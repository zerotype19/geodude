-- Add current context columns to session table
-- Stores user's current org/project selection for multi-tenant scoping

ALTER TABLE session ADD COLUMN current_org_id TEXT;
ALTER TABLE session ADD COLUMN current_project_id TEXT;
