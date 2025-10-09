-- v0.13: Multi-project onboarding
-- Add self-service project creation and domain verification

-- projects: add owner email (api_key already exists)
ALTER TABLE projects ADD COLUMN owner_email TEXT;

-- properties: add verification fields (verified already exists)
ALTER TABLE properties ADD COLUMN verify_method TEXT;   -- 'dns' | 'html'
ALTER TABLE properties ADD COLUMN verify_token TEXT;    -- prop_id or random

