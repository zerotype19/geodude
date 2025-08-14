PRAGMA foreign_keys=OFF;

-- 1) Create the new table with correct types/constraints
CREATE TABLE IF NOT EXISTS _interaction_events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  content_id INTEGER REFERENCES content_assets(id) ON DELETE SET NULL,
  ai_source_id INTEGER REFERENCES ai_sources(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view','click','custom')),
  metadata TEXT,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2) Copy old data, handling missing property_id and converting project_id INTEGER → TEXT
INSERT INTO _interaction_events_new (id, project_id, property_id, content_id, ai_source_id, event_type, metadata, occurred_at)
SELECT
  id,
  'prj_cTSh3LZ8qMVZ' as project_id, -- Use our known project ID since old table has INTEGER
  NULL as property_id, -- property_id column doesn't exist in old table
  content_id,
  ai_source_id,
  event_type,
  metadata,
  COALESCE(occurred_at, CURRENT_TIMESTAMP)
FROM interaction_events;

-- 3) Swap tables
DROP TABLE interaction_events;
ALTER TABLE _interaction_events_new RENAME TO interaction_events;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_ie_project ON interaction_events(project_id);
CREATE INDEX IF NOT EXISTS idx_ie_ai_source ON interaction_events(ai_source_id);
CREATE INDEX IF NOT EXISTS idx_ie_occurred_at ON interaction_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_ie_content ON interaction_events(content_id);

PRAGMA foreign_keys=ON;
