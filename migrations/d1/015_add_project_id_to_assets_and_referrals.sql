-- 1) Add project_id TEXT to content_assets and ai_referrals
ALTER TABLE content_assets ADD COLUMN project_id TEXT;
ALTER TABLE ai_referrals ADD COLUMN project_id TEXT;

-- 2) Backfill content_assets.project_id via property.project_id
UPDATE content_assets
SET project_id = (
  SELECT p.project_id FROM property p WHERE p.id = content_assets.property_id
)
WHERE project_id IS NULL;

-- 3) Backfill ai_referrals.project_id via content_assets -> property
UPDATE ai_referrals
SET project_id = (
  SELECT p.project_id
  FROM content_assets ca
  JOIN property p ON p.id = ca.property_id
  WHERE ca.id = ai_referrals.content_id
)
WHERE project_id IS NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_content_assets_project ON content_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_referrals_project ON ai_referrals(project_id);
