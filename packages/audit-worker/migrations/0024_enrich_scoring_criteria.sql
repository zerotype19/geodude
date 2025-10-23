-- Enrich scoring criteria with detailed content
-- Migration: 0024_enrich_scoring_criteria.sql

-- Update all 36 criteria with detailed educational content

UPDATE scoring_criteria SET 
  why_it_matters = "Titles are the strongest machine signal for page focus. Clear, branded titles increase click-through, snippet quality, and reduce entity confusion.",
  how_to_fix = "1) Keep 15–65 chars. 2) Lead with the topic/intent; end with brand on key pages. 3) Use one primary keyword; avoid stuffing. 4) Make each page title unique.",
  common_issues = "Missing <title>; duplicated across many pages; over 70 chars; vague marketing taglines; keyword stuffing; brand only with no topic.",
  quick_fixes = "Export duplicate titles; rewrite to 'Topic – Brand'; trim to <65 chars; add primary intent term.",
  references_json = '["https://developers.google.com/search/docs/appearance/title-link","https://ahrefs.com/blog/title-tags/"]',
  learn_more_links = "Good examples of descriptive titles and brand placement.",
  official_docs = "Google Search Central: Title links",
  display_order = 1
WHERE id = 'C1_title_quality';

UPDATE scoring_criteria SET 
  why_it_matters = "Well-written descriptions help assistants and search systems generate useful snippets and set user expectations.",
  how_to_fix = "1) Add one <meta name=\"description\"> per page. 2) Aim for 120–155 chars. 3) Summarize the key value and who it's for. 4) Avoid quotes and boilerplate.",
  common_issues = "Missing tag; too short (<50 chars) or too long (>180); duplicated sitewide; keyword lists; generic 'Welcome' copy.",
  quick_fixes = "Autofill from first paragraph, then hand-edit top pages; ensure uniqueness by URL.",
  references_json = '["https://developers.google.com/search/docs/appearance/snippet","https://moz.com/learn/seo/meta-description"]',
  learn_more_links = "Guidance on crafting compelling meta descriptions.",
  official_docs = "Google Search Central: Meta descriptions",
  display_order = 2
WHERE id = 'C2_meta_description';

UPDATE scoring_criteria SET 
  why_it_matters = "A single, descriptive H1 clarifies the main topic for both users and parsers.",
  how_to_fix = "Ensure exactly one <h1> per page; match it to the core topic and keep it unique.",
  common_issues = "Multiple H1s due to logo or components; missing H1 but large styled divs.",
  quick_fixes = "Retag hero heading as <h1>; demote others to <h2>/<h3>.",
  references_json = '["https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements"]',
  learn_more_links = "Heading levels and accessibility.",
  official_docs = "MDN: Headings",
  display_order = 3
WHERE id = 'C3_h1_presence';

UPDATE scoring_criteria SET 
  why_it_matters = "Answer-first pages help assistants generate useful, confident answers and improve snippet capture.",
  how_to_fix = "Lead with a 1–2 sentence value/answer and a primary CTA in the hero. Keep fluff below the fold.",
  common_issues = "Vague hero; no explicit value; CTA hidden; jargon-heavy copy.",
  quick_fixes = "Add a crisp summary and a 'Get started' CTA in the first viewport.",
  references_json = '[]',
  learn_more_links = "Examples of answer-first hero copy.",
  official_docs = NULL,
  display_order = 4
WHERE id = 'A1_answer_first';

UPDATE scoring_criteria SET 
  why_it_matters = "Proper heading hierarchy improves extractability and accessibility. Assistants scan this structure for answers.",
  how_to_fix = "Use descending levels without skipping (H1→H2→H3). Don't style divs as headings—use real tags.",
  common_issues = "H1 followed by H3/H4; headings used for styling only; empty headings.",
  quick_fixes = "Convert styled blocks to proper heading tags; fill missing H2s between levels.",
  references_json = '["https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements"]',
  learn_more_links = "Semantic structure best practices.",
  official_docs = "MDN: Headings",
  display_order = 5
WHERE id = 'A2_headings_semantic';

