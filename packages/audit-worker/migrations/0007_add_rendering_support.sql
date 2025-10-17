-- Migration: Add dual-mode rendering support
-- Adds columns for rendered HTML and render gap ratio to detect SPAs

ALTER TABLE audit_page_analysis ADD COLUMN rendered_html TEXT;
ALTER TABLE audit_page_analysis ADD COLUMN render_gap_ratio REAL;

-- Index for finding SPA pages (low render gap ratio)
CREATE INDEX IF NOT EXISTS idx_render_gap ON audit_page_analysis(render_gap_ratio) WHERE render_gap_ratio IS NOT NULL;

