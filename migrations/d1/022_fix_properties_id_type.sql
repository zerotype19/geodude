-- Fix the properties table ID type from TEXT to INTEGER to match foreign key constraints
PRAGMA foreign_keys=OFF;

-- Create new table with correct ID type
CREATE TABLE properties_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  name TEXT,
  created_ts INTEGER NOT NULL,
  updated_ts INTEGER NOT NULL
);

-- Copy existing data, converting TEXT IDs to INTEGER rowids
INSERT INTO properties_new (id, project_id, domain, name, created_ts, updated_ts)
SELECT rowid, project_id, domain, name, created_ts, updated_ts
FROM properties;

-- Drop old table and rename new one
DROP TABLE properties;
ALTER TABLE properties_new RENAME TO properties;

-- Recreate the compatibility view
DROP VIEW IF EXISTS property;
CREATE VIEW property AS SELECT * FROM properties;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_properties_project ON properties(project_id);

PRAGMA foreign_keys=ON;