UPDATE scoring_criteria SET 
  why_it_matters = "Visible FAQs increase the chances your page is cited for direct questions.",
  how_to_fix = "Add a 'Frequently asked questions' section with 3–6 concise Q&As that match real queries.",
  common_issues = "Accordion without headings; marketing Qs that users never ask; answers too long.",
  quick_fixes = "Pull top questions from search console/support; write 2–3 sentence answers.",
  references_json = '[]',
  learn_more_links = "Writing good FAQ entries.",
  official_docs = NULL,
  display_order = 6
WHERE id = 'A3_faq_presence';

UPDATE scoring_criteria SET 
  why_it_matters = "FAQPage JSON-LD enables rich answers and reliable extraction by assistants. It boosts snippetability and answer coverage.",
  how_to_fix = "1) Mark visible Q&A blocks with schema.org/FAQPage. 2) Include ≥3 questions with concise accepted answers. 3) Keep answers <= 300 chars where possible. 4) Ensure JSON-LD matches on-page text.",
  common_issues = "Schema present but no visible FAQ; mismatched Q/A text; fewer than 3 items; invalid JSON; duplicated questions.",
  quick_fixes = "Generate FAQ JSON-LD from your visible questions; validate with a schema tester; ensure each Q has a clear acceptedAnswer.",
  references_json = '["https://schema.org/FAQPage","https://developers.google.com/search/docs/appearance/structured-data/faqpage"]',
  learn_more_links = "Examples of valid FAQPage markup with multiple entries.",
  official_docs = "Google: FAQ structured data",
  display_order = 7
WHERE id = 'A4_schema_faqpage';

UPDATE scoring_criteria SET 
  why_it_matters = "Healthy internal links help crawlers discover related content and establish topical clusters.",
  how_to_fix = "Add 3–10 contextual links per page to related guides or products with descriptive anchors.",
  common_issues = "Menu-only links; 'learn more' anchors; orphan pages.",
  quick_fixes = "Add 'Related' section; convert generic anchors to descriptive phrases.",
  references_json = '["https://developers.google.com/search/docs/fundamentals/seo-starter-guide#linking"]',
  learn_more_links = "Internal linking for topic clusters.",
  official_docs = "Google SEO Starter Guide",
  display_order = 8
WHERE id = 'A9_internal_linking';

UPDATE scoring_criteria SET 
  why_it_matters = "Canonicals reduce duplicate content and help assistants choose the right URL to cite and index.",
  how_to_fix = "1) Add <link rel=\"canonical\" href=\"...\"> on indexable pages. 2) Point to the preferred same-host URL (HTTPS). 3) Avoid chains and cross-domain canonicals unless necessary.",
  common_issues = "Missing canonical; self-referencing wrong protocol; pointing to non-200 URL; multiple canonicals; cross-domain without need.",
  quick_fixes = "Self-canonicalize primary pages; fix http→https; remove duplicates in head.",
  references_json = '["https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls","https://yoast.com/rel-canonical/"]',
  learn_more_links = "When and how to use canonical URLs.",
  official_docs = "Google: Consolidate duplicate URLs",
  display_order = 9
WHERE id = 'G10_canonical';

UPDATE scoring_criteria SET 
  why_it_matters = "The viewport meta tag ensures responsive rendering on mobile—critical for usability and indexing.",
  how_to_fix = "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">. Avoid maximum-scale=1 that blocks zoom.",
  common_issues = "Missing tag; desktop viewport meta; preventing zoom; duplicated metas.",
  quick_fixes = "Add a single correct viewport tag in base layout.",
  references_json = '["https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag"]',
  learn_more_links = "Viewport configuration examples.",
  official_docs = "MDN: Viewport meta tag",
  display_order = 10
WHERE id = 'T1_mobile_viewport';

UPDATE scoring_criteria SET 
  why_it_matters = "Correct language hints improve international targeting and text processing for assistants.",
  how_to_fix = "1) Set <html lang=\"en\"> or locale like en-US. 2) Keep consistent with content language. 3) Use hreflang for alternates (separate feature).",
  common_issues = "Missing lang; wrong locale; conflicting hreflang; copy/paste 'en-UK' (invalid) instead of 'en-GB'.",
  quick_fixes = "Add lang on <html>; standardize to ISO codes.",
  references_json = '["https://www.w3.org/International/questions/qa-html-language-declarations","https://developers.google.com/search/docs/specialty/international/localized-versions"]',
  learn_more_links = "Language/locale best practices for HTML.",
  official_docs = "W3C: Language declarations",
  display_order = 11
