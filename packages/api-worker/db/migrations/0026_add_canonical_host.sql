-- Add canonical_host column to audits table for storing resolved host
ALTER TABLE audits ADD COLUMN canonical_host TEXT;
