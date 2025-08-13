-- OTP-based Authentication Migration (Simplified)
-- Adds new tables for OTP-based authentication

-- Update user table to add is_admin column if it doesn't exist
ALTER TABLE user ADD COLUMN is_admin INTEGER DEFAULT 0 NOT NULL;

-- Create new session table for OTP auth
CREATE TABLE IF NOT EXISTS session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                    -- Keep TEXT to match existing user.id
  session_id TEXT NOT NULL UNIQUE,          -- random 128-bit base64url
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  ip_hash TEXT,                             -- sha256(ip)
  ua_hash TEXT                              -- sha256(ua)
);
CREATE INDEX IF NOT EXISTS idx_session_user ON session(user_id);
CREATE INDEX IF NOT EXISTS idx_session_id ON session(session_id);

-- Create one-time codes table for email login
CREATE TABLE IF NOT EXISTS login_code (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,                  -- sha256(code)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  attempts INTEGER DEFAULT 0,
  consumed_at TIMESTAMP,
  requester_ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_login_code_email ON login_code(email);
CREATE INDEX IF NOT EXISTS idx_login_code_expires ON login_code(expires_at);

-- Create user_settings table for user preferences (like demo toggle)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
