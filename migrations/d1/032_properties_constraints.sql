-- Properties constraints and indexes
-- Ensure domain uniqueness per project and add missing defaults

-- Enforce uniqueness per project
CREATE UNIQUE INDEX IF NOT EXISTS ux_properties_project_domain
  ON properties(project_id, domain);

-- Add index for faster project-based queries
CREATE INDEX IF NOT EXISTS idx_properties_project_created
  ON properties(project_id, created_ts DESC);
