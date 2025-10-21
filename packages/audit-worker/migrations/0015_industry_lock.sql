-- Industry Lock Migration
-- Add fields to lock industry at audit level

-- Add industry fields to audits table (if not already present from Phase Next)
ALTER TABLE audits ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS industry_source TEXT; 
-- Values: 'override' | 'domain_rules' | 'heuristics' | 'default'
ALTER TABLE audits ADD COLUMN IF NOT EXISTS industry_locked INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_audits_industry ON audits(industry);

-- Add industry override to projects table (optional)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS industry_override TEXT;

-- Migration complete
SELECT 'Industry lock migration complete - columns added to audits and projects' as status;

