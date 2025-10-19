-- Migration: Add intent_group and prompt_gen_version to ai_citations
-- Tracks whether query is branded vs non-branded and which prompt engine generated it

ALTER TABLE ai_citations ADD COLUMN intent_group TEXT;
ALTER TABLE ai_citations ADD COLUMN prompt_gen_version TEXT DEFAULT 'v1-legacy';

CREATE INDEX IF NOT EXISTS idx_ai_citations_intent_group ON ai_citations (audit_id, intent_group);

