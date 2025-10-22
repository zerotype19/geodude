-- Populate scoring_criteria with full content
-- Based on Score V1 checks and industry best practices

-- ============================================================================
-- TECHNICAL FOUNDATIONS
-- ============================================================================

UPDATE scoring_criteria SET
  label = 'Title Tag Quality',
  description = 'Your page title should be clear, descriptive, and optimized for search engines and AI assistants',
  importance_rank = 1,
  points_possible = 100,
  scoring_approach = 'Automated HTML analysis',
  
  why_it_matters = 'The title tag is one of the most important on-page SEO elements. It appears in search results, browser tabs, and is used by AI assistants to understand page content. A well-crafted title improves click-through rates and search visibility.',
  
  how_to_fix = 'Keep titles between 50-60 characters. Include your primary keyword near the beginning. Add your brand name at the end. Make it compelling and clickable. Avoid keyword stuffing or generic phrases.',
  
  examples = 'Good: "Best CRM Software 2024 | Features & Pricing - Acme"
• Specific, includes keywords naturally
• Has brand name
• Clear value proposition

Bad: "Home | Welcome | Acme Inc | CRM Software Company"
• Generic and keyword-stuffed
• Wastes characters
• No clear value',
  
  view_in_ui = 'Check the Page Details tab → Technical section → Title tag',
  
  common_issues = '• Title too short (under 30 chars) or too long (over 65 chars)
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
    {"label": "Google Search Central - Title Links", "url": "https://developers.google.com/search/docs/appearance/title-link"}
  ]',
  
  category = 'Technical Foundations',
  display_order = 1
WHERE id = 'C1_title_quality';

UPDATE scoring_criteria SET
  label = 'Meta Description',
  description = 'Meta descriptions should summarize page content in 50-160 characters',
  importance_rank = 2,
  points_possible = 100,
  scoring_approach = 'Automated HTML analysis',
  
  why_it_matters = 'While not a direct ranking factor, meta descriptions appear in search results and influence click-through rates. They provide context to both users and AI systems about page content.',
  
  how_to_fix = 'Write unique, compelling descriptions for each page. Include primary keywords naturally. Keep length between 50-160 characters. Make it action-oriented and benefit-focused.',
  
  examples = 'Good: "Discover how our CRM helps teams close 40% more deals. Free trial, no credit card required."
• Action-oriented with benefits
• Includes keywords naturally
• Proper length (under 160 chars)

Bad: "Acme Inc provides CRM software solutions for businesses of all sizes worldwide."
• Generic and boring
• No call-to-action
• Misses key benefits',
  
  view_in_ui = 'Page Details → Technical → Meta Description',
  
  common_issues = '• Missing meta description
• Too short (under 50 chars) or too long (over 160 chars)
• Duplicate descriptions
• Keyword stuffing
• No call-to-action',
  
  quick_fixes = '1. Add unique descriptions to all pages
2. Include target keywords naturally
3. Highlight key benefits or features
4. Add a clear call-to-action
5. Check length is 50-160 characters',
  
  learn_more_links = '[
    {"label": "Google Meta Description Guide", "url": "https://developers.google.com/search/docs/appearance/snippet"},
    {"label": "Ahrefs: Meta Description Guide", "url": "https://ahrefs.com/blog/meta-description/"}
  ]',
  
  official_docs = '[
    {"label": "Google Search Snippets", "url": "https://developers.google.com/search/docs/appearance/snippet"}
  ]',
  
  category = 'Technical Foundations',
  display_order = 2
WHERE id = 'C2_meta_description';

UPDATE scoring_criteria SET
  label = 'Mobile Viewport Tag',
  description = 'Viewport meta tag ensures proper mobile rendering',
  importance_rank = 2,
  points_possible = 100,
  scoring_approach = 'Automated HTML analysis',
  
  why_it_matters = 'The viewport meta tag controls how your page scales on mobile devices. Without it, pages may render incorrectly on phones and tablets, hurting user experience and mobile rankings.',
  
  how_to_fix = 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head> section of every page. This is essential for responsive design.',
  
  examples = 'Correct: <meta name="viewport" content="width=device-width, initial-scale=1">

