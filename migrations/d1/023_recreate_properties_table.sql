-- Drop and recreate properties table with correct INTEGER ID type
PRAGMA foreign_keys=OFF;

-- Drop the existing table
DROP TABLE IF EXISTS properties;

-- Create new table with correct ID type
CREATE TABLE properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  name TEXT,
  created_ts INTEGER NOT NULL,
  updated_ts INTEGER NOT NULL
);

-- Recreate the compatibility view
DROP VIEW IF EXISTS property;
CREATE VIEW property AS SELECT * FROM properties;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_properties_project ON properties(project_id);

PRAGMA foreign_keys=ON;
