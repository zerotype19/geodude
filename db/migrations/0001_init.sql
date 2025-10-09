-- Initial schema for Optiview
-- Tables: projects, properties, hits, audits, audit_pages, audit_issues

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, domain)
);

CREATE INDEX idx_properties_project ON properties(project_id);
CREATE INDEX idx_properties_domain ON properties(domain);

CREATE TABLE IF NOT EXISTS hits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  bot_type TEXT,
  referrer TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_hits_property ON hits(property_id);
CREATE INDEX idx_hits_created ON hits(created_at);
CREATE INDEX idx_hits_bot_type ON hits(bot_type);

CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  score_overall REAL,
  score_crawlability REAL,
  score_structured REAL,
  score_answerability REAL,
  score_trust REAL,
  pages_crawled INTEGER DEFAULT 0,
  pages_total INTEGER DEFAULT 0,
  issues_count INTEGER DEFAULT 0,
  metadata TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  error TEXT
);

CREATE INDEX idx_audits_property ON audits(property_id);
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_started ON audits(started_at);

CREATE TABLE IF NOT EXISTS audit_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id TEXT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status_code INTEGER,
  title TEXT,
  h1 TEXT,
  has_json_ld INTEGER DEFAULT 0,
  has_faq INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  load_time_ms INTEGER,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_pages_audit ON audit_pages(audit_id);

CREATE TABLE IF NOT EXISTS audit_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id TEXT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  page_url TEXT,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_issues_audit ON audit_issues(audit_id);
CREATE INDEX idx_audit_issues_severity ON audit_issues(severity);

