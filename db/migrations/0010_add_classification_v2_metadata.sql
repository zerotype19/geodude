-- Add metadata column for classification_v2 and other extensible data
ALTER TABLE audit_page_analysis ADD COLUMN metadata TEXT;

-- Create index for faster metadata queries
CREATE INDEX IF NOT EXISTS idx_audit_page_analysis_metadata ON audit_page_analysis(metadata) WHERE metadata IS NOT NULL;