Missing or incorrect viewport tags cause mobile rendering issues.',
  
  view_in_ui = 'Page Details → Technical → Viewport Meta Tag',
  
  common_issues = '• Missing viewport tag entirely
• Incorrect width value
• User-scalable=no (bad for accessibility)
• Fixed width instead of device-width',
  
  quick_fixes = '1. Add viewport meta tag to <head>
2. Use width=device-width
3. Set initial-scale=1
4. Test on mobile devices
5. Ensure responsive CSS is working',
  
  learn_more_links = '[
    {"label": "MDN: Viewport Meta Tag", "url": "https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag"},
    {"label": "Google Mobile-Friendly Guide", "url": "https://developers.google.com/search/mobile-sites"}
  ]',
  
  official_docs = '[
    {"label": "W3C Viewport Meta", "url": "https://www.w3.org/TR/css-device-adapt-1/"}
  ]',
  
  category = 'Technical Foundations',
  display_order = 10
WHERE id = 'T1_mobile_viewport';

UPDATE scoring_criteria SET
  label = 'Language & Region Tags',
  description = 'HTML lang attribute specifies page language for accessibility and internationalization',
  importance_rank = 3,
  points_possible = 100,
  scoring_approach = 'Automated HTML analysis',
  
  why_it_matters = 'Language tags help screen readers, translation tools, and search engines understand your content language. This improves accessibility and international SEO.',
  
  how_to_fix = 'Add lang="en" to your <html> tag for English content. Use specific codes like lang="en-US" for regional variants. Match the actual language of your content.',
  
  examples = 'Good: <html lang="en">
Good (regional): <html lang="en-US">

Missing or wrong language tags confuse assistive technologies.',
  
  view_in_ui = 'Page Details → Technical → HTML Lang Attribute',
  
  common_issues = '• Missing lang attribute
• Incorrect language code
• Mismatch between declared and actual language
• Missing regional variants',
  
  quick_fixes = '1. Add lang attribute to <html> tag
2. Use correct ISO 639-1 code (en, es, fr, etc.)
3. Add regional variant if targeting specific region
4. Ensure consistency across all pages
5. Verify with validation tools',
  
  learn_more_links = '[
    {"label": "MDN: HTML Lang Attribute", "url": "https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang"},
    {"label": "W3C Language Tags", "url": "https://www.w3.org/International/questions/qa-html-language-declarations"}
  ]',
  
  official_docs = '[
    {"label": "HTML Living Standard", "url": "https://html.spec.whatwg.org/multipage/dom.html#the-lang-and-xml:lang-attributes"}
  ]',
  
  category = 'Technical Foundations',
  display_order = 11
WHERE id = 'T2_lang_region';

UPDATE scoring_criteria SET
  label = 'Canonical URL',
  description = 'Canonical tags prevent duplicate content issues by specifying the preferred URL',
  importance_rank = 2,
  points_possible = 100,
  scoring_approach = 'Automated HTML analysis',
  
  why_it_matters = 'Canonical tags tell search engines which version of a page is the "master" copy when multiple URLs have similar content. This prevents duplicate content penalties and consolidates ranking signals.',
  
  how_to_fix = 'Add <link rel="canonical" href="https://example.com/page"> to each page. Point to the preferred URL (usually the page itself). Ensure it uses the same domain and protocol (HTTPS).',
  
  examples = 'Good: <link rel="canonical" href="https://acme.com/products/crm">
• Points to correct URL
• Uses HTTPS
• Same domain

Bad: <link rel="canonical" href="http://otherdomain.com/page">
• Different domain
• Uses HTTP instead of HTTPS',
  
  view_in_ui = 'Page Details → Technical → Canonical Tag',
  
  common_issues = '• Missing canonical tag
• Points to different domain
• Uses HTTP instead of HTTPS
• Canonical chain (A→B→C)
• Self-referential canonicals missing',
  
  quick_fixes = '1. Add canonical tag to every page
