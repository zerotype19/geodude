-- Add ai_flags_json column to store computed flags for quick access
ALTER TABLE audits ADD COLUMN ai_flags_json TEXT;

