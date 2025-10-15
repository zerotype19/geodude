-- Locks table for idempotency
CREATE TABLE IF NOT EXISTS audit_locks (
  audit_id TEXT NOT NULL PRIMARY KEY,
  locked_until TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
);
