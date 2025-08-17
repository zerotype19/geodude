-- Sessions & Journeys v1: Session-Event mapping table
-- Links interaction_events to sessions without altering the events table

CREATE TABLE IF NOT EXISTS session_event_map (
  session_id INTEGER NOT NULL REFERENCES session_v1(id) ON DELETE CASCADE,
  event_id   INTEGER NOT NULL,                 -- references interaction_events(id)
  PRIMARY KEY(session_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_sem_session ON session_event_map(session_id);
CREATE INDEX IF NOT EXISTS idx_sem_event   ON session_event_map(event_id);
