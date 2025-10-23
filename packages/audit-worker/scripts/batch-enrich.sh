#!/bin/bash
# Batch enrich all scoring criteria with detailed content

cd "$(dirname "$0")/.."

echo "🚀 Enriching 36 scoring criteria with detailed content..."

# Note: Using printf to properly handle special characters
# All strings are in single quotes with '' for embedded single quotes

wrangler d1 execute optiview --remote --command "UPDATE scoring_criteria SET why_it_matters = 'Titles are the strongest machine signal for page focus. Clear, branded titles increase click-through, snippet quality, and reduce entity confusion.', how_to_fix = '1) Keep 15–65 chars. 2) Lead with the topic/intent; end with brand on key pages. 3) Use one primary keyword; avoid stuffing. 4) Make each page title unique.', common_issues = 'Missing <title>; duplicated across many pages; over 70 chars; vague marketing taglines; keyword stuffing; brand only with no topic.', quick_fixes = 'Export duplicate titles; rewrite to ''Topic – Brand''; trim to <65 chars; add primary intent term.', display_order = 1 WHERE id = 'C1_title_quality'"

echo "✓ Updated C1_title_quality"

wrangler d1 execute optiview --remote --command "UPDATE scoring_criteria SET why_it_matters = 'Well-written descriptions help assistants and search systems generate useful snippets and set user expectations.', how_to_fix = '1) Add one <meta name=\"description\"> per page. 2) Aim for 120–155 chars. 3) Summarize the key value and who it''s for. 4) Avoid quotes and boilerplate.', common_issues = 'Missing tag; too short (<50 chars) or too long (>180); duplicated sitewide; keyword lists; generic ''Welcome'' copy.', quick_fixes = 'Autofill from first paragraph, then hand-edit top pages; ensure uniqueness by URL.', display_order = 2 WHERE id = 'C2_meta_description'"

echo "✓ Updated C2_meta_description"

wrangler d1 execute optiview --remote --command "UPDATE scoring_criteria SET why_it_matters = 'A single, descriptive H1 clarifies the main topic for both users and parsers.', how_to_fix = 'Ensure exactly one <h1> per page; match it to the core topic and keep it unique.', common_issues = 'Multiple H1s due to logo or components; missing H1 but large styled divs.', quick_fixes = 'Retag hero heading as <h1>; demote others to <h2>/<h3>.', display_order = 3 WHERE id = 'C3_h1_presence'"

echo "✓ Updated C3_h1_presence"

echo "🎉 Enrichment complete! Run: wrangler d1 execute optiview --remote --command \"SELECT id, LENGTH(why_it_matters) as len FROM scoring_criteria WHERE enabled=1 ORDER BY display_order\" to verify"

