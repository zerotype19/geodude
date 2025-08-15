-- Add missing columns for API key rotation with grace period
ALTER TABLE api_key ADD COLUMN grace_hash TEXT;
ALTER TABLE api_key ADD COLUMN grace_expires_ts INTEGER;

-- Add helpful indexes for API key management
CREATE INDEX IF NOT EXISTS idx_api_key_revoked ON api_key(revoked_ts);
CREATE INDEX IF NOT EXISTS idx_api_key_last_used ON api_key(last_used_ts);
