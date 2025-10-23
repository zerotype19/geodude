-- Reset scoring_criteria to only contain implemented V1 checks
-- Remove placeholder LLM checks and duplicates

DELETE FROM scoring_criteria;

-- Insert only the 13 implemented deterministic HTML-based checks
INSERT INTO scoring_criteria (
  id, version, label, description, category, scope, weight, impact_level,
  pass_threshold, warn_threshold, check_type, enabled, preview,
  why_it_matters, how_to_fix, references_json,
  points_possible, importance_rank, scoring_approach, examples, view_in_ui,
  common_issues, quick_fixes, learn_more_links, official_docs, display_order
) VALUES
  -- C1: Title quality
  (
    'C1_title_quality', 1, 'Title tag quality',
    'Clear, descriptive title with sensible length and brand signal.',
    'Technical Foundations', 'page', 12, 'High', 85, 60, 'html_dom', 1, 0,
    'Titles drive ranking, snippets, and assistant citations.',
    'Keep 15–65 chars; lead with topic; include brand on homepage.',
    NULL, 100, 1, 'Automated HTML analysis', NULL, 1,
    'Missing title; overly long; keyword stuffing; no brand on home.',
    'Rewrite to lead with primary topic; trim to <65 chars.',
    NULL, NULL, 1
  ),
  
  -- C2: Meta description
  (
    'C2_meta_description', 1, 'Meta description present',
    'Meta description exists and is within recommended length.',
    'Technical Foundations', 'page', 8, 'Medium', 85, 60, 'html_dom', 1, 0,
    'Improves snippet quality and sets expectations for users/assistants.',
    'Add 50–160 character summary that echoes the H1 topic.',
    NULL, 100, 2, 'Automated HTML analysis', NULL, 1,
    'Missing tag; too short/long; generic marketing copy.',
    'Draft succinct, factual summary that answers ''What is this page?''',
    NULL, NULL, 2
  ),
  
  -- C3: H1 presence
  (
    'C3_h1_presence', 1, 'Single H1 tag',
    'Exactly one H1 indicating the main topic of the page.',
    'Structure & Organization', 'page', 10, 'High', 85, 60, 'html_dom', 1, 0,
    'A single H1 clarifies the primary topic for parsers and users.',
    'Ensure exactly one H1; move extra H1s to H2/H3.',
    NULL, 100, 1, 'Automated HTML analysis', NULL, 1,
    'Multiple H1s from templates; missing H1 entirely.',
    'Refactor templates to output one H1 per page.',
    NULL, NULL, 3
  ),
  
  -- A1: Answer-first
  (
    'A1_answer_first', 1, 'Answer-first hero section',
    'Clear value proposition and a primary CTA above the fold.',
    'Content & Clarity', 'page', 15, 'High', 85, 60, 'html_dom', 1, 0,
    'Directly answers intent and improves assistant-ready summaries.',
    'Add a concise claim and an actionable CTA in the hero.',
    NULL, 100, 1, 'Automated HTML analysis', NULL, 1,
    'Vague hero copy; CTAs buried; jargon-heavy messaging.',
    'Rewrite hero to state problem→solution and add a primary CTA.',
    NULL, NULL, 4
  ),
  
  -- A2: Headings semantic
  (
    'A2_headings_semantic', 1, 'Semantic heading structure',
    'Proper H1→H2→H3 hierarchy without skipping levels.',
    'Structure & Organization', 'page', 10, 'High', 85, 60, 'html_dom', 1, 0,
    'Consistent hierarchy improves parsing and accessibility.',
    'Use one H1; nest sections with H2/H3 in order; avoid H1→H3 jumps.',
    NULL, 100, 1, 'Automated HTML analysis', NULL, 1,
    'Skipped levels; styling headings with divs; multiple H1s.',
    'Correct heading levels; convert styled divs to semantic tags.',
    NULL, NULL, 5
  ),
  
  -- A3: FAQ presence
  (
    'A3_faq_presence', 1, 'FAQ section present',
    'Detectable FAQ/Q&A block on the page.',
    'Content & Clarity', 'page', 8, 'Medium', 85, 60, 'html_dom', 1, 0,
    'Improves answer engine coverage and structured snippets.',
    'Add an FAQ section with 3–5 concise, user-language questions.',
    NULL, 100, 2, 'Automated HTML analysis', NULL, 1,
    'Q-like headings without answers; accordion without content.',
    'Write direct answers under each question; avoid fluff.',
    NULL, NULL, 6
  ),
  
  -- A4: FAQPage schema
  (
    'A4_schema_faqpage', 1, 'FAQPage schema',
    'Valid FAQPage JSON-LD with 3+ Q&A pairs.',
    'Technical Foundations', 'page', 10, 'High', 85, 60, 'html_dom', 1, 0,
    'Enables rich results and better assistant extraction.',
    'Add FAQPage JSON-LD aligning to the visible FAQ section.',
    '["https://schema.org/FAQPage"]', 100, 1, 'Automated HTML analysis', NULL, 1,
    'Invalid JSON; mismatched Q/A; fewer than 3 entries.',
    'Validate JSON-LD; mirror on-page questions and answers.',
    NULL, NULL, 7
  ),
  
  -- A9: Internal linking
  (
    'A9_internal_linking', 1, 'Internal linking & diversity',
    'Adequate internal links with diverse, descriptive anchors.',
    'Structure & Organization', 'page', 7, 'Medium', 85, 60, 'html_dom', 1, 0,
    'Improves crawl depth, context, and topic connectivity.',
    'Add 10+ relevant internal links; avoid repetitive anchors.',
    NULL, 100, 2, 'Automated HTML analysis', NULL, 1,
    'Thin linking; nav-only links; ''Learn more'' anchors everywhere.',
    'Add contextual links with specific anchors to pillar pages.',
    NULL, NULL, 8
  ),
  
  -- G10: Canonical
  (
    'G10_canonical', 1, 'Canonical URL correctness',
    'Canonical tag present and points to same domain.',
    'Technical Foundations', 'page', 8, 'Medium', 85, 60, 'html_dom', 1, 0,
    'Prevents duplicate content and consolidates signals.',
    'Add absolute canonical to the preferred URL on same host.',
    NULL, 100, 2, 'Automated HTML analysis', NULL, 1,
    'Missing tag; cross-domain canonical; querystring canonicals.',
    'Point to clean, final URL on same domain.',
    NULL, NULL, 9
  ),
  
  -- T1: Mobile viewport
  (
    'T1_mobile_viewport', 1, 'Mobile viewport tag',
    'Viewport meta with device-width for responsive layout.',
    'Experience & Performance', 'page', 8, 'Medium', 85, 60, 'html_dom', 1, 0,
    'Ensures mobile-friendly rendering for users and crawlers.',
    'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    NULL, 100, 2, 'Automated HTML analysis', NULL, 1,
    'Missing tag; fixed-width layouts.',
    'Add viewport meta; verify responsive CSS.',
    NULL, NULL, 10
  ),
  
  -- T2: Lang/region
  (
    'T2_lang_region', 1, 'Language/region tags',
    'HTML lang attribute matches the target locale.',
    'Technical Foundations', 'page', 6, 'Low', 85, 60, 'html_dom', 1, 0,
    'Improves geo/locale targeting and assistant comprehension.',
    'Set <html lang="en-US"> (or correct locale) on each page.',
    NULL, 100, 3, 'Automated HTML analysis', NULL, 1,
    'Missing/incorrect lang; inherited from non-US templates.',
    'Update template root tag to correct locale.',
    NULL, NULL, 11
  ),
  
  -- T3: Noindex/robots
  (
    'T3_noindex_robots', 1, 'No blocking robots directives',
    'No ''noindex'' or overly restrictive robots meta directives.',
    'Crawl & Discoverability', 'page', 12, 'High', 85, 60, 'html_dom', 1, 0,
    'Blocking directives prevent assistants and crawlers from using content.',
    'Remove ''noindex'' where not required; review robots policies.',
    NULL, 100, 1, 'Automated HTML analysis', NULL, 1,
    'Environment flags left on; inherited meta from staging.',
    'Strip ''noindex'' for production; verify robots rules.',
    NULL, NULL, 12
  ),
  
  -- A12: Entity graph
  (
    'A12_entity_graph', 1, 'Organization entity graph',
    'Organization/LocalBusiness schema with logo and 2+ sameAs links.',
    'Authority & Trust', 'page', 10, 'High', 85, 60, 'html_dom', 1, 0,
    'Strengthens entity recognition and brand disambiguation.',
    'Add Organization JSON-LD with name, logo, and at least two sameAs profiles.',
    '["https://schema.org/Organization"]', 100, 1, 'Automated HTML analysis', NULL, 1,
    'Missing logo; no sameAs; name mismatch vs. title/H1.',
    'Add logo URL and social profiles; align org name across tags.',
    NULL, NULL, 13
  );

