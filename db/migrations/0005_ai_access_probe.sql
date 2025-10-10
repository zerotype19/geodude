-- Add AI bot access probe results to audits
-- Stores JSON data from probeAiAccess function
-- Format: { baselineStatus: number, results: Array<{bot, status, ok, diff, server, cfRay, akamai, blocked}> }

ALTER TABLE audits ADD COLUMN ai_access_json TEXT;

-- Add index for querying audits with AI bot issues
CREATE INDEX IF NOT EXISTS idx_audits_ai_access ON audits(ai_access_json) WHERE ai_access_json IS NOT NULL;

