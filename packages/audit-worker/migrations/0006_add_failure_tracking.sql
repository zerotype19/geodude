-- Add failure tracking columns to audits table
ALTER TABLE audits ADD COLUMN fail_reason TEXT;
ALTER TABLE audits ADD COLUMN fail_at TEXT;

