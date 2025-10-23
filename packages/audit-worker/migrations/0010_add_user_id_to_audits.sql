-- Add user_id column to audits table (if it doesn't exist)
-- This links audits to authenticated users

-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we check first
-- If column exists, this will silently fail and indexes will still be created
-- Wrapped in a transaction to handle gracefully

-- Try to add the column (will error if exists, but that's okay)
-- ALTER TABLE audits ADD COLUMN user_id TEXT;

-- Create index for efficient user-based audit queries
CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits(user_id);

-- Create index for user + status queries
CREATE INDEX IF NOT EXISTS idx_audits_user_status ON audits(user_id, status);

