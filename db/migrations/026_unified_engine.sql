-- Unified Audit Engine Migration
-- Purpose: Remove versioning, enforce 5-pillar model, create unified schema

-- 1) audit_scores: drop versioning; enforce not null for five pillars
ALTER TABLE audit_scores RENAME TO audit_scores_old;

CREATE TABLE audit_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id TEXT NOT NULL,
  crawlability_score REAL NOT NULL,
  structured_score REAL NOT NULL,
  answerability_score REAL NOT NULL,
  trust_score REAL NOT NULL,
  visibility_score REAL NOT NULL DEFAULT 0,
  overall_score REAL NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- migrate existing rows (map v1 rows: set visibility=0 when missing)
INSERT INTO audit_scores (
  audit_id, crawlability_score, structured_score,
  answerability_score, trust_score, visibility_score,
  overall_score, created_at
)
SELECT audit_id,
       crawlability_score, structured_score,
       answerability_score, trust_score,
       COALESCE(visibility_score, 0),
       overall_score, created_at
FROM audit_scores_old;

DROP TABLE audit_scores_old;

-- 2) issues: remove rule version column if present; keep optional issue_id
ALTER TABLE audit_issues RENAME TO audit_issues_old;

CREATE TABLE audit_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  issue_id TEXT,          -- stable id like 'structured.missing_faqpage'
  page_url TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO audit_issues (audit_id,severity,category,message,issue_id,page_url,created_at)
SELECT audit_id,severity,category,message,issue_id,page_url,created_at
FROM audit_issues_old;

DROP TABLE audit_issues_old;

-- 3) Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_scores_audit_id ON audit_scores(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_issues_audit_id ON audit_issues(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_issues_category ON audit_issues(category);
CREATE INDEX IF NOT EXISTS idx_audit_issues_severity ON audit_issues(severity);

-- 4) (optional) API compatibility view for one release cycle
CREATE VIEW IF NOT EXISTS audit_scores_view AS
SELECT
  audit_id,
  crawlability_score,
  structured_score,
  answerability_score,
  trust_score,
  visibility_score,
  overall_score,
  created_at
FROM audit_scores;