2. Use absolute URLs (not relative)
3. Ensure HTTPS protocol
4. Point to same domain
5. Verify no canonical chains exist',
  
  learn_more_links = '[
    {"label": "Google Canonical URLs", "url": "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls"},
    {"label": "Moz: Canonical Tag Guide", "url": "https://moz.com/learn/seo/canonicalization"}
  ]',
  
  official_docs = '[
    {"label": "Google Search Central - Canonicalization", "url": "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls"}
  ]',
  
  category = 'Technical Foundations',
  display_order = 9
WHERE id = 'G10_canonical';

UPDATE scoring_criteria SET
  label = 'FAQPage Schema',
  description = 'Structured data for FAQ sections enables rich snippets and voice search results',
  importance_rank = 1,
  points_possible = 100,
  scoring_approach = 'Automated HTML analysis',
  
  why_it_matters = 'FAQPage schema helps search engines and AI assistants understand your Q&A content. This can earn you rich snippet displays in search results and increases likelihood of being cited by AI chat systems.',
  
  how_to_fix = 'Add FAQPage JSON-LD schema with at least 3 question/answer pairs. Include complete answers (not just links). Use proper Schema.org structure with @type, name, and acceptedAnswer properties.',
  
  examples = 'Good JSON-LD:
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is a CRM?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "A CRM is customer relationship management software..."
    }
  }]
}

Include 3+ complete Q&A pairs for best results.',
  
  view_in_ui = 'Page Details → Structured Data → FAQPage Schema',
  
  common_issues = '• Missing FAQPage schema on FAQ pages
• Less than 3 questions
• Incomplete answers (links only)
• Invalid JSON syntax
• Wrong @type or missing required fields',
  
  quick_fixes = '1. Identify pages with FAQ sections
2. Add FAQPage JSON-LD to <head> or <body>
3. Include at least 3 Q&A pairs
4. Provide complete text answers
5. Validate with Google Rich Results Test',
  
  learn_more_links = '[
    {"label": "Google FAQPage Guidelines", "url": "https://developers.google.com/search/docs/appearance/structured-data/faqpage"},
    {"label": "Schema.org FAQPage", "url": "https://schema.org/FAQPage"}
  ]',
  
  official_docs = '[
    {"label": "Google Search - FAQPage", "url": "https://developers.google.com/search/docs/appearance/structured-data/faqpage"},
    {"label": "Schema.org FAQPage Spec", "url": "https://schema.org/FAQPage"}
  ]',
  
  category = 'Technical Foundations',
  display_order = 7
WHERE id = 'A4_schema_faqpage';

-- ============================================================================
-- CONTENT & CLARITY
-- ============================================================================

UPDATE scoring_criteria SET
  label = 'Answer-First Design',
  description = 'Lead with clear value proposition and call-to-action in hero section',
  importance_rank = 1,
  points_possible = 100,
  scoring_approach = 'Automated content analysis',
  
  why_it_matters = 'AI assistants and search engines prioritize content that answers questions quickly. An answer-first approach improves snippet selection, increases engagement, and helps AI systems cite your content accurately.',
  
  how_to_fix = 'Place your core value proposition in the first 200 words. Include clear benefit statements (what, why, how). Add prominent calls-to-action. Avoid forcing users to scroll for key information.',
  
  examples = 'Good:
"Acme CRM helps sales teams close 40% more deals. Simple setup, powerful automation, free trial."
[Get Started Button]

Bad:
"Welcome to our website. Founded in 2010, we are a leader in..."
[Generic intro with no value prop]',
  
  view_in_ui = 'Page Overview → Content Analysis → Answer-First Score',
  
  common_issues = '• Hero section is image-only with no text
• Generic welcome messages
• No clear call-to-action
• Value proposition buried below fold
• Vague or marketing-speak language',
  
  quick_fixes = '1. Lead with your core benefit/solution
2. Answer "What do you do?" in first sentence
3. Add specific, action-oriented CTA
4. Remove generic welcome text
5. Front-load key information',
  
  learn_more_links = '[
    {"label": "Nielsen Norman Group: F-Shaped Pattern", "url": "https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/"},
    {"label": "Content Design London: Plain English", "url": "https://contentdesign.london/"}
  ]',
  
  official_docs = '[]',
  
  category = 'Content & Clarity',
  display_order = 4
