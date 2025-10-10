-- Content Recommendation Jobs
-- Tracks async content generation jobs for page-level recommendations

CREATE TABLE IF NOT EXISTS reco_jobs (
  id TEXT PRIMARY KEY,
  audit_id TEXT,                   -- optional: link to audit if triggered from audit page
  page_id TEXT,                    -- optional: link to specific audit_pages row
  url TEXT NOT NULL,
  status TEXT NOT NULL,            -- queued | rendering | analyzing | done | error
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  input_hash TEXT,                 -- etag/hash of rendered HTML for cache deduplication
  result_json TEXT,                -- final model output (stringified JSON with recommendations)
  error TEXT,
  FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES audit_pages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reco_jobs_url ON reco_jobs(url);
CREATE INDEX IF NOT EXISTS idx_reco_jobs_audit ON reco_jobs(audit_id);
CREATE INDEX IF NOT EXISTS idx_reco_jobs_status ON reco_jobs(status, created_at);

