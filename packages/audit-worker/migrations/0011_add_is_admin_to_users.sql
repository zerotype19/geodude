-- Add is_admin column to users table
-- This column determines if a user has admin privileges

ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;

-- Create index for efficient admin user queries
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Set your email as admin (update this to your actual email)
UPDATE users SET is_admin = 1 WHERE email = 'kevin.mcgovern@gmail.com';

