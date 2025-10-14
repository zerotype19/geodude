-- Add AI response field to visibility_results table
ALTER TABLE visibility_results ADD COLUMN ai_response TEXT;

-- Update existing records to move the query field content to ai_response
UPDATE visibility_results SET ai_response = query WHERE ai_response IS NULL;
