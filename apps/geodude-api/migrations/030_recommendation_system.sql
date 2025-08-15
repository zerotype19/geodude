-- RECOMMENDATIONS v1 - Database migration
-- Creates recommendation_override table and required indexes

-- Create helpful indexes for recommendation queries (no breaking changes)
CREATE INDEX IF NOT EXISTS idx_ie_proj_time ON interaction_events(project_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ref_proj_time ON ai_referrals(project_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_conv_proj_time ON conversion_event(project_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ie_content_time ON interaction_events(content_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ref_content_time ON ai_referrals(content_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_conv_content_time ON conversion_event(content_id, occurred_at);

-- Additional indexes for recommendation queries
CREATE INDEX IF NOT EXISTS idx_ie_metadata_class ON interaction_events(project_id, occurred_at, json_extract(metadata, '$.class'));
CREATE INDEX IF NOT EXISTS idx_pas_enabled ON project_ai_sources(project_id, enabled);
CREATE INDEX IF NOT EXISTS idx_rules_suggestions_status ON rules_suggestions(project_id, status);

-- Create recommendation_override table (persist overrides only)
CREATE TABLE IF NOT EXISTS recommendation_override (
  project_id TEXT NOT NULL,
  rec_id     TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('open','dismissed','resolved')),
  note       TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, rec_id)
);

CREATE INDEX IF NOT EXISTS idx_reco_override_proj ON recommendation_override(project_id);
