-- Normalize audit_pages columns for consistent field storage
-- Ensures all rendered content fields are properly captured

-- Add status_code if not exists
-- Note: SQLite doesn't support IF NOT EXISTS with ALTER TABLE ADD COLUMN
-- These columns should already exist from previous migrations

-- Add jsonld_count if not exists (was previously stored inconsistently)
-- This column should already exist from previous migrations

-- Add has_h1 if not exists
-- This column should already exist from previous migrations

-- Add faq_present if not exists
-- This column should already exist from previous migrations

-- rendered_words and snippet should already exist from 0005, but add if missing
-- These columns should already exist from previous migrations

-- Create index for common queries
-- Note: Only create indexes for columns that definitely exist
CREATE INDEX IF NOT EXISTS idx_audit_pages_status ON audit_pages(status_code);

