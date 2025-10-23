-- Add composite_score to audits table for dashboard display
ALTER TABLE audits ADD COLUMN composite_score REAL;

-- Create index for faster queries on the dashboard
CREATE INDEX IF NOT EXISTS idx_audits_composite_score ON audits(composite_score);

