-- Ensure 'content_assets' references the now-canonical 'properties' table.
-- If the table was created with the wrong FK target, SQLite requires a table rebuild.
PRAGMA foreign_keys=OFF;

-- Rebuild 'content_assets' with the correct FK (preserving data).
CREATE TABLE IF NOT EXISTS _content_assets_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  project_id TEXT, -- already added earlier; keep as TEXT
  url TEXT NOT NULL,
  type TEXT,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copy existing rows (best-effort). If old table lacks project_id, computed earlier/backfilled.
INSERT INTO _content_assets_new (id, property_id, project_id, url, type, metadata, created_at)
SELECT id, property_id, project_id, url, type, metadata, created_at
FROM content_assets;

DROP TABLE content_assets;
ALTER TABLE _content_assets_new RENAME TO content_assets;

PRAGMA foreign_keys=ON;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_content_assets_property ON content_assets(property_id);
CREATE INDEX IF NOT EXISTS idx_content_assets_project ON content_assets(project_id);
-- This removes the "foreign key mismatch" error you hit when inserting content assets.
