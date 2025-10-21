-- Add new columns to support Scorecard 2.0 category-based organization
-- Non-breaking migration: adds fields to restructure 21 checks into 6 practical categories

-- Note: If audit_criteria table doesn't exist (criteria are constants), 
-- these fields are added to TypeScript types only

-- Add category grouping (Content & Clarity, Structure & Organization, etc.)
-- ALTER TABLE audit_criteria ADD COLUMN category TEXT DEFAULT 'Uncategorized';

-- Add impact level for prioritization (High|Medium|Low)
-- ALTER TABLE audit_criteria ADD COLUMN impact_level TEXT DEFAULT 'Medium';

-- Add business-friendly "why it matters" copy for tooltips/UI
-- ALTER TABLE audit_criteria ADD COLUMN why_it_matters TEXT DEFAULT '';

-- Add references (JSON array of doc URLs for proof/citations)
-- ALTER TABLE audit_criteria ADD COLUMN refs TEXT DEFAULT '[]';

-- Indexes for grouping and sorting
-- CREATE INDEX IF NOT EXISTS idx_audit_criteria_category ON audit_criteria(category);
-- CREATE INDEX IF NOT EXISTS idx_audit_criteria_impact ON audit_criteria(impact_level);

-- NOTE: Currently criteria are defined as constants in code, not in a DB table.
-- This migration serves as documentation. The actual data model update is in TypeScript.
-- If we later move criteria to DB, uncomment the above statements.

-- Placeholder to ensure migration runs
SELECT 1 as scorecard_v2_migration_placeholder;

