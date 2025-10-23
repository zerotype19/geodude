-- 0026_add_audit_public_flag.sql
-- Add is_public flag to audits table to enable public sharing

ALTER TABLE audits ADD COLUMN is_public INTEGER DEFAULT 0;

-- Index for efficient public audit queries
CREATE INDEX idx_audits_is_public ON audits (is_public, id);

-- Note: SQLite uses INTEGER for booleans (0 = false, 1 = true)

