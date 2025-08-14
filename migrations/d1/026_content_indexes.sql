-- Speeds up list/detail queries
CREATE INDEX IF NOT EXISTS idx_content_assets_url ON content_assets(url);
CREATE INDEX IF NOT EXISTS idx_content_assets_created ON content_assets(created_at);

-- event/referral windows
CREATE INDEX IF NOT EXISTS idx_ie_project_time ON interaction_events(project_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ie_content_time ON interaction_events(content_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ref_project_time ON ai_referrals(project_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_ref_content_time ON ai_referrals(content_id, detected_at);
