-- Add org_id to api_key table for multi-tenancy
-- Migration 015: Add org_id to api_key

ALTER TABLE api_key ADD COLUMN org_id TEXT REFERENCES organization(id);

-- Update existing api_keys to have org_id from their project
UPDATE api_key 
SET org_id = (SELECT org_id FROM project WHERE project.id = api_key.project_id)
WHERE org_id IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_api_key_org ON api_key(org_id);
