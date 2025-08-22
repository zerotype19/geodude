-- Migration 044: Add bot_category to interaction_events for detailed crawler tracking
-- This enables proper storage of bot category information from the v3 classifier

-- Add bot_category column
ALTER TABLE interaction_events ADD COLUMN bot_category TEXT DEFAULT NULL;

-- Add index for efficient bot category queries
CREATE INDEX IF NOT EXISTS idx_interaction_bot_category
  ON interaction_events(project_id, class, bot_category)
  WHERE class = 'crawler';

-- Add index for bot category filtering
CREATE INDEX IF NOT EXISTS idx_interaction_bot_cat_filter
  ON interaction_events(project_id, bot_category);
