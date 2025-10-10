-- Normalize audit_pages columns for consistent field storage
-- Ensures all rendered content fields are properly captured

-- Add status_code if not exists
ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS status_code INTEGER DEFAULT 0;

-- Add jsonld_count if not exists (was previously stored inconsistently)
ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS jsonld_count INTEGER DEFAULT 0;

-- Add has_h1 if not exists
ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS has_h1 INTEGER DEFAULT 0;

-- Add faq_present if not exists
ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS faq_present INTEGER DEFAULT 0;

-- rendered_words and snippet should already exist from 0005, but add if missing
ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS rendered_words INTEGER DEFAULT 0;
ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS snippet TEXT;

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_pages_status ON audit_pages(status_code);
CREATE INDEX IF NOT EXISTS idx_audit_pages_jsonld ON audit_pages(jsonld_count);

