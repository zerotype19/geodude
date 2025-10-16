-- AI Citations and Referrals Tables
-- Tracks citations from AI sources (Perplexity, ChatGPT, Claude, Brave) for GEO visibility

CREATE TABLE IF NOT EXISTS ai_citations (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  domain TEXT NOT NULL,            -- normalized domain audited
  ai_source TEXT NOT NULL,         -- 'perplexity'|'chatgpt'|'claude'|'brave'
  query TEXT NOT NULL,
  answer_hash TEXT,                -- hash(answer_text) for dedupe
  answer_excerpt TEXT,             -- first 500 chars (optional)
  cited_urls TEXT NOT NULL,        -- JSON array of URLs (string[])
  cited_match_count INTEGER NOT NULL DEFAULT 0, -- how many match our domain
  first_match_url TEXT,            -- first URL that matched our domain
  confidence REAL,                 -- optional (rank score, etc.)
  error TEXT,                      -- connector error message if any
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_citations_proj_dom_src
ON ai_citations (project_id, domain, ai_source, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_citations_domain_hash
ON ai_citations (domain, answer_hash);

CREATE TABLE IF NOT EXISTS ai_referrals (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  domain TEXT NOT NULL,
  ai_source TEXT NOT NULL,
  query TEXT NOT NULL,
  cited INTEGER NOT NULL DEFAULT 0,  -- 0/1
  count_urls INTEGER NOT NULL DEFAULT 0,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_referrals
ON ai_referrals (project_id, domain, ai_source, query);

CREATE INDEX IF NOT EXISTS idx_ai_referrals_domain_src
ON ai_referrals (domain, ai_source, last_seen DESC);
