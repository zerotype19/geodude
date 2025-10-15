-- Frontier table for BFS crawl management
CREATE TABLE IF NOT EXISTS audit_frontier (
  audit_id TEXT NOT NULL,
  url TEXT NOT NULL,
  depth INTEGER NOT NULL,
  priority REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, visiting, done
  discovered_from TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (audit_id, url),
  FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_frontier_status ON audit_frontier(audit_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_frontier_priority ON audit_frontier(audit_id, priority, depth);
