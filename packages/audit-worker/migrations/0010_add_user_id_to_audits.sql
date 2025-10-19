-- Add user_id column to audits table
-- This links audits to authenticated users

ALTER TABLE audits ADD COLUMN user_id TEXT;

-- Create index for efficient user-based audit queries
CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits(user_id);

-- Create index for user + status queries
CREATE INDEX IF NOT EXISTS idx_audits_user_status ON audits(user_id, status);

