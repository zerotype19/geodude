-- Remove login code functionality - only use magic links
-- Drop the login_code table since we're standardizing on magic links

DROP TABLE IF EXISTS login_code;

-- Clean up any related indexes
-- (The table creation migration already handles this, but being explicit)
