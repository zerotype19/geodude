-- Migration: Remove old redirect architecture tables and columns
-- This cleans up the database for the new vision

-- Remove old redirect tables
DROP TABLE IF EXISTS pid_map;
DROP TABLE IF EXISTS custom_hosts;

-- Remove old columns from project table
-- Note: SQLite doesn't support DROP COLUMN, so we'll recreate the table
CREATE TABLE project_new (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    domain TEXT,
    created_ts INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Copy existing data (excluding public_handle)
INSERT INTO project_new (id, org_id, name, slug, domain, created_ts)
SELECT id, org_id, name, slug, domain, created_ts FROM project;

-- Drop old table and rename new one
DROP TABLE project;
ALTER TABLE project_new RENAME TO project;

-- Remove old indexes
DROP INDEX IF EXISTS idx_project_public_handle;
DROP INDEX IF EXISTS idx_pid_map_project_pid;
DROP INDEX IF EXISTS idx_custom_hosts_project;