WHERE id = 'A1_answer_first';

UPDATE scoring_criteria SET
  label = 'FAQ Section Presence',
  description = 'Dedicated FAQ section with question/answer patterns',
  importance_rank = 2,
  points_possible = 100,
  scoring_approach = 'Automated HTML analysis',
  
  why_it_matters = 'FAQ sections directly address common questions, making it easy for AI assistants to extract answers. Pages with clear Q&A patterns are more likely to be cited and featured in search results.',
  
  how_to_fix = 'Add a dedicated FAQ section to your page. Use semantic HTML (<details>, <summary>) or heading structures (H2/H3). Start questions with who, what, where, when, why, or how. Provide complete answers, not just links.',
  
  examples = 'Good structure:
<h2>Frequently Asked Questions</h2>
<details>
  <summary>What is your return policy?</summary>
  <p>We offer 30-day returns...</p>
</details>

Or use H3 questions with answer paragraphs below.',
  
  view_in_ui = 'Page Details → Content → FAQ Detection',
  
  common_issues = '• No FAQ section on key pages
• Questions not formatted as questions
• Answers are links only (no text)
• FAQ hidden in accordion with no semantic markup
• Generic section titles (not "FAQ")',
  
  quick_fixes = '1. Add FAQ section to homepage and key pages
2. Use <details>/<summary> or H2/H3 structure
3. Start with question words (What, How, Why)
4. Provide complete text answers
5. Label section clearly as "FAQ" or "Questions"',
  
  learn_more_links = '[
    {"label": "Best Practices for FAQ Pages", "url": "https://www.searchenginejournal.com/faq-page-seo/"},
    {"label": "MDN: Details Element", "url": "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details"}
  ]',
  
  official_docs = '[]',
  
  category = 'Content & Clarity',
  display_order = 6
WHERE id = 'A3_faq_presence';

-- ============================================================================
-- STRUCTURE & ORGANIZATION
-- ============================================================================

UPDATE scoring_criteria SET
  label = 'Single H1 Tag',
  description = 'Exactly one H1 per page for clear content hierarchy',
  importance_rank = 1,
  points_possible = 100,
  scoring_approach = 'Automated HTML analysis',
  
  why_it_matters = 'The H1 tag signals the main topic of your page to search engines and screen readers. Having exactly one H1 creates clear hierarchy and helps AI systems understand page structure.',
  
  how_to_fix = 'Ensure every page has exactly one H1 tag. Make it descriptive and keyword-rich. It should clearly state the page topic. Use H2-H6 for subheadings in proper hierarchy.',
  
  examples = 'Good: 
<h1>CRM Software for Small Businesses</h1>
<h2>Key Features</h2>
<h3>Contact Management</h3>

Bad:
<h1>Welcome</h1>
<h1>About Us</h1> <!-- Multiple H1s -->',
  
  view_in_ui = 'Page Details → Structure → Heading Analysis',
  
  common_issues = '• No H1 tag on page
• Multiple H1 tags
• H1 is empty or generic ("Home", "Welcome")
• H1 doesn\'t match page content
• H1 used for styling instead of semantic meaning',
  
  quick_fixes = '1. Ensure every page has one H1
2. Make H1 descriptive and specific
3. Include primary keyword naturally
4. Remove duplicate H1s
5. Use proper heading hierarchy (H1→H2→H3)',
  
  learn_more_links = '[
    {"label": "MDN: Heading Elements", "url": "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements"},
    {"label": "WebAIM: Semantic Structure", "url": "https://webaim.org/techniques/semanticstructure/"}
  ]',
  
  official_docs = '[
    {"label": "HTML Living Standard - Headings", "url": "https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines"}
  ]',
  
  category = 'Structure & Organization',
  display_order = 3
WHERE id = 'C3_h1_presence';

