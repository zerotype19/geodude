-- Add async citations tracking to audits table
-- Migration: 0023_add_citations_async.sql

-- Add citations_status column to track async citation processing
-- Values: null (not queued), 'queued', 'processing', 'completed', 'failed'
ALTER TABLE audits ADD COLUMN citations_status TEXT DEFAULT NULL;

-- Add citations_queued_at timestamp
ALTER TABLE audits ADD COLUMN citations_queued_at TEXT DEFAULT NULL;

-- Add citations_started_at timestamp  
ALTER TABLE audits ADD COLUMN citations_started_at TEXT DEFAULT NULL;

-- Add citations_completed_at timestamp
ALTER TABLE audits ADD COLUMN citations_completed_at TEXT DEFAULT NULL;

-- Add citations_error for tracking failure reasons
ALTER TABLE audits ADD COLUMN citations_error TEXT DEFAULT NULL;

-- Create index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_audits_citations_queue 
ON audits(citations_status, citations_queued_at) 
WHERE citations_status IN ('queued', 'processing');

-- Backfill: Mark all completed audits that have citations_runs as 'completed'
-- (Done separately after migration via script)