WHERE id = 'T2_lang_region';

UPDATE scoring_criteria SET 
  why_it_matters = "Noindex/nofollow or restrictive robots directives prevent assistants from accessing content.",
  how_to_fix = "Remove noindex on canonical pages; ensure robots meta defaults to index,follow; verify disallow rules in robots.txt.",
  common_issues = "Noindex left from staging; JS injecting meta robots; global disallow in robots.txt.",
  quick_fixes = "Audit templates for robots meta; remove legacy disallow; re-crawl.",
  references_json = '["https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag","https://developers.google.com/search/docs/crawling-indexing/robots/intro"]',
  learn_more_links = "Robots directives that block indexing.",
  official_docs = "Google: Robots meta tag, robots.txt",
  display_order = 12
WHERE id = 'T3_noindex_robots';

UPDATE scoring_criteria SET 
  why_it_matters = "Organization schema with logo and sameAs links helps assistants resolve your identity and connect profiles.",
  how_to_fix = "Add Organization/LocalBusiness JSON-LD with name, url, logo, sameAs (≥2), and contact options where relevant.",
  common_issues = "Logo URL invalid; sameAs to home URL; schema hidden on some pages.",
  quick_fixes = "Centralize org schema in layout with dynamic sameAs list.",
  references_json = '["https://schema.org/Organization","https://schema.org/LocalBusiness"]',
  learn_more_links = "Entity graph basics for brands.",
  official_docs = "Schema.org: Organization",
  display_order = 13
WHERE id = 'A12_entity_graph';

UPDATE scoring_criteria SET 
  why_it_matters = "OG tags provide consistent title/description/image/url to sharing surfaces and assistants that build rich cards.",
  how_to_fix = "1) Include og:title, og:description, og:url, og:image. 2) Use absolute URL for og:image (min ~1200×630). 3) Keep OG title ≤65 chars.",
  common_issues = "Missing og:image; relative URLs; mismatch with page title; generic homepage OG reused everywhere.",
  quick_fixes = "Add a default card generator; set per-page OG values; ensure absolute image URLs.",
  references_json = '["https://ogp.me/","https://developers.facebook.com/docs/sharing/webmasters/"]',
  learn_more_links = "Open Graph essentials and examples.",
  official_docs = "Open Graph protocol",
  display_order = 13
WHERE id = 'G2_og_tags_completeness';

UPDATE scoring_criteria SET 
  why_it_matters = "Pages that connect entities (people, orgs, products) via links and schema are easier to map into knowledge graphs.",
  how_to_fix = "Link entities to their canonical pages; add Organization/Product/Person schema; connect with sameAs and url.",
  common_issues = "Entity mentions without links; missing schema; orphan entity pages.",
  quick_fixes = "Add inline links on first mention; include schema with '@id' or 'url'.",
  references_json = '["https://schema.org/Organization","https://schema.org/Person","https://schema.org/Product"]',
  learn_more_links = "Entity linking patterns.",
  official_docs = "Schema.org types",
  display_order = 14
WHERE id = 'G11_entity_graph_completeness';

UPDATE scoring_criteria SET 
  why_it_matters = "Stable IDs/anchors enable assistants to cite specific facts on your page without breaking links.",
  how_to_fix = "Add stable id attributes to fact sections/tables; avoid changing anchors on deploys.",
  common_issues = "Dynamic IDs; headings without IDs; changing URLs for the same fact.",
  quick_fixes = "Add predictable 'id' to key H2/H3s; use anchored links in ToC.",
  references_json = '[]',
  learn_more_links = "Designing stable anchors for citations.",
  official_docs = NULL,
  display_order = 15
WHERE id = 'G6_fact_url_stability';

UPDATE scoring_criteria SET 
  why_it_matters = "A visible hero CTA improves conversion and gives assistants a clear next step for users.",
  how_to_fix = "Place a single primary CTA in the hero (e.g., Sign up, Request demo). Ensure color contrast and prominence.",
  common_issues = "Multiple CTAs competing; weak contrast; CTA buried below fold.",
  quick_fixes = "Promote one CTA; move it into the first viewport; use action language.",
  references_json = '[]',
  learn_more_links = "CTA placement patterns.",
  official_docs = NULL,
  display_order = 16
