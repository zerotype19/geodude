-- Seed data for system organization and project
-- Provides backward compatibility for existing data

INSERT OR IGNORE INTO organization(id, name, created_ts)
VALUES ('org_system','Geodude System', strftime('%s','now')*1000);

INSERT OR IGNORE INTO project(id, org_id, name, slug, created_ts)
VALUES ('prj_system','org_system','Default','default', strftime('%s','now')*1000);
