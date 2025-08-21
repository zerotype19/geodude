-- Add class column to interaction_events table
-- This stores the traffic classification result to avoid re-classification in GET requests

PRAGMA foreign_keys=OFF;

-- Add class column to store traffic classification
ALTER TABLE interaction_events ADD COLUMN class TEXT;

-- Create index for efficient filtering by class
CREATE INDEX IF NOT EXISTS idx_ie_class ON interaction_events(project_id, class);

-- Create index for efficient filtering by class and time
CREATE INDEX IF NOT EXISTS idx_ie_class_time ON interaction_events(project_id, class, occurred_at);

PRAGMA foreign_keys=ON;
