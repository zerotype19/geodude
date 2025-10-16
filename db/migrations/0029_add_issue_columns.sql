-- Add issue_id and issue_rule_version columns to audit_issues table
ALTER TABLE audit_issues ADD COLUMN issue_id TEXT;
ALTER TABLE audit_issues ADD COLUMN issue_rule_version TEXT DEFAULT 'v1.0';

-- Create index for issue_id lookups
CREATE INDEX IF NOT EXISTS idx_audit_issues_issue_id ON audit_issues(issue_id);
CREATE INDEX IF NOT EXISTS idx_audit_issues_rule_version ON audit_issues(issue_rule_version);
