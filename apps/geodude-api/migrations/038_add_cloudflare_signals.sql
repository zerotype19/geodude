-- Migration 038: Add Cloudflare signals columns
-- This migration adds new CF signal columns for enhanced bot detection

-- Add the new Cloudflare signal columns
ALTER TABLE interaction_events ADD COLUMN cf_verified_bot INTEGER NOT NULL DEFAULT 0;
ALTER TABLE interaction_events ADD COLUMN cf_verified_bot_category TEXT;
ALTER TABLE interaction_events ADD COLUMN cf_asn INTEGER;
ALTER TABLE interaction_events ADD COLUMN cf_org TEXT;
ALTER TABLE interaction_events ADD COLUMN ppc_request_headers TEXT;
ALTER TABLE interaction_events ADD COLUMN ppc_response_headers TEXT;

-- Add a dedicated signals column for better performance (JSON array of strings)
ALTER TABLE interaction_events ADD COLUMN signals TEXT;

-- Create indexes for the new CF fields
CREATE INDEX IF NOT EXISTS idx_events_cf_verified ON interaction_events(cf_verified_bot);
CREATE INDEX IF NOT EXISTS idx_events_cf_cat ON interaction_events(cf_verified_bot_category);
CREATE INDEX IF NOT EXISTS idx_events_cf_asn ON interaction_events(cf_asn);

-- Create index for the new signals column
CREATE INDEX IF NOT EXISTS idx_events_signals ON interaction_events(signals);

-- Add foreign key constraint for property_id if the properties table exists
-- (This will be added in a separate migration if needed)
