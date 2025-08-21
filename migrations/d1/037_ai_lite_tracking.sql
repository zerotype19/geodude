-- AI-Lite Tracking System Migration
-- Adds tracking_mode to projects, sampled flag to events, and hourly rollups table

PRAGMA foreign_keys=OFF;

-- 1) Add tracking_mode to project table
ALTER TABLE project ADD COLUMN tracking_mode TEXT 
  CHECK (tracking_mode IN ('ai-lite','full')) 
  NOT NULL DEFAULT 'full';

-- 2) Add sampled column to interaction_events
ALTER TABLE interaction_events ADD COLUMN sampled INTEGER DEFAULT 0;

-- 3) Create traffic_rollup_hourly table
CREATE TABLE IF NOT EXISTS traffic_rollup_hourly (
  project_id TEXT NOT NULL,
  property_id INTEGER NOT NULL,
  ts_hour INTEGER NOT NULL,      -- UTC start-of-hour epoch seconds
  class TEXT NOT NULL,           -- 'human_via_ai' | 'ai_agent_crawl' | 'direct_human' | 'search' | ...
  events_count INTEGER NOT NULL DEFAULT 0,   -- counts EVERY event
  sampled_count INTEGER NOT NULL DEFAULT 0,  -- counts only when we also kept a row (sampled=1)
  PRIMARY KEY (project_id, property_id, ts_hour, class)
);

-- 4) Create index for efficient rollup queries
CREATE INDEX IF NOT EXISTS idx_trh_proj_hour_class
  ON traffic_rollup_hourly (project_id, ts_hour, class);

-- 5) Create index for property_id lookups
CREATE INDEX IF NOT EXISTS idx_trh_property
  ON traffic_rollup_hourly (property_id);

PRAGMA foreign_keys=ON;
