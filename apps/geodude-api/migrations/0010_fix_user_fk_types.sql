-- Fix user.id type mismatch: standardize on INTEGER with proper FK constraints
-- This migration fixes session.user_id and user_settings.user_id to be INTEGER FKs

PRAGMA foreign_keys=OFF;

-- SESSION: ensure user_id is INTEGER FK → user(id)
-- Create new session table with INTEGER user_id under a temp name
CREATE TABLE IF NOT EXISTS session_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  ip_hash TEXT,
  ua_hash TEXT,
  FOREIGN KEY(user_id) REFERENCES user(id)
);

-- If the old session table exists, copy rows (casting user_id) then drop old.
-- The copy will succeed only if old table exists with the expected cols.
INSERT INTO session_new (id, user_id, session_id, created_at, expires_at, ip_hash, ua_hash)
SELECT id, CAST(user_id AS INTEGER), session_id, created_at, expires_at, ip_hash, ua_hash
FROM session;

DROP TABLE IF EXISTS session;
ALTER TABLE session_new RENAME TO session;

-- USER_SETTINGS: ensure user_id is INTEGER and PK(user_id, key)
CREATE TABLE IF NOT EXISTS user_settings_new (
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, key),
  FOREIGN KEY(user_id) REFERENCES user(id)
);

INSERT INTO user_settings_new (user_id, key, value, updated_at)
SELECT CAST(user_id AS INTEGER), key, value, updated_at
FROM user_settings;

DROP TABLE IF EXISTS user_settings;
ALTER TABLE user_settings_new RENAME TO user_settings;

PRAGMA foreign_keys=ON;
