-- Template for syncing criteria from https://app.optiview.ai/score-guide
-- Fill in with actual content from your live guide

-- Example template (one per criterion):
/*
UPDATE scoring_criteria SET
  label = 'Title Tag Quality',
  description = 'Your page title should be clear, descriptive, and optimized for search engines and AI assistants',
  importance_rank = 1, -- 1=Critical, 2=High, 3=Medium
  points_possible = 100,
  scoring_approach = 'Automated HTML analysis',
  
  why_it_matters = 'The title tag is one of the most important on-page SEO elements. It appears in search results, browser tabs, and is used by AI assistants to understand page content.',
  
  how_to_fix = '1. Keep titles between 50-60 characters
2. Include your primary keyword near the beginning
3. Add your brand name at the end
4. Make it compelling and clickable
5. Avoid keyword stuffing',
  
  examples = 'Good: "Best CRM Software 2024 | Features & Pricing - Acme"
Bad: "Home | Welcome | Acme Inc | CRM Software Company"
  
Good title is specific, includes keywords naturally, and has brand.
Bad title is generic, keyword-stuffed, and wastes characters.',
  
  view_in_ui = 'Check the Page Details tab → Technical section → Title tag',
  
  common_issues = '• Title too short (<30 chars) or too long (>65 chars)
• Missing brand name
• Duplicate titles across pages
• Keyword stuffing
• Generic titles like "Home" or "Welcome"',
  
  quick_fixes = '1. Review all page titles in your audit
2. Ensure each is unique and descriptive
3. Add brand name to end if missing
4. Optimize length to 50-60 characters
5. Front-load important keywords',
  
  learn_more_links = '[
    {"label": "Google Title Tag Guidelines", "url": "https://developers.google.com/search/docs/appearance/title-link"},
    {"label": "Moz: Title Tag Best Practices", "url": "https://moz.com/learn/seo/title-tag"}
  ]',
  
  official_docs = '[
    {"label": "Google Search Central", "url": "https://developers.google.com/search/docs/appearance/title-link"},
    {"label": "Schema.org WebPage", "url": "https://schema.org/WebPage"}
  ]',
  
  category = 'Technical Foundations',
  display_order = 1
WHERE id = 'C1_title_quality';
*/

-- TODO: Add actual content from https://app.optiview.ai/score-guide for each criterion
-- Run this script after manual content entry:
-- wrangler d1 execute optiview --remote --file scripts/sync-criteria-from-guide.sql

