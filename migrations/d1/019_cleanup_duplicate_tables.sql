-- Clean up duplicate and unused tables
-- This migration documents the removal of conflicting table schemas

-- Drop the old 'org' table (INTEGER IDs, TIMESTAMP fields)
-- This table was not being used and had conflicting schema with 'organization'
DROP TABLE IF EXISTS org;

-- Drop the old 'org_members' table (INTEGER IDs, references org(id))
-- This table was not being used and had conflicting schema with 'org_member'
DROP TABLE IF EXISTS org_members;

-- Drop the old 'invites' table (INTEGER IDs, references org(id))
-- This table was not being used and had conflicting schema
DROP TABLE IF EXISTS invites;

-- Note: The following tables are kept and actively used:
-- - organization (TEXT IDs, INTEGER timestamps)
-- - org_member (TEXT IDs, references organization(id))
-- - project (TEXT IDs, references organization(id))
-- - api_key (TEXT IDs, references organization(id))
