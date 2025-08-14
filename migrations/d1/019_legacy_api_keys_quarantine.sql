-- We use 'api_key' (singular) in code. Quarantine any legacy 'api_keys' table to avoid confusion.
-- Prefer rename to preserve any accidental data; drop if rename is not possible in your runner.

-- Primary path:
ALTER TABLE api_keys RENAME TO api_keys_legacy;

-- If the above fails because api_keys doesn't exist, that's fine.
-- Optional defensive drop:
DROP TABLE IF EXISTS api_keys;

-- Indexes for the canonical table (no-op if they already exist)
CREATE INDEX IF NOT EXISTS idx_api_key_project ON api_key(project_id);
