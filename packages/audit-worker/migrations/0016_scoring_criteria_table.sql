-- Unified scoring criteria table
-- Single source of truth for all checks (replaces scattered definitions)

CREATE TABLE IF NOT EXISTS scoring_criteria (
  id TEXT PRIMARY KEY,                    -- e.g., "C1_title_quality", "A1_answer_first"
  version INTEGER NOT NULL DEFAULT 1,     -- For schema evolution
  
  -- Display metadata
  label TEXT NOT NULL,                    -- "Title tag quality"
  description TEXT,                       -- Plain-language description
  category TEXT NOT NULL,                 -- "Technical Foundations", "Content & Clarity", etc.
  
  -- Scoring metadata
  scope TEXT NOT NULL DEFAULT 'page',     -- "page" or "site"
  weight INTEGER NOT NULL DEFAULT 10,     -- Relative importance (1-100)
  impact_level TEXT NOT NULL,             -- "High", "Medium", "Low"
  
  -- Thresholds for status mapping
  pass_threshold INTEGER DEFAULT 85,      -- Score >= this is "ok"
  warn_threshold INTEGER DEFAULT 60,      -- Score >= this is "warn", else "fail"
  
  -- Implementation details
  check_type TEXT NOT NULL,               -- "html_dom", "llm", "aggregation", "manual"
  enabled INTEGER NOT NULL DEFAULT 1,     -- 0/1 flag
  preview INTEGER NOT NULL DEFAULT 0,     -- 0/1 - if in shadow mode
  
  -- Documentation
  why_it_matters TEXT,                    -- User-facing explanation
  how_to_fix TEXT,                        -- Actionable guidance
  references_json TEXT,                   -- JSON array of {"label": "...", "url": "..."}
  
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_criteria_category ON scoring_criteria(category);
CREATE INDEX IF NOT EXISTS idx_criteria_enabled ON scoring_criteria(enabled);
CREATE INDEX IF NOT EXISTS idx_criteria_scope ON scoring_criteria(scope);

-- Insert Scoring V1 checks
INSERT OR REPLACE INTO scoring_criteria (id, label, description, category, scope, weight, impact_level, check_type, why_it_matters, references_json) VALUES
-- Content & Clarity
('C1_title_quality', 'Title tag quality', 'Well-crafted title with brand and 15-65 character length', 'Technical Foundations', 'page', 12, 'High', 'html_dom', 'Well-crafted titles improve click-through and snippet generation.', NULL),
('C2_meta_description', 'Meta description present', 'Meta description exists with 50-160 characters', 'Technical Foundations', 'page', 8, 'Medium', 'html_dom', 'Descriptions guide snippet generation and set user expectations.', NULL),
('C3_h1_presence', 'Single H1 tag', 'Exactly one H1 tag for clear page hierarchy', 'Structure & Organization', 'page', 10, 'High', 'html_dom', 'Clear page hierarchy helps parsers identify main topic.', NULL),
('A1_answer_first', 'Answer-first hero section', 'Hero section with clear value proposition and CTA', 'Content & Clarity', 'page', 15, 'High', 'html_dom', 'Early value proposition improves snippet quality and engagement.', NULL),
('A2_headings_semantic', 'Semantic heading structure', 'Proper H1→H2→H3 hierarchy without skipping levels', 'Structure & Organization', 'page', 10, 'High', 'html_dom', 'Proper hierarchy improves content parsing and accessibility.', NULL),
('A3_faq_presence', 'FAQ section present', 'Detectable FAQ section with Q&A patterns', 'Content & Clarity', 'page', 8, 'Medium', 'html_dom', 'FAQ blocks increase answer engine citation likelihood.', NULL),
('A4_schema_faqpage', 'FAQPage schema', 'Valid FAQPage JSON-LD with 3+ questions', 'Technical Foundations', 'page', 10, 'High', 'html_dom', 'Structured FAQ data enables rich snippets and voice answers.', '["https://schema.org/FAQPage"]'),
('A9_internal_linking', 'Internal linking & diversity', '10+ internal links with 40%+ anchor diversity', 'Structure & Organization', 'page', 7, 'Medium', 'html_dom', 'Rich internal links improve crawl depth and topical clustering.', NULL),
('G10_canonical', 'Canonical URL correctness', 'Canonical tag present and points to same domain', 'Technical Foundations', 'page', 8, 'Medium', 'html_dom', 'Proper canonicals prevent duplicate content penalties.', NULL),
('T1_mobile_viewport', 'Mobile viewport tag', 'Viewport meta tag with device-width', 'Experience & Performance', 'page', 8, 'Medium', 'html_dom', 'Viewport meta ensures mobile-friendly rendering.', NULL),
('T2_lang_region', 'Language/region tags', 'HTML lang attribute matches target locale', 'Technical Foundations', 'page', 6, 'Low', 'html_dom', 'Correct lang attributes improve international targeting.', NULL),
('T3_noindex_robots', 'No blocking robots directives', 'No noindex or restrictive robots meta tags', 'Crawl & Discoverability', 'page', 12, 'High', 'html_dom', 'Noindex/nofollow prevent crawlers from seeing content.', NULL),
('A12_entity_graph', 'Organization entity graph', 'Organization schema with logo and 2+ sameAs links', 'Authority & Trust', 'page', 10, 'High', 'html_dom', 'Rich organization schema strengthens entity recognition.', '["https://schema.org/Organization"]');

-- Add legacy checks for backward compatibility (these are computed differently)
INSERT OR IGNORE INTO scoring_criteria (id, label, category, scope, weight, impact_level, check_type, enabled) VALUES
('A1', 'Answer-first design', 'Content & Clarity', 'page', 15, 'High', 'llm', 1),
('A2', 'Topical cluster integrity', 'Structure & Organization', 'page', 10, 'High', 'llm', 1),
('A3', 'Author attribution', 'Authority & Trust', 'page', 8, 'Medium', 'llm', 1),
('A4', 'Cite credible sources', 'Authority & Trust', 'page', 12, 'High', 'llm', 1),
('A5', 'Schema accuracy & breadth', 'Technical Foundations', 'page', 10, 'High', 'html_dom', 1),
('A6', 'Crawlable URLs', 'Crawl & Discoverability', 'page', 10, 'High', 'html_dom', 1),
('A7', 'Mobile UX', 'Experience & Performance', 'page', 8, 'Medium', 'html_dom', 1),
('A8', 'Page speed (LCP)', 'Crawl & Discoverability', 'page', 7, 'Medium', 'html_dom', 1),
('A9', 'Structured content', 'Content & Clarity', 'page', 5, 'Medium', 'html_dom', 1),
('A10', 'Citations and sources section', 'Content & Clarity', 'page', 4, 'High', 'html_dom', 1),
('A11', 'Render visibility (SPA risk)', 'Crawl & Discoverability', 'page', 10, 'High', 'html_dom', 1),
('G1', 'Clear entity definition', 'Content & Clarity', 'page', 15, 'High', 'llm', 1),
('G2', 'Natural language', 'Authority & Trust', 'page', 8, 'Medium', 'llm', 1),
('G3', 'Brand consistency', 'Authority & Trust', 'page', 8, 'Medium', 'html_dom', 1),
('G4', 'AI crawler access & parity', 'Crawl & Discoverability', 'page', 12, 'High', 'html_dom', 1),
('G5', 'Comprehensive coverage', 'Content & Clarity', 'page', 10, 'High', 'llm', 1),
('G6', 'Factual accuracy', 'Structure & Organization', 'page', 12, 'High', 'llm', 1),
('G7', 'Content freshness', 'Authority & Trust', 'page', 7, 'Medium', 'html_dom', 1),
('G8', 'Semantic HTML', 'Technical Foundations', 'page', 8, 'Medium', 'html_dom', 1),
('G9', 'Entity relationships (schema)', 'Authority & Trust', 'page', 10, 'High', 'html_dom', 1),
('G10', 'Contextual linking', 'Structure & Organization', 'page', 8, 'Medium', 'html_dom', 1);

