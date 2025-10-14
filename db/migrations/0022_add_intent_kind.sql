-- Add kind and prompt_reason fields to visibility_intents table
ALTER TABLE visibility_intents ADD COLUMN kind TEXT DEFAULT 'branded';
ALTER TABLE visibility_intents ADD COLUMN prompt_reason TEXT DEFAULT 'Generated from site description';

-- Create index on kind for faster filtering
CREATE INDEX IF NOT EXISTS idx_visibility_intents_kind ON visibility_intents(kind);
