-- Initial AI Visibility Platform Schema
-- This migration establishes the foundation for AI monitoring and optimization

-- Users / Orgs / Projects (kept minimal)
CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS org (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(org_id) REFERENCES org(id)
);

-- Core AI visibility schema
CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  domain TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, domain),
  FOREIGN KEY(project_id) REFERENCES project(id)
);

CREATE TABLE IF NOT EXISTS content_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  type TEXT,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, url),
  FOREIGN KEY(property_id) REFERENCES properties(id)
);

CREATE TABLE IF NOT EXISTS ai_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT, -- search | chat | commerce | assistant
  fingerprint TEXT, -- JSON (ua/ip/patterns)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS ai_referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_source_id INTEGER NOT NULL,
  content_id INTEGER,
  ref_type TEXT, -- direct | summary | citation
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(ai_source_id) REFERENCES ai_sources(id),
  FOREIGN KEY(content_id) REFERENCES content_assets(id)
);

CREATE TABLE IF NOT EXISTS interaction_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  content_id INTEGER,
  ai_source_id INTEGER,
  event_type TEXT NOT NULL, -- view | click | purchase | custom
  metadata TEXT, -- JSON
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES project(id),
  FOREIGN KEY(content_id) REFERENCES content_assets(id),
  FOREIGN KEY(ai_source_id) REFERENCES ai_sources(id)
);

-- Optional: keep if useful (freshly defined)
CREATE TABLE IF NOT EXISTS conversion_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  content_id INTEGER,
  ai_source_id INTEGER,
  amount_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES project(id),
  FOREIGN KEY(content_id) REFERENCES content_assets(id),
  FOREIGN KEY(ai_source_id) REFERENCES ai_sources(id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_events_time ON interaction_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_referrals_time ON ai_referrals(detected_at);
CREATE INDEX IF NOT EXISTS idx_events_project ON interaction_events(project_id);
CREATE INDEX IF NOT EXISTS idx_content_property ON content_assets(property_id);
CREATE INDEX IF NOT EXISTS idx_referrals_source ON ai_referrals(ai_source_id);
