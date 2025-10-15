-- Add phase_state column to audits table for tracking phase-specific state
ALTER TABLE audits ADD COLUMN phase_state TEXT DEFAULT '{}';
