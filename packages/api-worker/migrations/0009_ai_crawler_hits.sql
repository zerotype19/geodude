-- AI crawler normalized hits (30d rolling views come from queries)
CREATE TABLE IF NOT EXISTS ai_crawler_hits (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  path TEXT NOT NULL,
  bot TEXT NOT NULL,           -- gptbot | claude-web | perplexitybot | ccbot | google-extended | amazonbot | bingbot | etc
  ua TEXT NOT NULL,            -- raw user-agent
  status INTEGER,              -- HTTP response
  ts INTEGER NOT NULL,         -- epoch ms
  source TEXT NOT NULL,        -- 'upload.csv' | 'upload.json' | 'api.ingest' | 'manual'
  ip_hash TEXT,                -- optional; SHA-256 of IP if provided (never store raw IP)
  extra_json TEXT              -- optional raw record/headers
);

CREATE INDEX IF NOT EXISTS idx_ai_hits_domain_ts ON ai_crawler_hits (domain, ts);
CREATE INDEX IF NOT EXISTS idx_ai_hits_domain_path ON ai_crawler_hits (domain, path);
CREATE INDEX IF NOT EXISTS idx_ai_hits_domain_bot_ts ON ai_crawler_hits (domain, bot, ts);

