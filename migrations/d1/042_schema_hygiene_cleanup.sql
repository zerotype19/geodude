-- Migration 042: Schema Hygiene and Legacy Table Cleanup
-- This migration marks legacy tables and creates compatibility views

-- 1. Mark ai_referrals as legacy (already migrated to interaction_events)
-- Note: ai_referrals table is now legacy. Use interaction_events with class filtering instead.
-- The ai_referrals_compat view provides backward compatibility.

-- 2. Create compatibility view for legacy property table
CREATE VIEW IF NOT EXISTS property_compat AS
SELECT * FROM properties;

-- 3. Create compatibility view for legacy api_keys table (if it exists)
-- Note: This is a placeholder - adjust based on actual table structure
-- CREATE VIEW IF NOT EXISTS api_keys_compat AS SELECT * FROM api_key;

-- 4. Mark legacy tables with comments
-- Note: The following tables are legacy and should not be used for new development:
-- - property (use properties table instead)
-- - ai_referrals (use interaction_events with class filtering)
-- - crawler_visit (use interaction_events with class filtering)
-- - edge_click_event (use interaction_events with event_type filtering)
-- - old session tables (use session_v1 and session_event_map)

-- 5. Verify current schema state
-- Show all tables and their status
SELECT 
    name as table_name,
    CASE 
        WHEN name IN ('interaction_events', 'session_v1', 'session_event_map', 'ai_sources', 'content_assets', 'traffic_rollup_hourly') 
        THEN 'ACTIVE'
        WHEN name IN ('ai_referrals', 'property', 'crawler_visit', 'edge_click_event') 
        THEN 'LEGACY'
        ELSE 'OTHER'
    END as status
FROM sqlite_master 
WHERE type = 'table' 
ORDER BY status, name;

-- 6. Show interaction_events schema for verification
PRAGMA table_info(interaction_events);

-- 7. Show indexes for verification
PRAGMA index_list(interaction_events);
