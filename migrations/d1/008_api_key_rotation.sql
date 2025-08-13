-- API Key Rotation with Grace Period
-- Migration 008: Add grace period fields and audit logging

-- Add grace period fields to api_keys table
ALTER TABLE api_keys ADD COLUMN grace_secret_hash TEXT;
ALTER TABLE api_keys ADD COLUMN grace_expires_at INTEGER;

-- Create audit_log table for tracking key operations
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  metadata TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Create indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_subject ON audit_log(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_at ON audit_log(at);

-- Add index for grace period queries
CREATE INDEX IF NOT EXISTS idx_api_keys_grace_expires ON api_keys(grace_expires_at);
