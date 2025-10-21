-- Industry Lock Migration
-- Add fields to lock industry at audit level

-- Add industry column to store the locked industry value
ALTER TABLE audits ADD COLUMN industry TEXT;

-- Add industry_source to track how industry was determined
-- Values: 'override' | 'domain_rules' | 'heuristics' | 'default'
ALTER TABLE audits ADD COLUMN industry_source TEXT;

-- Add industry_locked flag (always 1 for locked)
ALTER TABLE audits ADD COLUMN industry_locked INTEGER DEFAULT 1;

-- Create index for fast industry lookups
CREATE INDEX idx_audits_industry ON audits(industry);

-- Verification query
SELECT 'Industry lock migration complete - 3 columns added to audits table' as status;
