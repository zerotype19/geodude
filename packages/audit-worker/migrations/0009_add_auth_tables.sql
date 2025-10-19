-- Migration: Add authentication tables for magic link auth
-- Created: 2025-10-19

-- Users table (email-based identity)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Magic tokens for passwordless auth
CREATE TABLE IF NOT EXISTS magic_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  intent TEXT NOT NULL,              -- 'start_audit' | 'open_audit' | 'general'
  audit_id TEXT,                      -- for 'open_audit' deep links
  payload_json TEXT,                  -- for 'start_audit' (pending audit params)
  redirect_path TEXT,                 -- optional override
  issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,                       -- null until consumed
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_magic_tokens_email ON magic_tokens(email);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_token_hash ON magic_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_expires ON magic_tokens(expires_at);

-- Sessions (long-lived, cookie-backed)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  auth_age_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  user_agent TEXT,
  ip_address TEXT,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Add user_id to audits table (only if audits table exists)
-- Note: This will fail silently if audits table doesn't exist yet
-- Run this manually after audits table is created if needed:
-- ALTER TABLE audits ADD COLUMN user_id TEXT;
-- CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits(user_id);

-- Rate limiting table (track magic link requests)
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key TEXT PRIMARY KEY,               -- email or IP address
  count INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_request_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_window ON auth_rate_limits(window_start);

