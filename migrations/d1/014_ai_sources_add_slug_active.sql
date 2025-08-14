-- Add missing columns if they don't exist (D1 tolerates duplicate ADDs poorly, so structure carefully)
ALTER TABLE ai_sources ADD COLUMN slug TEXT;
ALTER TABLE ai_sources ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ai_sources ADD COLUMN updated_at TIMESTAMP;

-- Backfill slug from name (lower, underscores)
UPDATE ai_sources
SET slug = COALESCE(
  slug,
  LOWER(
    REPLACE(REPLACE(REPLACE(name, ' ', '_'), '.', '_'), '/', '_')
  )
);

-- De-duplicate slugs by suffixing with _<id> where necessary
WITH dups AS (
  SELECT slug FROM ai_sources WHERE slug IS NOT NULL
  GROUP BY slug HAVING COUNT(*) > 1
)
UPDATE ai_sources
SET slug = slug || '_' || id
WHERE slug IN (SELECT slug FROM dups);

-- Unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_sources_slug ON ai_sources(slug);

-- (Optional) fast filters
CREATE INDEX IF NOT EXISTS idx_ai_sources_active ON ai_sources(is_active);
