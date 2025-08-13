-- Authentication tables for passwordless magic link auth
-- Sessions and magic links for user authentication

CREATE TABLE session (
  id TEXT PRIMARY KEY,       -- ses_<nanoid>
  user_id TEXT NOT NULL REFERENCES user(id),
  created_ts INTEGER NOT NULL,
  expires_ts INTEGER NOT NULL
);
CREATE INDEX idx_session_user ON session(user_id);

CREATE TABLE magic_link (
  token TEXT PRIMARY KEY,    -- mlg_<nanoid> random
  email TEXT NOT NULL,
  created_ts INTEGER NOT NULL,
  expires_ts INTEGER NOT NULL,
  used_ts INTEGER
);
