-- Add missing assistant field to ai_citations table
-- This field was referenced in later migrations but never actually added

ALTER TABLE ai_citations ADD COLUMN assistant TEXT DEFAULT 'perplexity';

-- Update existing records to have assistant field
UPDATE ai_citations SET assistant = 'perplexity' WHERE assistant IS NULL;

-- Add index for assistant field
CREATE INDEX IF NOT EXISTS idx_ai_citations_assistant ON ai_citations(assistant);
