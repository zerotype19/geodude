-- Add final checks from Optiview Score Guide
-- Resolving ID conflicts with existing checks

INSERT OR REPLACE INTO scoring_criteria (
  id, version, label, description, category, scope, weight, impact_level,
  pass_threshold, warn_threshold, check_type, enabled, preview,
  why_it_matters, how_to_fix, references_json,
  points_possible, importance_rank, scoring_approach, examples, view_in_ui,
  common_issues, quick_fixes, learn_more_links, official_docs, display_order
) VALUES
  -- G12: Topic depth & semantic coverage (LLM-based)
  (
    'G12_topic_depth_semantic', 1, 'Topic depth & semantic coverage',
    'Evaluates semantic completeness using LLM topic embeddings.',
    'Content & Clarity', 'page', 8, 'Medium', 85, 60, 'llm', 1, 1,
    'Assistants reward pages covering related intents and co-occurring terms.',
    'Add supporting subtopics, examples, and related terms to show comprehensive understanding.',
    NULL, 100, 2, 'AI-assisted content analysis', NULL, 1,
    'Shallow coverage; missing related concepts; overly narrow focus.',
    'Expand with related questions, examples, and semantic variants.',
    NULL, NULL, 19
  ),
  
  -- G11: Entity graph completeness
  (
    'G11_entity_graph_completeness', 1, 'Entity graph completeness',
    'Measures the presence of internal links and schema connections between entities.',
    'Structure & Organization', 'page', 8, 'Medium', 85, 60, 'html_dom', 1, 1,
    'Strong schema and links help assistants understand how your entities relate.',
    'Add Organization, Product, or Person schema and connect via sameAs or URL references.',
    NULL, 100, 2, 'Automated HTML analysis', NULL, 1,
    'Isolated schema; no entity relationships; missing sameAs links.',
    'Connect entities with bidirectional schema references.',
    NULL, NULL, 20
  ),
  
  -- G6: Canonical fact URLs (note: different from existing G6 factual accuracy in score guide)
  (
    'G6_fact_url_stability', 1, 'Canonical fact URLs',
    'Stable URLs and anchors for key facts or product specs.',
    'Structure & Organization', 'page', 8, 'Medium', 85, 60, 'html_dom', 1, 1,
    'LLMs cite at the fact level; canonical URLs improve retrievability.',
    'Ensure fact-rich pages and anchors remain stable and linkable.',
    NULL, 100, 2, 'Automated HTML analysis', NULL, 1,
    'Changing URLs; missing fragment IDs; no deep-link anchors.',
    'Add stable #anchors to key facts and avoid URL restructuring.',
    NULL, NULL, 21
  ),
  
  -- A8: Sitemaps & discoverability (site-level)
  (
    'A8_sitemap_discoverability', 1, 'Sitemaps & discoverability',
    'Valid XML sitemap with fresh lastmod dates and full coverage.',
    'Crawl & Discoverability', 'site', 6, 'Medium', 85, 60, 'http', 1, 0,
    'Fresh, accurate sitemaps help assistants discover new and updated content quickly.',
    'Regenerate sitemap.xml regularly; include canonical URLs and lastmod attributes.',
    NULL, 100, 2, 'Automated HTTP/XML validation', NULL, 1,
    'Stale lastmod; missing pages; 404 entries; no sitemap index.',
    'Automate sitemap generation on publish; validate weekly.',
    NULL, NULL, 112
  ),
  
  -- T5: AI bot access (renamed from C1 to avoid conflict with C1_title_quality)
  (
    'T5_ai_bot_access', 1, 'AI bot access status',
    'Verifies whether major AI crawlers are allowed in robots.txt and headers.',
    'Crawl & Discoverability', 'site', 10, 'High', 85, 60, 'http', 1, 1,
    'Explicitly allowing GPTBot, Claude-Web, and Perplexity improves visibility in AI systems.',
    'Update robots.txt to allow relevant AI agents and verify header parity.',
    NULL, 100, 1, 'Automated robots.txt + header fetch test', NULL, 1,
    'All AI bots disallowed; conflicting rules; no explicit allow.',
    'Add explicit User-agent rules for GPTBot, Claude-Web, CCBot, PerplexityBot.',
    NULL, NULL, 113
  ),
  
  -- A13: Page speed LCP
  (
    'A13_page_speed_lcp', 1, 'Page speed (LCP)',
    'Largest Contentful Paint below 2.5s target.',
    'Experience & Performance', 'page', 7, 'Medium', 85, 60, 'html_dom', 1, 0,
    'Page speed influences engagement and crawl efficiency.',
    'Optimize media, preconnect to key origins, use lazy-loading.',
    NULL, 100, 2, 'Automated HTML and performance timing proxy', NULL, 1,
    'Slow LCP (>2.5s); unoptimized images; blocking scripts; no CDN.',
    'Compress images; add preconnect; defer non-critical JS.',
    NULL, NULL, 22
  ),
  
  -- A14: Q&A scaffold (renamed from A12 to avoid conflict with A12_entity_graph)
  (
    'A14_qna_scaffold', 1, 'Q&A scaffold',
    'Detects visible FAQ or Q&A blocks that match structured schema.',
    'Content & Clarity', 'page', 10, 'High', 85, 60, 'html_dom', 1, 1,
    'Explicit question-answer pairs improve snippet extraction and citation likelihood.',
    'Add 3–5 Q&A blocks and mark up with FAQPage schema.',
    NULL, 100, 1, 'Automated HTML analysis + schema validation', NULL, 1,
    'No Q&A; schema mismatch; questions without answers; buried below fold.',
    'Add visible Q&A with FAQPage JSON-LD; place above fold on key pages.',
    NULL, NULL, 23
  );

