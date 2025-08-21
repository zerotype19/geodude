-- Migration 043: Update ai_citation_event schema for real citations pipeline
-- This migration adds required fields to support proper citation tracking

-- Add missing fields to ai_citation_event table
ALTER TABLE ai_citation_event ADD COLUMN property_id INTEGER;
ALTER TABLE ai_citation_event ADD COLUMN content_id INTEGER;
ALTER TABLE ai_citation_event ADD COLUMN ai_source_id INTEGER;
ALTER TABLE ai_citation_event ADD COLUMN answer_url TEXT;
ALTER TABLE ai_citation_event ADD COLUMN snippet TEXT;
ALTER TABLE ai_citation_event ADD COLUMN evidence_type TEXT DEFAULT 'manual';
ALTER TABLE ai_citation_event ADD COLUMN occurred_at TEXT;
ALTER TABLE ai_citation_event ADD COLUMN created_at TEXT DEFAULT (datetime('now'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ace_property_time ON ai_citation_event(property_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ace_content ON ai_citation_event(content_id);
CREATE INDEX IF NOT EXISTS idx_ace_source ON ai_citation_event(ai_source_id);
CREATE INDEX IF NOT EXISTS idx_ace_evidence ON ai_citation_event(evidence_type);

-- Add foreign key constraints (if they don't exist)
-- Note: SQLite doesn't enforce foreign keys by default, but we'll add them for documentation

-- Update existing rows to set created_at if null
UPDATE ai_citation_event SET created_at = datetime(ts/1000, 'unixepoch') WHERE created_at IS NULL;

-- Set occurred_at to ts if not set
UPDATE ai_citation_event SET occurred_at = datetime(ts/1000, 'unixepoch') WHERE occurred_at IS NULL;

-- Show updated schema
PRAGMA table_info(ai_citation_event);

-- Show indexes
PRAGMA index_list(ai_citation_event);
