-- Migration 040: Add classification audit fields to interaction_events
-- This migration adds metadata fields for classification auditing and debugging

-- Show current table structure first
PRAGMA table_info(interaction_events);

-- Add metadata columns if they don't exist (safe operation)
-- These will be populated by the hardened classifier v2
ALTER TABLE interaction_events ADD COLUMN metadata TEXT DEFAULT '{}';

-- Create index for efficient filtering by metadata fields
CREATE INDEX IF NOT EXISTS idx_ie_metadata_classification ON interaction_events(project_id, json_extract(metadata, '$.classification_reason'));

-- Show final table structure
PRAGMA table_info(interaction_events);

-- Note: The metadata column will store JSON with these fields:
-- {
--   "referrer_host": "lowercased_host",
--   "referrer_path": "raw_path_max_256",
--   "classification_reason": "string",
--   "classification_confidence": 0.95
-- }
