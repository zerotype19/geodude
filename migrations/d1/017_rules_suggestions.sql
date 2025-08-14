CREATE TABLE IF NOT EXISTS rules_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  ai_source_id INTEGER NOT NULL REFERENCES ai_sources(id) ON DELETE CASCADE,
  author_user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  suggestion_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rules_suggestions_status ON rules_suggestions(status, ai_source_id);
CREATE INDEX IF NOT EXISTS idx_rules_suggestions_project ON rules_suggestions(project_id);
