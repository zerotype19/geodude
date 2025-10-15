-- Add phase tracking and heartbeat fields to audits table
-- This enables monitoring and recovery of stuck audits

ALTER TABLE audits ADD COLUMN phase TEXT DEFAULT 'init';
ALTER TABLE audits ADD COLUMN phase_started_at TEXT;
ALTER TABLE audits ADD COLUMN phase_heartbeat_at TEXT;
ALTER TABLE audits ADD COLUMN phase_attempts INTEGER DEFAULT 0;
ALTER TABLE audits ADD COLUMN failure_code TEXT;
ALTER TABLE audits ADD COLUMN failure_detail TEXT;

-- Create indexes for efficient watchdog queries
CREATE INDEX idx_audits_phase_status ON audits(phase, status);
CREATE INDEX idx_audits_heartbeat ON audits(phase_heartbeat_at) WHERE status = 'running';
CREATE INDEX idx_audits_phase_started ON audits(phase_started_at) WHERE status = 'running';

-- Update existing running audits to have proper phase tracking
UPDATE audits 
SET phase = 'init', 
    phase_started_at = started_at,
    phase_heartbeat_at = started_at
WHERE status = 'running' AND phase IS NULL;