UPDATE scoring_criteria SET
  label = 'Semantic Heading Structure',
  description = 'Proper H1→H2→H3 hierarchy without skipping levels',
  importance_rank = 1,
  points_possible = 100,
  scoring_approach = 'Automated HTML analysis',
  
  why_it_matters = 'Proper heading hierarchy helps screen readers, search engines, and AI systems understand content structure. Skipping levels (H1→H3) creates confusion and hurts accessibility.',
  
  how_to_fix = 'Use headings in order: H1 (once), then H2 for main sections, H3 for subsections, etc. Never skip levels. Don\'t choose heading levels based on visual appearance.',
  
  examples = 'Good hierarchy:
<h1>Main Topic</h1>
  <h2>Section</h2>
    <h3>Subsection</h3>
  <h2>Next Section</h2>

Bad (skips levels):
<h1>Main Topic</h1>
  <h3>Subsection</h3> <!-- Skipped H2 -->',
  
  view_in_ui = 'Page Details → Structure → Heading Hierarchy',
  
  common_issues = '• Skipping heading levels (H1→H3)
• Multiple H1 tags
• Using headings for styling not structure
• Inconsistent hierarchy across pages
• Too many heading levels (deeper than H4)',
  
  quick_fixes = '1. Audit all heading levels on page
2. Ensure H1 comes first
3. Use H2 for main sections
4. Use H3 for subsections under H2
5. Never skip levels
6. Limit depth to H1-H4 when possible',
  
  learn_more_links = '[
    {"label": "W3C: Headings Tutorial", "url": "https://www.w3.org/WAI/tutorials/page-structure/headings/"},
    {"label": "WebAIM: Semantic Structure", "url": "https://webaim.org/techniques/semanticstructure/"}
  ]',
  
  official_docs = '[
    {"label": "WCAG: Info and Relationships", "url": "https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html"}
  ]',
  
  category = 'Structure & Organization',
  display_order = 5
WHERE id = 'A2_headings_semantic';

UPDATE scoring_criteria SET
  label = 'Internal Linking',
  description = 'Rich internal links with diverse anchor text strengthen topical clustering',
  importance_rank = 2,
  points_possible = 100,
  scoring_approach = 'Automated HTML analysis',
  
  why_it_matters = 'Internal links distribute page authority, help search engines discover content, and signal topic relationships. Diverse anchor text helps both users and algorithms understand link context.',
  
  how_to_fix = 'Add 10+ internal links per page. Use descriptive anchor text (not "click here"). Link to related content naturally. Maintain 40%+ anchor text diversity (avoid repetitive phrases).',
  
  examples = 'Good: "Learn more about <a href="/crm-features">CRM automation features</a>"
• Descriptive anchor text
• Contextual link
• Natural placement

Bad: "<a href="/page">click here</a>"
• Generic anchor
• No context',
  
  view_in_ui = 'Page Details → Links → Internal Link Analysis',
  
  common_issues = '• Too few internal links (fewer than 3)
• Repetitive anchor text
• Generic anchors ("click here", "read more")
• Links to unrelated pages
• Orphan pages with no incoming links',
  
  quick_fixes = '1. Add links to related content
2. Use descriptive anchor text
3. Vary anchor text across pages
4. Ensure 10+ internal links per page
5. Fix orphan pages with no incoming links
6. Create topical content hubs',
  
  learn_more_links = '[
    {"label": "Moz: Internal Linking Strategy", "url": "https://moz.com/learn/seo/internal-link"},
    {"label": "Ahrefs: Internal Links Guide", "url": "https://ahrefs.com/blog/internal-links-for-seo/"}
  ]',
  
  official_docs = '[]',
  
  category = 'Structure & Organization',
  display_order = 8
WHERE id = 'A9_internal_linking';

-- ============================================================================
-- CRAWL & DISCOVERABILITY
-- ============================================================================

