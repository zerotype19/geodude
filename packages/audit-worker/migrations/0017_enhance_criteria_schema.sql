-- Enhance scoring_criteria to match live score guide structure
-- Adds fields for examples, how-to, and better organization

-- Add missing columns
ALTER TABLE scoring_criteria ADD COLUMN points_possible INTEGER DEFAULT 100;
ALTER TABLE scoring_criteria ADD COLUMN importance_rank INTEGER; -- 1=Critical, 2=High, 3=Medium
ALTER TABLE scoring_criteria ADD COLUMN scoring_approach TEXT; -- "Automated analysis", "Manual review", etc.
ALTER TABLE scoring_criteria ADD COLUMN examples TEXT; -- Real examples of good/bad implementations
ALTER TABLE scoring_criteria ADD COLUMN view_in_ui TEXT; -- Where to find this in the UI
ALTER TABLE scoring_criteria ADD COLUMN common_issues TEXT; -- Common problems found
ALTER TABLE scoring_criteria ADD COLUMN quick_fixes TEXT; -- Actionable fix steps
ALTER TABLE scoring_criteria ADD COLUMN learn_more_links TEXT; -- JSON array of educational resources
ALTER TABLE scoring_criteria ADD COLUMN official_docs TEXT; -- JSON array of official documentation links
ALTER TABLE scoring_criteria ADD COLUMN display_order INTEGER; -- Order within category

-- Update existing records with better metadata
-- These should be populated with actual content from https://app.optiview.ai/score-guide

UPDATE scoring_criteria SET 
  importance_rank = CASE impact_level 
    WHEN 'High' THEN 1 
    WHEN 'Medium' THEN 2 
    WHEN 'Low' THEN 3 
  END,
  scoring_approach = CASE check_type
    WHEN 'html_dom' THEN 'Automated HTML analysis'
    WHEN 'llm' THEN 'AI-assisted content analysis'
    WHEN 'aggregation' THEN 'Site-wide metrics'
    WHEN 'manual' THEN 'Manual review'
  END,
  points_possible = 100
WHERE TRUE;

-- Add display order for cleaner UI presentation
UPDATE scoring_criteria SET display_order = 1 WHERE id = 'C1_title_quality';
UPDATE scoring_criteria SET display_order = 2 WHERE id = 'C2_meta_description';
UPDATE scoring_criteria SET display_order = 3 WHERE id = 'C3_h1_presence';
UPDATE scoring_criteria SET display_order = 4 WHERE id = 'A1_answer_first';
UPDATE scoring_criteria SET display_order = 5 WHERE id = 'A2_headings_semantic';
UPDATE scoring_criteria SET display_order = 6 WHERE id = 'A3_faq_presence';
UPDATE scoring_criteria SET display_order = 7 WHERE id = 'A4_schema_faqpage';
UPDATE scoring_criteria SET display_order = 8 WHERE id = 'A9_internal_linking';
UPDATE scoring_criteria SET display_order = 9 WHERE id = 'G10_canonical';
UPDATE scoring_criteria SET display_order = 10 WHERE id = 'T1_mobile_viewport';
UPDATE scoring_criteria SET display_order = 11 WHERE id = 'T2_lang_region';
UPDATE scoring_criteria SET display_order = 12 WHERE id = 'T3_noindex_robots';
UPDATE scoring_criteria SET display_order = 13 WHERE id = 'A12_entity_graph';

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_criteria_display_order ON scoring_criteria(category, display_order);

