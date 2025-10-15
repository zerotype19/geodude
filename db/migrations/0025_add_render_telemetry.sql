-- Add render/HTTP telemetry columns to audit_pages table
-- This enables Trust score calculation from actual render data

ALTER TABLE audit_pages ADD COLUMN status_code INTEGER;
ALTER TABLE audit_pages ADD COLUMN load_ms INTEGER;
ALTER TABLE audit_pages ADD COLUMN content_type TEXT;

-- Optional index to speed aggregates for Trust score calculation
CREATE INDEX IF NOT EXISTS idx_audit_pages_status ON audit_pages(audit_id, status_code);
CREATE INDEX IF NOT EXISTS idx_audit_pages_load_ms ON audit_pages(audit_id, load_ms) WHERE load_ms IS NOT NULL;
