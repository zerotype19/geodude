-- Clean up duplicate project and property tables
-- This migration documents the removal of conflicting table schemas

-- Drop the old 'project_settings' table (unused functionality)
-- This table contained retention policies, plan tiers, etc. that aren't being used
DROP TABLE IF EXISTS project_settings;

-- Drop the old 'properties' table (INTEGER IDs, TIMESTAMP fields)
-- This table was not being used and had conflicting schema with 'property'
-- It was referenced by content_assets and api_keys tables, but those aren't active
DROP TABLE IF EXISTS properties;

-- Note: The following tables are kept and actively used:
-- - project (TEXT IDs, references organization(id))
-- - property (TEXT IDs, references project(id))
-- - api_key (TEXT IDs, references organization(id) and project(id))

-- The current architecture uses:
-- - TEXT IDs consistently across all tables
-- - INTEGER timestamps (created_ts, updated_ts)
-- - Proper foreign key relationships
