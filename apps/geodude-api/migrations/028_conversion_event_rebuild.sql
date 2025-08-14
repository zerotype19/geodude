PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS _conversion_event_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  content_id INTEGER REFERENCES content_assets(id) ON DELETE SET NULL,
  amount_cents INTEGER,                -- nullable for count-only conversions
  currency TEXT DEFAULT 'USD',
  metadata TEXT,                       -- sanitized JSON (≤1KB)
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO _conversion_event_new (id, project_id, property_id, content_id, amount_cents, currency, metadata, occurred_at)
SELECT
  id,
  'legacy' as project_id,              -- placeholder for existing data
  1 as property_id,                     -- placeholder for existing data
  NULL as content_id,                   -- no content mapping for legacy data
  value_cents as amount_cents,
  'USD' as currency,                    -- default currency
  meta as metadata,
  datetime(ts, 'unixepoch') as occurred_at  -- convert unix timestamp to datetime
FROM conversion_event;

DROP TABLE conversion_event;
ALTER TABLE _conversion_event_new RENAME TO conversion_event;

-- helpful indexes
CREATE INDEX IF NOT EXISTS idx_conv_project_time ON conversion_event(project_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_conv_content_time ON conversion_event(content_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_conv_property_time ON conversion_event(property_id, occurred_at);

PRAGMA foreign_keys=ON;
