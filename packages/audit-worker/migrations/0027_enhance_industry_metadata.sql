-- Enhance Industry Metadata
-- Add V2 hierarchical taxonomy metadata to audits table

-- 1. Add confidence score (0.0-1.0) from AI classifier
ALTER TABLE audits ADD COLUMN industry_confidence REAL;

-- 2. Add hierarchical ancestors as JSON array
-- Example: ["health.pharma.brand", "health.pharma", "health"]
-- Allows quick access to full taxonomy path without re-computing
ALTER TABLE audits ADD COLUMN industry_ancestors TEXT;

-- 3. Add metadata JSON for extensible classification data
-- Stores: alternative classifications, heuristic votes, schema boost, etc.
-- Example: {"alts": [{"slug": "healthcare_provider", "conf": 0.12}], "heuristics_agree": true}
ALTER TABLE audits ADD COLUMN industry_metadata TEXT;

-- Create index for confidence-based queries (e.g., find low-confidence audits)
CREATE INDEX idx_audits_industry_confidence ON audits(industry_confidence) WHERE industry_confidence IS NOT NULL;

-- Create index for fast ancestor lookups (useful for analytics)
CREATE INDEX idx_audits_industry_ancestors ON audits(industry_ancestors) WHERE industry_ancestors IS NOT NULL;

-- Verification query
SELECT 
  'Industry metadata migration complete' as status,
  '3 new columns added: industry_confidence, industry_ancestors, industry_metadata' as details;

