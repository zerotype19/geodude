-- Add remaining page-level and site-level checks
-- Page-level: G2, A6, A5, C5, T4 (orders 14-18)
-- Site-level: S1-S11 (orders 101-111)

INSERT OR REPLACE INTO scoring_criteria (
  id, version, label, description, category, scope, weight, impact_level,
  pass_threshold, warn_threshold, check_type, enabled, preview,
  why_it_matters, how_to_fix, references_json,
  points_possible, importance_rank, scoring_approach, examples, view_in_ui,
  common_issues, quick_fixes, learn_more_links, official_docs, display_order
) VALUES
  -- Page-level checks (14-18)
  (
    'G2_og_tags_completeness', 1, 'Open Graph basics',
    'Presence of og:title, og:description, og:url, and og:image.',
    'Technical Foundations', 'page', 6, 'Medium', 85, 60, 'html_dom', 1, 0,
    'OG tags improve sharing previews and help assistants disambiguate content.',
    'Add og:title, og:description, og:image, and og:url pointing to the canonical URL.',
    NULL, 100, 3, 'Automated HTML analysis', NULL, 1,
    'Missing og:image; og:url not canonical; descriptions too long.',
    'Add a 1200×630 image; keep descriptions concise.',
    NULL, NULL, 14
  ),
  (
    'A6_contact_cta_presence', 1, 'Primary CTA above the fold',
    'Detects a clear Contact/Pricing/Signup CTA in the hero section.',
    'Content & Clarity', 'page', 8, 'Medium', 85, 60, 'html_dom', 1, 0,
    'Strong CTAs increase conversions and clarify page intent for assistants.',
    'Add a prominent button or link in the hero with action-oriented text.',
    NULL, 100, 2, 'Automated HTML analysis', NULL, 1,
    'CTA buried below fold; vague labels like ''Learn more''.',
    'Use ''Get started'', ''Contact sales'', or ''Book a demo'' in the hero.',
    NULL, NULL, 15
  ),
  (
    'A5_related_questions_block', 1, 'Related questions block',
    'Detects a Q&A/related-questions section with multiple questions.',
    'Content & Clarity', 'page', 6, 'Medium', 85, 60, 'html_dom', 1, 0,
    'Question clusters boost answer coverage and snippet depth.',
    'Add a ''Questions'' section with 3–5 user-language questions and concise answers.',
    NULL, 100, 3, 'Automated HTML analysis', NULL, 1,
    'Only 1–2 questions; no answers; marketing fluff.',
    'Use short, direct answers; mirror real queries (''how'', ''what'', ''why'').',
    NULL, NULL, 16
  ),
  (
    'C5_h2_coverage_ratio', 1, 'H2 coverage (content-per-section)',
    'Measures the % of H2s with ≥100 characters of body content following.',
    'Structure & Organization', 'page', 8, 'Medium', 85, 60, 'html_dom', 1, 0,
    'Sections with substance improve topical completeness and parsing.',
    'Expand thin sections so most H2s have at least a paragraph of content.',
    NULL, 100, 2, 'Automated HTML analysis', NULL, 1,
    'H2s followed by only images or one-liners.',
    'Add a ~2–4 sentence explainer under each H2.',
    NULL, NULL, 17
  ),
  (
    'T4_core_web_vitals_hints', 1, 'Core Web Vitals hints',
    'Heuristics: lazy images, key font preloads, and limited blocking CSS.',
    'Experience & Performance', 'page', 8, 'Medium', 85, 60, 'html_dom', 1, 0,
    'Better LCP/CLS proxies improve assistant eligibility and UX.',
    'Add loading="lazy" to below-the-fold images; preload primary webfont; trim large render-blocking CSS.',
    NULL, 100, 2, 'Automated HTML analysis', NULL, 1,
    'All images eager-loaded; no font preloads; huge inline CSS.',
    'Lazy-load non-critical media; add <link rel="preload" as="font"> for the main font.',
    NULL, NULL, 18
  ),

  -- Site-level aggregate checks (101-111)
  (
    'S1_faq_coverage_pct', 1, 'FAQ coverage (site)',
    'Share of crawled pages that include a detectable FAQ block.',
    'Content & Clarity', 'site', 10, 'High', 70, 40, 'aggregate', 1, 0,
    'Broader FAQ coverage increases assistant answer surfaces across the site.',
    'Add concise FAQ sections to major templates and key landing pages.',
    NULL, 100, 1, 'Aggregate of page checks (A3_faq_presence)', NULL, 1,
    'FAQ only on homepage; thin answers.',
    'Roll out FAQ to product, pricing, and key service pages.',
    NULL, NULL, 101
  ),
  (
    'S2_faq_schema_adoption_pct', 1, 'FAQ schema adoption (site)',
    'Share of pages with valid FAQPage JSON-LD (≥3 Q&A).',
    'Technical Foundations', 'site', 10, 'High', 70, 40, 'aggregate', 1, 0,
    'Schema adoption scales rich-result eligibility across the site.',
    'Mirror visible FAQ blocks with valid FAQPage JSON-LD.',
    '["https://schema.org/FAQPage"]', 100, 1, 'Aggregate of page checks (A4_schema_faqpage)', NULL, 1,
    'Invalid JSON; <3 entries; mismatch with on-page content.',
    'Validate JSON-LD and align entries to visible FAQ.',
    NULL, NULL, 102
  ),
  (
    'S3_canonical_correct_pct', 1, 'Canonical correctness (site)',
    'Share of pages with valid, same-host canonical tags.',
    'Technical Foundations', 'site', 8, 'Medium', 85, 60, 'aggregate', 1, 0,
    'Consistent canonicals consolidate authority.',
    'Ensure all templates emit absolute, same-host canonicals.',
    NULL, 100, 2, 'Aggregate of page checks (G10_canonical)', NULL, 1,
    'Missing or cross-domain canonicals in certain templates.',
    'Fix template partials; remove querystring canonicals.',
    NULL, NULL, 103
  ),
  (
    'S4_mobile_ready_pct', 1, 'Mobile-ready pages (site)',
    'Share of pages with proper viewport meta.',
    'Experience & Performance', 'site', 8, 'Medium', 95, 80, 'aggregate', 1, 0,
    'Mobile readiness is table stakes for ranking and UX.',
    'Ensure all templates include a correct viewport meta tag.',
    NULL, 100, 2, 'Aggregate of page checks (T1_mobile_viewport)', NULL, 1,
    'Legacy pages missing tag; inconsistent template usage.',
    'Audit templates; add viewport to base layout.',
    NULL, NULL, 104
  ),
  (
    'S5_lang_correct_pct', 1, 'Correct lang/region (site)',
    'Share of pages whose HTML lang matches target locale.',
    'Technical Foundations', 'site', 6, 'Low', 90, 70, 'aggregate', 1, 0,
    'Locale correctness improves international targeting.',
    'Set the correct lang attribute on all templates.',
    NULL, 100, 3, 'Aggregate of page checks (T2_lang_region)', NULL, 1,
    'Mixed locales; inherited defaults.',
    'Normalize root <html lang> across templates.',
    NULL, NULL, 105
  ),
  (
    'S6_entity_graph_adoption_pct', 1, 'Entity graph adoption (site)',
    'Share of pages with Organization/LocalBusiness schema set correctly.',
    'Authority & Trust', 'site', 10, 'High', 70, 40, 'aggregate', 1, 0,
    'Consistent entity signals strengthen brand understanding.',
    'Roll Organization JSON-LD across core templates with logo and sameAs.',
    '["https://schema.org/Organization"]', 100, 1, 'Aggregate of page checks (A12_entity_graph)', NULL, 1,
    'Home only; missing sameAs; inconsistent names.',
    'Unify schema across templates; add ≥2 sameAs profiles.',
    NULL, NULL, 106
  ),
  (
    'S7_dup_title_pct', 1, 'Duplicate titles (site)',
    'Percent of pages sharing a duplicate <title> across the crawl.',
    'Technical Foundations', 'site', 8, 'Medium', 90, 75, 'aggregate', 1, 0,
    'Duplicate titles reduce relevance and dilute signals.',
    'Template titles with variables; ensure unique, topic-led titles.',
    NULL, 100, 2, 'Aggregate of page titles from C1_title_quality details', NULL, 1,
    'Category archives and paginated lists share the same title.',
    'Inject differentiators (product name, city, category).',
    NULL, NULL, 107
  ),
  (
    'S8_avg_h2_coverage', 1, 'Average H2 coverage (site)',
    'Mean H2 coverage ratio across crawled pages.',
    'Structure & Organization', 'site', 6, 'Low', 70, 50, 'aggregate', 1, 0,
    'Stronger sections across templates improve topical depth.',
    'Raise minimum body content under each H2 in common templates.',
    NULL, 100, 3, 'Aggregate of page checks (C5_h2_coverage_ratio)', NULL, 1,
    'Template sections with headings but no body copy.',
    'Add copy blocks below H2s; avoid image-only sections.',
    NULL, NULL, 108
  ),
  (
    'S9_og_tags_coverage_pct', 1, 'OG coverage (site)',
    'Share of pages meeting the OG basics threshold.',
    'Technical Foundations', 'site', 6, 'Low', 80, 60, 'aggregate', 1, 0,
    'Consistent OG improves social previews and link sharing.',
    'Propagate OG partials across templates with canonical URLs.',
    NULL, 100, 3, 'Aggregate of page checks (G2_og_tags_completeness)', NULL, 1,
    'Some templates omit og:image or og:description.',
    'Standardize OG component and pass canonical URL to og:url.',
    NULL, NULL, 109
  ),
  (
    'S10_cta_above_fold_pct', 1, 'CTA above-the-fold (site)',
    'Share of pages with a detectable CTA near the hero.',
    'Content & Clarity', 'site', 6, 'Low', 70, 40, 'aggregate', 1, 0,
    'Clear calls-to-action boost engagement and outcomes.',
    'Add primary CTA buttons to hero across key templates.',
    NULL, 100, 3, 'Aggregate of page checks (A6_contact_cta_presence)', NULL, 1,
    'CTA only on a few pages; text-only links.',
    'Use button components with action verbs site-wide.',
    NULL, NULL, 110
  ),
  (
    'S11_internal_link_health_pct', 1, 'Internal link health (site)',
    'Share of pages meeting internal link quantity/diversity thresholds.',
    'Structure & Organization', 'site', 8, 'Medium', 70, 50, 'aggregate', 1, 0,
    'Healthy internal links improve crawl and topic discovery.',
    'Add contextual links to pillar and hub pages; diversify anchors.',
    NULL, 100, 2, 'Aggregate of page checks (A9_internal_linking)', NULL, 1,
    'Only nav/footer links; repetitive ''learn more'' anchors.',
    'Add in-body links with descriptive anchors.',
    NULL, NULL, 111
  );

