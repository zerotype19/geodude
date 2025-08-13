-- Migration: Add API keys and property linkage for SaaS ingestion auth
-- This enables secure, authenticated event ingestion from customer properties

-- API Keys table for property-scoped authentication
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  property_id INTEGER NOT NULL,
  name TEXT NOT NULL, -- "Production site", "Staging", "Mobile app", etc.
  key_id TEXT NOT NULL UNIQUE, -- short public identifier (e.g., "key_abc123")
  secret_hash TEXT NOT NULL,   -- sha256(secret) for verification
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,   -- soft revocation
  last_used_at TIMESTAMP NULL, -- for usage analytics
  FOREIGN KEY(project_id) REFERENCES project(id) ON DELETE CASCADE,
  FOREIGN KEY(property_id) REFERENCES properties(id) ON DELETE CASCADE,
  UNIQUE(property_id, name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_property ON api_keys(property_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(revoked_at) WHERE revoked_at IS NULL;

-- Create index on properties.project_id for fast lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_properties_project ON properties(project_id);

-- Add some sample data for testing (remove in production)
-- INSERT INTO api_keys (project_id, property_id, name, key_id, secret_hash) VALUES 
--   (1, 1, 'Production Site', 'key_test123', 'sha256_hash_placeholder');
