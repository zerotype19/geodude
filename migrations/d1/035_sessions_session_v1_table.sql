-- Sessions & Journeys v1: Session tracking table
-- Groups visitor interactions into time-bounded sessions

CREATE TABLE IF NOT EXISTS session_v1 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  visitor_id INTEGER NOT NULL REFERENCES visitor(id) ON DELETE CASCADE,
  started_at TIMESTAMP NOT NULL,
  ended_at   TIMESTAMP,                        -- nullable until session closes
  entry_content_id INTEGER,                    -- first content_id in session
  entry_url TEXT,                              -- first URL in session
  exit_content_id INTEGER,                     -- last content_id in session
  ai_influenced INTEGER NOT NULL DEFAULT 0,   -- 1 if any AI source during session
  primary_ai_source_id INTEGER,               -- first non-null ai_source_id
  events_count INTEGER NOT NULL DEFAULT 0,    -- number of events in session
  CONSTRAINT uq_session UNIQUE(project_id, visitor_id, started_at)
);

CREATE INDEX IF NOT EXISTS idx_sess_proj_started ON session_v1(project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sess_proj_ai ON session_v1(project_id, ai_influenced, started_at DESC);
