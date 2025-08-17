-- Sessions & Journeys v1: Visitor tracking table
-- Stores stable visitor identities across sessions

CREATE TABLE IF NOT EXISTS visitor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  visitor_key TEXT NOT NULL,                   -- opaque UUID or fallback anon:hash
  first_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ua_hash    TEXT,                             -- sha256(user_agent)
  ip_hash    TEXT,                             -- sha256(ip_address)
  UNIQUE(project_id, visitor_key)
);

CREATE INDEX IF NOT EXISTS idx_visitor_proj_last ON visitor(project_id, last_seen DESC);
