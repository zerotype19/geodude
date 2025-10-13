-- Add source_type column to ai_citations
-- Phase 4 Sprint 2: Multi-assistant support

ALTER TABLE ai_citations ADD COLUMN source_type TEXT DEFAULT 'native';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_citations_assistant_type ON ai_citations(assistant, source_type);

-- Add index for daily cost tracking
CREATE INDEX IF NOT EXISTS idx_citations_day_assistant ON ai_citations(date(occurred_at), assistant);
