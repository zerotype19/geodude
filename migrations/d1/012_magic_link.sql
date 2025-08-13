-- Magic link authentication table
CREATE TABLE IF NOT EXISTS magic_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,          -- one-time token
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  requester_ip_hash TEXT,
  continue_path TEXT,                       -- validated app-side (must start with '/')
  meta TEXT                                  -- JSON: {project_id?, org_id?}
);
CREATE INDEX IF NOT EXISTS idx_magic_link_email ON magic_link(email);
CREATE INDEX IF NOT EXISTS idx_magic_link_expires ON magic_link(expires_at);
