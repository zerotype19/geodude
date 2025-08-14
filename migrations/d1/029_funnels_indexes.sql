-- Add required indexes for funnels system
-- These indexes support efficient funnel queries and attribution logic

-- Conversion event indexes for time-based queries
CREATE INDEX IF NOT EXISTS idx_conv_content_time ON conversion_event(content_id, occurred_at);

-- AI referrals indexes for time-based queries and attribution
CREATE INDEX IF NOT EXISTS idx_ref_content_time ON ai_referrals(content_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_ref_source_time ON ai_referrals(ai_source_id, detected_at);

-- Additional indexes for funnel performance
CREATE INDEX IF NOT EXISTS idx_conv_project_content_time ON conversion_event(project_id, content_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ref_project_content_time ON ai_referrals(project_id, content_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_ref_project_source_time ON ai_referrals(project_id, ai_source_id, detected_at);
