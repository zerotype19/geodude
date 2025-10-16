-- Create audit_issues table for storing SEO issues found during audits
CREATE TABLE IF NOT EXISTS audit_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id TEXT NOT NULL,
  page_url TEXT,
  issue_type TEXT NOT NULL,
  issue_id TEXT,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  score_impact TEXT,
  issue_rule_version TEXT DEFAULT 'v1.0',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_issues_audit_id ON audit_issues(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_issues_issue_id ON audit_issues(issue_id);
CREATE INDEX IF NOT EXISTS idx_audit_issues_rule_version ON audit_issues(issue_rule_version);
CREATE INDEX IF NOT EXISTS idx_audit_issues_category ON audit_issues(category);
CREATE INDEX IF NOT EXISTS idx_audit_issues_severity ON audit_issues(severity);
