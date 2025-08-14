-- If the canonical table 'properties' does not exist but 'property' does, rename it.
-- This resolves FK mismatches that reference 'properties'.
PRAGMA foreign_keys=OFF;

-- Guarded rename: if 'properties' exists, skip; D1 lacks IF EXISTS for rename, so try/catch in migration runner if needed.
-- Primary path:
ALTER TABLE property RENAME TO properties;

PRAGMA foreign_keys=ON;

-- Helpful index for scoping by project
CREATE INDEX IF NOT EXISTS idx_properties_project ON properties(project_id);

-- Optional compatibility view (read-only) for any stray reads
DROP VIEW IF EXISTS property;
CREATE VIEW property AS SELECT * FROM properties;
-- Note: the view is read-only; our code should write to properties. We don't expect writes to property.
