-- Drop the existing table first, then create compatibility view
DROP TABLE IF EXISTS edge_click_event;
DROP VIEW IF EXISTS edge_click_event;

CREATE VIEW edge_click_event AS
SELECT
  id,
  project_id,
  property_id,
  content_id,
  ai_source_id,
  event_type,
  metadata,
  occurred_at
FROM interaction_events;
-- This view is read-only; ingestion must write to interaction_events.
