-- 0005_rendered_content.sql
-- Add rendered content fields for accurate word counts and diagnostics

-- audit_pages: store rendered text stats
ALTER TABLE audit_pages ADD COLUMN rendered_words INTEGER DEFAULT 0;
ALTER TABLE audit_pages ADD COLUMN snippet TEXT;

-- audit_issues: already has details TEXT, but ensure it exists
-- (Safe to run even if column exists - will just skip)

