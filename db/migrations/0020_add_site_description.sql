-- Add site_description column to properties table for better VI prompt generation
ALTER TABLE properties ADD COLUMN site_description TEXT;

-- Add index for better query performance when filtering by site description
CREATE INDEX IF NOT EXISTS idx_properties_site_description ON properties(site_description);
