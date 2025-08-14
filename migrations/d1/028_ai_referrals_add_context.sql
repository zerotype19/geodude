-- Add optional context columns to ai_referrals table
-- These are non-breaking additions for enhanced UI/details

-- Add ref_url column for storing the AI platform URL
ALTER TABLE ai_referrals ADD COLUMN ref_url TEXT;

-- Add metadata column for storing additional context (JSON, sanitized)
ALTER TABLE ai_referrals ADD COLUMN metadata TEXT;

-- Add helpful indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_referrals_source_time ON ai_referrals(ai_source_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_ai_referrals_content_time ON ai_referrals(content_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_ai_referrals_project_time ON ai_referrals(project_id, detected_at);
