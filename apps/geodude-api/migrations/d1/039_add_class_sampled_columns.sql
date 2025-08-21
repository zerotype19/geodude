-- Migration 039: Ensure class and sampled columns exist and add indexes
-- This migration safely handles existing columns and adds necessary indexes

-- Show current table structure first
PRAGMA table_info(interaction_events);

-- Create indexes only if they don't exist (safe operation)
CREATE INDEX IF NOT EXISTS idx_ie_class ON interaction_events(project_id, class);
CREATE INDEX IF NOT EXISTS idx_ie_class_time ON interaction_events(project_id, class, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ie_sampled ON interaction_events(project_id, sampled);

-- Show final table structure
PRAGMA table_info(interaction_events);