WHERE id = 'A6_contact_cta_presence';

UPDATE scoring_criteria SET 
  why_it_matters = "A related questions section captures longer-tail intents and supplies extractable answers.",
  how_to_fix = "Add a 'People also ask' style block summarizing 3–6 related Q&As or links to deeper content.",
  common_issues = "Questions without answers; duplicate of FAQ; no links to details.",
  quick_fixes = "Write 1–2 sentence answers and link to full resources.",
  references_json = '[]',
  learn_more_links = "Designing related questions.",
  official_docs = NULL,
  display_order = 17
WHERE id = 'A5_related_questions_block';

UPDATE scoring_criteria SET 
  why_it_matters = "Covering related subtopics and terms signals topical authority to assistants.",
  how_to_fix = "Expand with definitions, comparisons, examples, and alternatives. Include key co-occurring terms naturally.",
  common_issues = "Overly brief pages; only skim the topic; no examples or comparisons.",
  quick_fixes = "Add a 'Key concepts' subsection; include 2–3 examples and a comparison table.",
  references_json = '[]',
  learn_more_links = "What semantic coverage means for AEO.",
  official_docs = NULL,
  display_order = 18
WHERE id = 'G12_topic_depth_semantic';

UPDATE scoring_criteria SET 
  why_it_matters = "Explicit Q&A scaffolds are easy for assistants to parse and quote, improving citation odds.",
  how_to_fix = "Add a short Q&A list or TL;DR block near the top. Use FAQ schema when appropriate.",
  common_issues = "Q&A exists but hidden behind tabs; no schema; answers too long.",
  quick_fixes = "Add a 3–5 item Q&A block with 1–3 sentence answers.",
  references_json = '[]',
  learn_more_links = "Q&A patterns that parse well.",
  official_docs = NULL,
  display_order = 19
WHERE id = 'A14_qna_scaffold';

UPDATE scoring_criteria SET 
  why_it_matters = "Preconnect/preload and lazy loading reduce blocking work and help LCP/FCP.",
  how_to_fix = "1) Preconnect to critical origins. 2) Preload hero font and image. 3) Lazy-load below-the-fold media. 4) Defer non-critical scripts.",
  common_issues = "No preconnect to CDN; large images not preloaded; all images eager; blocking scripts in head.",
  quick_fixes = "Add <link rel=\"preconnect\"> to CDN; lazy-load non-hero images; defer analytics script.",
  references_json = '["https://web.dev/fast/","https://web.dev/optimize-lcp/"]',
  learn_more_links = "Practical patterns to improve LCP.",
  official_docs = "web.dev performance guides",
  display_order = 20
WHERE id = 'T4_core_web_vitals_hints';

UPDATE scoring_criteria SET 
  why_it_matters = "Large, unoptimized hero assets slow down LCP and reduce engagement.",
  how_to_fix = "Compress hero image/video; serve responsive sizes (srcset); use preload for the single hero image; inline critical CSS.",
  common_issues = "4K hero images; background images with no sizing; render-blocking CSS/JS.",
  quick_fixes = "Convert hero to WebP/AVIF; cap hero width; preload one largest element.",
  references_json = '["https://web.dev/optimize-lcp/","https://web.dev/lcp/"]',
  learn_more_links = "Largest Contentful Paint optimization steps.",
  official_docs = "web.dev: LCP",
  display_order = 21
WHERE id = 'A13_page_speed_lcp';

UPDATE scoring_criteria SET 
  why_it_matters = "Sections with thin content make it harder for assistants to extract complete answers.",
  how_to_fix = "For each H2, aim for ≥100–150 words of explanatory text, bullets, tables, or examples.",
  common_issues = "Heading lists with no body; decorative headings; one-line sections.",
  quick_fixes = "Expand thin sections; merge redundant H2s; add a summary paragraph.",
  references_json = '[]',
  learn_more_links = "How assistants parse sections for answers.",
  official_docs = NULL,
  display_order = 6
WHERE id = 'C5_h2_coverage_ratio';

-- Site-level checks