UPDATE scoring_criteria SET
  label = 'No Blocking Directives',
  description = 'Avoid noindex, nofollow, or restrictive robots meta tags',
  importance_rank = 1,
  points_possible = 100,
  scoring_approach = 'Automated HTML analysis',
  
  why_it_matters = 'Noindex and nofollow directives tell search engines not to index your page or follow its links. Accidentally blocking important pages is a common critical error that prevents search visibility.',
  
  how_to_fix = 'Check for <meta name="robots" content="noindex"> or similar tags. Remove them from pages you want indexed. Use robots.txt and XML sitemaps to control crawling. Only block staging, duplicate, or private pages.',
  
  examples = 'Bad (blocks indexing):
<meta name="robots" content="noindex, nofollow">

Good (allows indexing):
<meta name="robots" content="index, follow">
<!-- Or omit robots meta entirely -->',
  
  view_in_ui = 'Page Details → Technical → Robots Meta Tags',
  
  common_issues = '• Noindex left on from development
• Staging directives on production
• Blocking entire site accidentally
• Conflicting robots.txt and meta tags
• Blocking CSS/JS resources',
  
  quick_fixes = '1. Audit all robots meta tags
2. Remove noindex from production pages
3. Check robots.txt isn\'t blocking content
4. Verify staging != production robots settings
5. Test with Google Search Console',
  
  learn_more_links = '[
    {"label": "Google: Robots Meta Tag", "url": "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag"},
    {"label": "Moz: Robots Meta Directives", "url": "https://moz.com/learn/seo/robots-meta-directives"}
  ]',
  
  official_docs = '[
    {"label": "Google Search Central - Robots", "url": "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag"}
  ]',
  
  category = 'Crawl & Discoverability',
  display_order = 12
WHERE id = 'T3_noindex_robots';

-- ============================================================================
-- AUTHORITY & TRUST
-- ============================================================================

UPDATE scoring_criteria SET
  label = 'Organization Schema',
  description = 'Rich organization structured data with logo, social links, and brand identity',
  importance_rank = 1,
  points_possible = 100,
  scoring_approach = 'Automated HTML analysis',
  
  why_it_matters = 'Organization schema helps search engines and AI systems understand your brand identity. It powers knowledge panels, enables logo display in search results, and strengthens entity recognition.',
  
  how_to_fix = 'Add Organization JSON-LD schema to your homepage. Include name, logo, url, and at least 2 sameAs social profile links. This creates a strong brand entity signal.',
  
  examples = 'Good Organization schema:
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Acme Corp",
  "url": "https://acme.com",
  "logo": "https://acme.com/logo.png",
  "sameAs": [
    "https://twitter.com/acme",
    "https://linkedin.com/company/acme",
    "https://facebook.com/acme"
  ]
}',
  
  view_in_ui = 'Page Details → Structured Data → Organization Schema',
  
  common_issues = '• No Organization schema on homepage
• Missing logo property
• Less than 2 sameAs links
• Name doesn\'t match brand
• Missing or invalid URL',
  
  quick_fixes = '1. Add Organization JSON-LD to homepage
2. Include brand name, logo URL
3. Add 2-4 social profile links (sameAs)
4. Validate with Google Rich Results Test
5. Ensure name matches title tag brand',
  
  learn_more_links = '[
    {"label": "Schema.org Organization", "url": "https://schema.org/Organization"},
    {"label": "Google: Organization Markup", "url": "https://developers.google.com/search/docs/appearance/structured-data/logo"}
  ]',
  
  official_docs = '[
    {"label": "Schema.org Organization Spec", "url": "https://schema.org/Organization"},
    {"label": "Google Search - Logo", "url": "https://developers.google.com/search/docs/appearance/structured-data/logo"}
  ]',
  
  category = 'Authority & Trust',
  display_order = 13
WHERE id = 'A12_entity_graph';

-- Update timestamps
UPDATE scoring_criteria SET updated_at = datetime('now') WHERE id IN (
  'C1_title_quality', 'C2_meta_description', 'C3_h1_presence',
  'A1_answer_first', 'A2_headings_semantic', 'A3_faq_presence',
  'A4_schema_faqpage', 'A9_internal_linking', 'G10_canonical',
  'T1_mobile_viewport', 'T2_lang_region', 'T3_noindex_robots',
  'A12_entity_graph'
);

