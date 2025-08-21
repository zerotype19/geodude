-- Migration 041: Create compatibility view for ai_referrals
-- This migration creates a view that maps ai_referrals to interaction_events
-- for backward compatibility during the migration period

-- Create compatibility view for ai_referrals
CREATE VIEW IF NOT EXISTS ai_referrals_compat AS
SELECT 
    ie.id,
    ie.project_id,
    ie.content_id,
    ie.ai_source_id,
    ie.occurred_at as detected_at,
    ie.class as event_class,
    COALESCE(json_extract(ie.metadata, '$.referrer_url'), '') as referrer_url,
    COALESCE(json_extract(ie.metadata, '$.referrer_host'), '') as referrer_host,
    COALESCE(json_extract(ie.metadata, '$.classification_reason'), '') as classification_reason,
    COALESCE(json_extract(ie.metadata, '$.classification_confidence'), 0.0) as classification_confidence,
    COALESCE(json_extract(ie.metadata, '$.debug'), '[]') as debug,
    ie.metadata
FROM interaction_events ie
WHERE ie.class IN ('ai_agent_crawl', 'human_via_ai');

-- Add comment to mark ai_referrals as legacy
-- Note: This table is now legacy. Use interaction_events with class filtering instead.
-- The ai_referrals_compat view provides backward compatibility.
