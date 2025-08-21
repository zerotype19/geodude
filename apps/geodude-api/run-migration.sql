-- Run migration to add class column to interaction_events table
-- This is needed for the hardened AI detection system

PRAGMA foreign_keys=OFF;

-- Add class column to store traffic classification
ALTER TABLE interaction_events ADD COLUMN class TEXT;

-- Create index for efficient filtering by class
CREATE INDEX IF NOT EXISTS idx_ie_class ON interaction_events(project_id, class);

-- Create index for efficient filtering by class and time
CREATE INDEX IF NOT EXISTS idx_ie_class_time ON interaction_events(project_id, class, occurred_at);

-- Add sampled column if it doesn't exist
ALTER TABLE interaction_events ADD COLUMN sampled INTEGER DEFAULT 0;

PRAGMA foreign_keys=ON;

-- Verify the changes
SELECT sql FROM sqlite_master WHERE type='table' AND name='interaction_events';
