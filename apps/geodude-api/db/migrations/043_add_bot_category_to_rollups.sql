-- Migration 043: Add bot_category to rollups for crawler subtype tracking
-- This enables proper segmentation of crawler traffic by bot category

-- Add bot_category column
ALTER TABLE traffic_rollup_hourly ADD COLUMN bot_category TEXT DEFAULT NULL;

-- Drop existing unique index if it exists
DROP INDEX IF EXISTS idx_rollup_unique;

-- Create new unique index that includes bot_category
CREATE UNIQUE INDEX idx_rollup_unique 
  ON traffic_rollup_hourly(project_id, property_id, ts_hour, class, COALESCE(bot_category,''));

-- Add helpful filter index for bot category queries
CREATE INDEX IF NOT EXISTS idx_rollup_bot_cat 
  ON traffic_rollup_hourly(project_id, ts_hour, bot_category);

-- Add index for efficient crawler queries
CREATE INDEX IF NOT EXISTS idx_rollup_crawler 
  ON traffic_rollup_hourly(project_id, ts_hour, class, bot_category) 
  WHERE class = 'crawler';
