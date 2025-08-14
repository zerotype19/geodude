-- Multi-tenant database structure for Geodude SaaS
-- Adds orgs/users/projects/API keys + scopes all events

-- Orgs & users
CREATE TABLE organization (
  id TEXT PRIMARY KEY,               -- org_<nanoid>
  name TEXT NOT NULL,
  created_ts INTEGER NOT NULL
);

CREATE TABLE user (
  id TEXT PRIMARY KEY,               -- usr_<nanoid>
  email TEXT NOT NULL UNIQUE,
  created_ts INTEGER NOT NULL,
  last_login_ts INTEGER
);

CREATE TABLE org_member (
  org_id TEXT NOT NULL REFERENCES organization(id),
  user_id TEXT NOT NULL REFERENCES user(id),
  role TEXT NOT NULL DEFAULT 'admin', -- admin|member
  PRIMARY KEY (org_id, user_id)
);

-- Projects (aka "sites" / workspaces)
CREATE TABLE project (
  id TEXT PRIMARY KEY,               -- prj_<nanoid>
  org_id TEXT NOT NULL REFERENCES organization(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,                -- unique per org
  domain TEXT,                       -- optional: customer site
  created_ts INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_project_org_slug ON project(org_id, slug);

-- API keys (hashed) scoped to project
CREATE TABLE api_key (
  id TEXT PRIMARY KEY,               -- key_<nanoid>
  project_id TEXT NOT NULL REFERENCES project(id),
  name TEXT NOT NULL,
  hash TEXT NOT NULL,                -- base64url(sha256(raw))
  created_ts INTEGER NOT NULL,
  last_used_ts INTEGER,
  revoked_ts INTEGER
);
CREATE INDEX idx_api_key_project ON api_key(project_id);

-- Add org/project to event tables (soft multi-tenancy)
ALTER TABLE edge_click_event ADD COLUMN org_id TEXT;
ALTER TABLE edge_click_event ADD COLUMN project_id TEXT;

ALTER TABLE conversion_event ADD COLUMN org_id TEXT;
ALTER TABLE conversion_event ADD COLUMN project_id TEXT;

ALTER TABLE ai_surface_capture ADD COLUMN org_id TEXT;
ALTER TABLE ai_surface_capture ADD COLUMN project_id TEXT;

ALTER TABLE ai_citation_event ADD COLUMN org_id TEXT;
ALTER TABLE ai_citation_event ADD COLUMN project_id TEXT;