UPDATE scoring_criteria SET 
  why_it_matters = "Sitewide adoption of FAQ schema increases coverage of answerable surfaces and consistency across pages.",
  how_to_fix = "Identify key informational pages and add valid FAQPage JSON-LD to each with visible Q&A content. Track adoption in your CMS.",
  common_issues = "Schema only on a few pages; invalid JSON-LD; markup that doesn't match visible content.",
  quick_fixes = "Create a reusable FAQ component + JSON-LD generator; roll out to top 50 pages.",
  references_json = '["https://schema.org/FAQPage","https://developers.google.com/search/docs/appearance/structured-data/faqpage"]',
  learn_more_links = "Rolling out schema at scale.",
  official_docs = "Google: FAQ structured data",
  display_order = 101
WHERE id = 'S2_faq_schema_adoption_pct';

UPDATE scoring_criteria SET 
  why_it_matters = "Higher canonical correctness means fewer duplicates and cleaner indexing across the site.",
  how_to_fix = "Audit canonicals; self-canonicalize preferred URLs; fix protocol/host mismatches; remove conflicting tags.",
  common_issues = "Mixed http/https; pointing to redirected URLs; missing on templated pages.",
  quick_fixes = "Add a canonical helper in layout head; enforce https host.",
  references_json = '["https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls"]',
  learn_more_links = "Duplicate handling strategies.",
  official_docs = "Google: Consolidate duplicate URLs",
  display_order = 102
WHERE id = 'S3_canonical_correct_pct';

UPDATE scoring_criteria SET 
  why_it_matters = "Consistent language declarations prevent mis-classification and improve snippet quality in the right locale.",
  how_to_fix = "Standardize <html lang> across templates; validate alternates with hreflang if used.",
  common_issues = "Missing lang on some templates; inconsistent locales (en vs en-US).",
  quick_fixes = "Set lang at the layout level; lint during CI.",
  references_json = '["https://www.w3.org/International/questions/qa-html-language-declarations"]',
  learn_more_links = "HTML language and locale tips.",
  official_docs = "W3C i18n",
  display_order = 103
WHERE id = 'S5_lang_correct_pct';

UPDATE scoring_criteria SET 
  why_it_matters = "Duplicate titles dilute relevance and make it harder for assistants to choose the right URL.",
  how_to_fix = "Deduplicate by adding topic modifiers (city, product, intent). Enforce unique title generator rules in CMS.",
  common_issues = "List pages all titled the same; boilerplate titles from templates.",
  quick_fixes = "Append differentiators (\"Pricing\", \"Features\", \"vs\", \"2025\").",
  references_json = '["https://developers.google.com/search/docs/appearance/title-link"]',
  learn_more_links = "Uniqueness strategies for titles.",
  official_docs = "Google: Title links",
  display_order = 104
WHERE id = 'S7_dup_title_pct';

UPDATE scoring_criteria SET 
  why_it_matters = "More pages with complete OG tags yields better unfurls, sharing, and assistant cards.",
  how_to_fix = "Bake OG into base layout with per-page overrides. Generate images dynamically for programmatic pages.",
  common_issues = "Single global OG image; missing on blog/product templates.",
  quick_fixes = "Add fallbacks; verify absolute og:image URLs; run a sitewide check.",
  references_json = '["https://ogp.me/"]',
  learn_more_links = "Scaling OG tags across a site.",
  official_docs = "Open Graph protocol",
  display_order = 105
WHERE id = 'S9_og_tags_coverage_pct';

UPDATE scoring_criteria SET 
  why_it_matters = "Average section depth across the site correlates with perceived topical authority.",
  how_to_fix = "Raise content depth on thin templates; enforce minimum body length after each H2.",
  common_issues = "Programmatic pages with headings only; boilerplate sections.",
  quick_fixes = "Set CMS rules for minimum wordcount per section; add examples or FAQs.",
  references_json = '[]',
  learn_more_links = "Section depth and topic coverage.",
  official_docs = NULL,
  display_order = 106
WHERE id = 'S8_avg_h2_coverage';

UPDATE scoring_criteria SET 
  why_it_matters = "A higher share of pages with adequate internal links improves discovery and context signals.",
  how_to_fix = "Define per-template link targets (pillar ↔ cluster). Add 'Related' blocks and inline links.",
  common_issues = "Thin link graphs; only nav/footer links; isolated articles.",
  quick_fixes = "Batch add 3–5 contextual links per page to connected topics.",
  references_json = '[]',
  learn_more_links = "Topic clusters and link structure.",
  official_docs = NULL,
  display_order = 107
