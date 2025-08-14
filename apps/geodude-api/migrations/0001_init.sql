PRAGMA foreign_keys = ON;

CREATE TABLE edge_click_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  src TEXT,
  model TEXT,
  pid TEXT,
  geo TEXT,
  ua TEXT,
  ip TEXT,
  asn TEXT,
  dest TEXT,
  session_id TEXT
);

CREATE TABLE conversion_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  session_id TEXT,
  type TEXT,
  value_cents INTEGER,
  meta TEXT
);

CREATE TABLE crawler_visit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  ua TEXT,
  ip TEXT,
  asn TEXT,
  family TEXT,
  hit_type TEXT,
  path TEXT,
  status INTEGER
);

CREATE TABLE ai_surface_capture (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  surface TEXT,
  model_variant TEXT,
  persona TEXT,
  geo TEXT,
  query_text TEXT,
  dom_url TEXT,
  screenshot_url TEXT
);

CREATE TABLE ai_citation_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capture_id TEXT REFERENCES ai_surface_capture(id),
  ts INTEGER NOT NULL,
  surface TEXT,
  query TEXT,
  url TEXT,
  rank INTEGER,
  confidence REAL
);

CREATE INDEX idx_click_ts ON edge_click_event(ts);
CREATE INDEX idx_conv_session ON conversion_event(session_id);
CREATE INDEX idx_crawl_ts ON crawler_visit(ts);
CREATE INDEX idx_cite_capture ON ai_citation_event(capture_id);
