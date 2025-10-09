-- Seed data for development

INSERT OR IGNORE INTO projects (id, name, api_key, created_at, updated_at)
VALUES (
  'prj_demo',
  'Demo',
  'dev_key',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO properties (id, project_id, domain, verified, created_at, updated_at)
VALUES (
  'prop_demo',
  'prj_demo',
  'optiview.ai',
  1,
  datetime('now'),
  datetime('now')
);