WHERE id = 'S11_internal_link_health_pct';

UPDATE scoring_criteria SET 
  why_it_matters = "Broad FAQ coverage increases the number of queries your site can directly answer.",
  how_to_fix = "Identify top traffic pages and add a 3–6 question FAQ block with concise answers.",
  common_issues = "Only the homepage has FAQs; answers are rambling; duplicated Qs.",
  quick_fixes = "Template a FAQ section and roll it out to key templates.",
  references_json = '[]',
  learn_more_links = "Scaling FAQs across a site.",
  official_docs = NULL,
  display_order = 108
WHERE id = 'S1_faq_coverage_pct';

UPDATE scoring_criteria SET 
  why_it_matters = "A higher share of pages with a visible CTA improves assistant-to-action continuity.",
  how_to_fix = "Ensure each template has a prominent, single primary CTA in the hero.",
  common_issues = "CTAs hidden; multiple conflicting actions; low contrast.",
  quick_fixes = "Standardize a hero CTA component; audit color contrast.",
  references_json = '[]',
  learn_more_links = "CTA design systems.",
  official_docs = NULL,
  display_order = 109
WHERE id = 'S10_cta_above_fold_pct';

UPDATE scoring_criteria SET 
  why_it_matters = "Sitewide org schema adoption reduces identity ambiguity across assistants and knowledge panels.",
  how_to_fix = "Roll out Organization/LocalBusiness JSON-LD to all key templates with the same @id/logo/sameAs set.",
  common_issues = "Schema present only on homepage; inconsistent fields; different logos per template.",
  quick_fixes = "Move schema to base layout; verify fields with a structured data tester.",
  references_json = '["https://schema.org/Organization"]',
  learn_more_links = "Rolling out organization schema.",
  official_docs = "Schema.org: Organization",
  display_order = 110
WHERE id = 'S6_entity_graph_adoption_pct';

UPDATE scoring_criteria SET 
  why_it_matters = "Fresh, valid sitemaps accelerate discovery and reflect update cadence.",
  how_to_fix = "Serve sitemap.xml (or index) with <loc> and <lastmod>; include canonical URLs; update on publish.",
  common_issues = "Missing sitemap; wrong host; stale lastmod; non-canonical URLs.",
  quick_fixes = "Enable auto-generation in CMS; ping search engines on deploy.",
  references_json = '["https://www.sitemaps.org/","https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview"]',
  learn_more_links = "Sitemap formats and best practices.",
  official_docs = "Sitemaps.org; Google: Sitemaps",
  display_order = 111
WHERE id = 'A8_sitemap_discoverability';

UPDATE scoring_criteria SET 
  why_it_matters = "Allowing reputable AI crawlers increases the chance your content is included in assistant knowledge.",
  how_to_fix = "In robots.txt, explicitly allow GPTBot, Claude-Web, PerplexityBot (as appropriate) and ensure parity with user HTML.",
  common_issues = "Global Disallow; blocking AI bots while allowing search; mismatch between robots and meta robots.",
  quick_fixes = "Add User-agent blocks with Allow rules; verify fetch parity on representative pages.",
  references_json = '["https://openai.com/gptbot","https://www.anthropic.com/claude/claude-web","https://docs.perplexity.ai/docs/ai-crawler"]',
  learn_more_links = "Balancing access and policy for AI crawlers.",
  official_docs = "GPTBot/Claude-Web/Perplexity crawler docs",
  display_order = 112
WHERE id = 'T5_ai_bot_access';

UPDATE scoring_criteria SET 
  why_it_matters = "A higher share of mobile-ready pages improves sitewide usability and indexability.",
  how_to_fix = "Ensure all templates include the correct viewport meta and responsive layout.",
  common_issues = "Some templates missing viewport; legacy pages fixed-width.",
  quick_fixes = "Add viewport to base layout; audit responsive breakpoints.",
  references_json = '["https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag"]',
  learn_more_links = "Sitewide mobile readiness checklist.",
  official_docs = "MDN: Viewport meta tag",
  display_order = 113
WHERE id = 'S4_mobile_ready_pct';

