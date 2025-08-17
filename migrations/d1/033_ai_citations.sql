-- AI Citations v1 - Database migration
-- Creates ai_citations table for tracking content references in AI platforms

-- Create ai_citations table
CREATE TABLE IF NOT EXISTS ai_citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,                           -- matches project.id (TEXT)
  content_id INTEGER NULL REFERENCES content_assets(id) ON DELETE SET NULL,  -- FK → content_assets(id)
  ai_source_id INTEGER NOT NULL REFERENCES ai_sources(id) ON DELETE CASCADE, -- FK → ai_sources(id)
  ref_url TEXT NULL,                                   -- AI page/share URL if we have it
  snippet TEXT NULL CHECK (LENGTH(snippet) <= 500),   -- short text around our link/cite (≤ 500 chars)
  confidence REAL NULL CHECK (confidence >= 0 AND confidence <= 1), -- 0..1 (optional)
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT NULL                                   -- JSON (e.g., rank, thread_id, SERP position)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_citations_project_detected ON ai_citations(project_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_citations_project_source ON ai_citations(project_id, ai_source_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_citations_content ON ai_citations(project_id, content_id, detected_at DESC);

-- Optional backfill rule (safe, deduped)
-- Create a fingerprint view to prevent duplicates during backfill
-- Fingerprint: hash of project_id|content_id|ai_source_id|ref_url|date(detected_at)
INSERT OR IGNORE INTO ai_citations (project_id, content_id, ai_source_id, ref_url, detected_at, metadata)
SELECT 
  ar.project_id,
  ar.content_id,
  ar.ai_source_id,
  ar.ref_url,
  ar.detected_at,
  ar.metadata
FROM ai_referrals ar
WHERE ar.ref_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ai_citations ac 
    WHERE ac.project_id = ar.project_id 
      AND ac.content_id = ar.content_id 
      AND ac.ai_source_id = ar.ai_source_id 
      AND ac.ref_url = ar.ref_url 
      AND DATE(ac.detected_at) = DATE(ar.detected_at)
  );
