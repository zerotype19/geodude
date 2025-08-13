-- OTP-based Authentication Migration
-- Replaces magic link auth with email code (OTP) system

-- Update user table to add is_admin column and standardize timestamps
ALTER TABLE user ADD COLUMN is_admin INTEGER DEFAULT 0 NOT NULL;

-- Create new session table for OTP auth (replaces old session table)
CREATE TABLE IF NOT EXISTS session_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                    -- Keep TEXT to match existing user.id
  session_id TEXT NOT NULL UNIQUE,          -- random 128-bit base64url
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  ip_hash TEXT,                             -- sha256(ip)
  ua_hash TEXT,                             -- sha256(ua)
  FOREIGN KEY(user_id) REFERENCES user(id)
);
CREATE INDEX IF NOT EXISTS idx_session_user ON session_new(user_id);
CREATE INDEX IF NOT EXISTS idx_session_id ON session_new(session_id);

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
  PRIMARY KEY(user_id, key),
  FOREIGN KEY(user_id) REFERENCES user(id)
);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- Migrate existing session data if any exists
-- (This will be empty in most cases, but safe to run)
INSERT OR IGNORE INTO session_new (user_id, session_id, created_at, expires_at, ip_hash, ua_hash)
SELECT 
  user_id,
  id,  -- Use old session id as new session_id
  datetime(created_ts / 1000, 'unixepoch'),
  datetime(expires_ts / 1000, 'unixepoch'),
  NULL,  -- No IP hash in old data
  NULL   -- No UA hash in old data
FROM session
WHERE expires_ts > (strftime('%s', 'now') * 1000);

-- Drop old session table
DROP TABLE IF EXISTS session;

-- Rename new session table to standard name
ALTER TABLE session_new RENAME TO session;

-- Drop old magic_link table (no longer needed)
DROP TABLE IF EXISTS magic_link;
