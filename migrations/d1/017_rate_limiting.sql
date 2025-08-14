-- Rate limiting table for storing rate limit data
-- This replaces KV storage for rate limiting with proper database storage

CREATE TABLE IF NOT EXISTS rate_limiting (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_name TEXT NOT NULL,                    -- e.g., 'magic_link:ip:192.168.1.1'
  count INTEGER DEFAULT 1,                   -- current count
  reset_time TIMESTAMP NOT NULL,             -- when the window resets
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups by key name
CREATE INDEX IF NOT EXISTS idx_rate_limiting_key ON rate_limiting(key_name);

-- Index for cleanup of expired rate limits
CREATE INDEX IF NOT EXISTS idx_rate_limiting_reset ON rate_limiting(reset_time);

-- Clean up old rate limiting data periodically (older than 24 hours)
CREATE INDEX IF NOT EXISTS idx_rate_limiting_cleanup ON rate_limiting(created_at);
