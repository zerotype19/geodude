CREATE TABLE IF NOT EXISTS project_ai_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  ai_source_id INTEGER NOT NULL REFERENCES ai_sources(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  suggested_pattern_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, ai_source_id)
);
CREATE INDEX IF NOT EXISTS idx_pas_project ON project_ai_sources(project_id);
