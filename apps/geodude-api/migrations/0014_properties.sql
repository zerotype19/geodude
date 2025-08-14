-- Properties table for onboarding flow
-- Migration 014: Add properties table

CREATE TABLE IF NOT EXISTS property (
  id TEXT PRIMARY KEY,               -- prop_<nanoid>
  project_id TEXT NOT NULL REFERENCES project(id),
  domain TEXT NOT NULL,
  name TEXT,
  created_ts INTEGER NOT NULL,
  updated_ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_property_project ON property(project_id);
CREATE INDEX IF NOT EXISTS idx_property_domain ON property(domain);

-- Add property_id to edge_click_event if it doesn't exist
ALTER TABLE edge_click_event ADD COLUMN property_id TEXT REFERENCES property(id);
