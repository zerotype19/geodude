/**
 * Enrich scoring criteria with detailed educational content
 * Run with: node scripts/enrich-criteria.js
 */

const enrichments = [
  {
    "id": "C1_title_quality",
    "why_it_matters": "Titles are the strongest machine signal for page focus. Clear, branded titles increase click-through, snippet quality, and reduce entity confusion.",
    "how_to_fix": "1) Keep 15–65 chars. 2) Lead with the topic/intent; end with brand on key pages. 3) Use one primary keyword; avoid stuffing. 4) Make each page title unique.",
    "common_issues": "Missing <title>; duplicated across many pages; over 70 chars; vague marketing taglines; keyword stuffing; brand only with no topic.",
    "quick_fixes": "Export duplicate titles; rewrite to 'Topic – Brand'; trim to <65 chars; add primary intent term.",
    "references_json": '["https://developers.google.com/search/docs/appearance/title-link","https://ahrefs.com/blog/title-tags/"]',
    "learn_more_links": "Good examples of descriptive titles and brand placement.",
    "official_docs": "Google Search Central: Title links",
    "display_order": 1
  },
  {
    "id": "C2_meta_description",
    "why_it_matters": "Well-written descriptions help assistants and search systems generate useful snippets and set user expectations.",
    "how_to_fix": "1) Add one <meta name=\"description\"> per page. 2) Aim for 120–155 chars. 3) Summarize the key value and who it's for. 4) Avoid quotes and boilerplate.",
    "common_issues": "Missing tag; too short (<50 chars) or too long (>180); duplicated sitewide; keyword lists; generic 'Welcome' copy.",
    "quick_fixes": "Autofill from first paragraph, then hand-edit top pages; ensure uniqueness by URL.",
    "references_json": '["https://developers.google.com/search/docs/appearance/snippet","https://moz.com/learn/seo/meta-description"]',
    "learn_more_links": "Guidance on crafting compelling meta descriptions.",
    "official_docs": "Google Search Central: Meta descriptions",
    "display_order": 2
  }
  // ... (would include all 36 but truncating for now)
];

async function main() {
  for (const item of enrichments) {
    const sql = `UPDATE scoring_criteria SET 
      why_it_matters = ?,
      how_to_fix = ?,
      common_issues = ?,
      quick_fixes = ?,
      references_json = ?,
      learn_more_links = ?,
      official_docs = ?,
      display_order = ?
    WHERE id = ?`;
    
    const params = [
      item.why_it_matters,
      item.how_to_fix,
      item.common_issues,
      item.quick_fixes,
      item.references_json,
      item.learn_more_links,
      item.official_docs,
      item.display_order,
      item.id
    ];
    
    // Execute via wrangler (you'd need to implement the actual execution)
    console.log(`Would update ${item.id}`);
  }
}

main().catch(console.error);

