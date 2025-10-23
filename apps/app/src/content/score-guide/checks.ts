/**
 * Scoring Guide Checks
 * 
 * Generated from D1 scoring_criteria table
 * Run: npm run sync-score-guide
 * 
 * Last synced: 2025-10-23T00:16:17.231Z
 */

export type CheckDoc = {
  id: string;
  slug: string;
  title: string;
  category: 'Structure' | 'Authority' | 'Schema' | 'Crawl' | 'UX';
  weight: number;
  summary: string;
  whyItMatters: string;
  detectionNotes?: string[];
  examples: {
    good: { caption: string; html?: string; text?: string; schema?: string }[];
    bad: { caption: string; html?: string; text?: string; schema?: string }[];
  };
  implementation: string[];
  qaChecklist: string[];
  links?: { label: string; href: string }[];
};

export const CHECKS: CheckDoc[] = [
  {
    "id": "C1_title_quality",
    "slug": "title-tag-quality",
    "title": "Title tag quality (C1_title_quality)",
    "category": "Schema",
    "weight": 12,
    "summary": "Clear, descriptive title with sensible length and brand signal.",
    "whyItMatters": "Titles drive ranking, snippets, and assistant citations.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of title tag quality"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Missing title; overly long; keyword stuffing; no brand on home."
        }
      ]
    },
    "implementation": [
      "Keep 15–65 chars; lead with topic; include brand on homepage."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "C2_meta_description",
    "slug": "meta-description-present",
    "title": "Meta description present (C2_meta_description)",
    "category": "Schema",
    "weight": 8,
    "summary": "Meta description exists and is within recommended length.",
    "whyItMatters": "Improves snippet quality and sets expectations for users/assistants.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of meta description present"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Missing tag; too short/long; generic marketing copy."
        }
      ]
    },
    "implementation": [
      "Add 50–160 character summary that echoes the H1 topic."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "C3_h1_presence",
    "slug": "single-h1-tag",
    "title": "Single H1 tag (C3_h1_presence)",
    "category": "Structure",
    "weight": 10,
    "summary": "Exactly one H1 indicating the main topic of the page.",
    "whyItMatters": "A single H1 clarifies the primary topic for parsers and users.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of single h1 tag"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Multiple H1s from templates; missing H1 entirely."
        }
      ]
    },
    "implementation": [
      "Ensure exactly one H1; move extra H1s to H2/H3."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "A1_answer_first",
    "slug": "answer-first-hero-section",
    "title": "Answer-first hero section (A1_answer_first)",
    "category": "Structure",
    "weight": 15,
    "summary": "Clear value proposition and a primary CTA above the fold.",
    "whyItMatters": "Directly answers intent and improves assistant-ready summaries.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of answer-first hero section"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Vague hero copy; CTAs buried; jargon-heavy messaging."
        }
      ]
    },
    "implementation": [
      "Add a concise claim and an actionable CTA in the hero."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "A2_headings_semantic",
    "slug": "semantic-heading-structure",
    "title": "Semantic heading structure (A2_headings_semantic)",
    "category": "Structure",
    "weight": 10,
    "summary": "Proper H1→H2→H3 hierarchy without skipping levels.",
    "whyItMatters": "Consistent hierarchy improves parsing and accessibility.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of semantic heading structure"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Skipped levels; styling headings with divs; multiple H1s."
        }
      ]
    },
    "implementation": [
      "Use one H1; nest sections with H2/H3 in order; avoid H1→H3 jumps."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "A3_faq_presence",
    "slug": "faq-section-present",
    "title": "FAQ section present (A3_faq_presence)",
    "category": "Structure",
    "weight": 8,
    "summary": "Detectable FAQ/Q&A block on the page.",
    "whyItMatters": "Improves answer engine coverage and structured snippets.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of faq section present"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Q-like headings without answers; accordion without content."
        }
      ]
    },
    "implementation": [
      "Add an FAQ section with 3–5 concise, user-language questions."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "A4_schema_faqpage",
    "slug": "faqpage-schema",
    "title": "FAQPage schema (A4_schema_faqpage)",
    "category": "Schema",
    "weight": 10,
    "summary": "Valid FAQPage JSON-LD with 3+ Q&A pairs.",
    "whyItMatters": "Enables rich results and better assistant extraction.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of faqpage schema"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Invalid JSON; mismatched Q/A; fewer than 3 entries."
        }
      ]
    },
    "implementation": [
      "Add FAQPage JSON-LD aligning to the visible FAQ section."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "A9_internal_linking",
    "slug": "internal-linking-and-diversity",
    "title": "Internal linking & diversity (A9_internal_linking)",
    "category": "Structure",
    "weight": 7,
    "summary": "Adequate internal links with diverse, descriptive anchors.",
    "whyItMatters": "Improves crawl depth, context, and topic connectivity.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of internal linking & diversity"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Thin linking; nav-only links; 'Learn more' anchors everywhere."
        }
      ]
    },
    "implementation": [
      "Add 10+ relevant internal links; avoid repetitive anchors."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "G10_canonical",
    "slug": "canonical-url-correctness",
    "title": "Canonical URL correctness (G10_canonical)",
    "category": "Schema",
    "weight": 8,
    "summary": "Canonical tag present and points to same domain.",
    "whyItMatters": "Prevents duplicate content and consolidates signals.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of canonical url correctness"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Missing tag; cross-domain canonical; querystring canonicals."
        }
      ]
    },
    "implementation": [
      "Add absolute canonical to the preferred URL on same host."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "T1_mobile_viewport",
    "slug": "mobile-viewport-tag",
    "title": "Mobile viewport tag (T1_mobile_viewport)",
    "category": "UX",
    "weight": 8,
    "summary": "Viewport meta with device-width for responsive layout.",
    "whyItMatters": "Ensures mobile-friendly rendering for users and crawlers.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of mobile viewport tag"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Missing tag; fixed-width layouts."
        }
      ]
    },
    "implementation": [
      "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "T2_lang_region",
    "slug": "language/region-tags",
    "title": "Language/region tags (T2_lang_region)",
    "category": "Schema",
    "weight": 6,
    "summary": "HTML lang attribute matches the target locale.",
    "whyItMatters": "Improves geo/locale targeting and assistant comprehension.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of language/region tags"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Missing/incorrect lang; inherited from non-US templates."
        }
      ]
    },
    "implementation": [
      "Set <html lang=\"en-US\"> (or correct locale) on each page."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "T3_noindex_robots",
    "slug": "no-blocking-robots-directives",
    "title": "No blocking robots directives (T3_noindex_robots)",
    "category": "Crawl",
    "weight": 12,
    "summary": "No 'noindex' or overly restrictive robots meta directives.",
    "whyItMatters": "Blocking directives prevent assistants and crawlers from using content.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of no blocking robots directives"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Environment flags left on; inherited meta from staging."
        }
      ]
    },
    "implementation": [
      "Remove 'noindex' where not required; review robots policies."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "A12_entity_graph",
    "slug": "organization-entity-graph",
    "title": "Organization entity graph (A12_entity_graph)",
    "category": "Authority",
    "weight": 10,
    "summary": "Organization/LocalBusiness schema with logo and 2+ sameAs links.",
    "whyItMatters": "Strengthens entity recognition and brand disambiguation.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of organization entity graph"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Missing logo; no sameAs; name mismatch vs. title/H1."
        }
      ]
    },
    "implementation": [
      "Add Organization JSON-LD with name, logo, and at least two sameAs profiles."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "G2_og_tags_completeness",
    "slug": "open-graph-basics",
    "title": "Open Graph basics (G2_og_tags_completeness)",
    "category": "Schema",
    "weight": 6,
    "summary": "Presence of og:title, og:description, og:url, and og:image.",
    "whyItMatters": "OG tags improve sharing previews and help assistants disambiguate content.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of open graph basics"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Missing og:image; og:url not canonical; descriptions too long."
        }
      ]
    },
    "implementation": [
      "Add og:title, og:description, og:image, and og:url pointing to the canonical URL."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "A6_contact_cta_presence",
    "slug": "primary-cta-above-the-fold",
    "title": "Primary CTA above the fold (A6_contact_cta_presence)",
    "category": "Structure",
    "weight": 8,
    "summary": "Detects a clear Contact/Pricing/Signup CTA in the hero section.",
    "whyItMatters": "Strong CTAs increase conversions and clarify page intent for assistants.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of primary cta above the fold"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "CTA buried below fold; vague labels like 'Learn more'."
        }
      ]
    },
    "implementation": [
      "Add a prominent button or link in the hero with action-oriented text."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "A5_related_questions_block",
    "slug": "related-questions-block",
    "title": "Related questions block (A5_related_questions_block)",
    "category": "Structure",
    "weight": 6,
    "summary": "Detects a Q&A/related-questions section with multiple questions.",
    "whyItMatters": "Question clusters boost answer coverage and snippet depth.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of related questions block"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Only 1–2 questions; no answers; marketing fluff."
        }
      ]
    },
    "implementation": [
      "Add a 'Questions' section with 3–5 user-language questions and concise answers."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "C5_h2_coverage_ratio",
    "slug": "h2-coverage-content-per-section",
    "title": "H2 coverage (content-per-section) (C5_h2_coverage_ratio)",
    "category": "Structure",
    "weight": 8,
    "summary": "Measures the % of H2s with ≥100 characters of body content following.",
    "whyItMatters": "Sections with substance improve topical completeness and parsing.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of h2 coverage (content-per-section)"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "H2s followed by only images or one-liners."
        }
      ]
    },
    "implementation": [
      "Expand thin sections so most H2s have at least a paragraph of content."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "T4_core_web_vitals_hints",
    "slug": "core-web-vitals-hints",
    "title": "Core Web Vitals hints (T4_core_web_vitals_hints)",
    "category": "UX",
    "weight": 8,
    "summary": "Heuristics: lazy images, key font preloads, and limited blocking CSS.",
    "whyItMatters": "Better LCP/CLS proxies improve assistant eligibility and UX.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of core web vitals hints"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "All images eager-loaded; no font preloads; huge inline CSS."
        }
      ]
    },
    "implementation": [
      "Add loading=\"lazy\" to below-the-fold images; preload primary webfont; trim large render-blocking CSS."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "G12_topic_depth_semantic",
    "slug": "topic-depth-and-semantic-coverage",
    "title": "Topic depth & semantic coverage (G12_topic_depth_semantic)",
    "category": "Structure",
    "weight": 8,
    "summary": "Evaluates semantic completeness using LLM topic embeddings.",
    "whyItMatters": "Assistants reward pages covering related intents and co-occurring terms.",
    "detectionNotes": [
      "AI-assisted content analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of topic depth & semantic coverage"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Shallow coverage; missing related concepts; overly narrow focus."
        }
      ]
    },
    "implementation": [
      "Add supporting subtopics, examples, and related terms to show comprehensive understanding."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "G11_entity_graph_completeness",
    "slug": "entity-graph-completeness",
    "title": "Entity graph completeness (G11_entity_graph_completeness)",
    "category": "Structure",
    "weight": 8,
    "summary": "Measures the presence of internal links and schema connections between entities.",
    "whyItMatters": "Strong schema and links help assistants understand how your entities relate.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of entity graph completeness"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Isolated schema; no entity relationships; missing sameAs links."
        }
      ]
    },
    "implementation": [
      "Add Organization, Product, or Person schema and connect via sameAs or URL references."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "G6_fact_url_stability",
    "slug": "canonical-fact-urls",
    "title": "Canonical fact URLs (G6_fact_url_stability)",
    "category": "Structure",
    "weight": 8,
    "summary": "Stable URLs and anchors for key facts or product specs.",
    "whyItMatters": "LLMs cite at the fact level; canonical URLs improve retrievability.",
    "detectionNotes": [
      "Automated HTML analysis"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of canonical fact urls"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Changing URLs; missing fragment IDs; no deep-link anchors."
        }
      ]
    },
    "implementation": [
      "Ensure fact-rich pages and anchors remain stable and linkable."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "A13_page_speed_lcp",
    "slug": "page-speed-lcp",
    "title": "Page speed (LCP) (A13_page_speed_lcp)",
    "category": "UX",
    "weight": 7,
    "summary": "Largest Contentful Paint below 2.5s target.",
    "whyItMatters": "Page speed influences engagement and crawl efficiency.",
    "detectionNotes": [
      "Automated HTML and performance timing proxy"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of page speed (lcp)"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "Slow LCP (>2.5s); unoptimized images; blocking scripts; no CDN."
        }
      ]
    },
    "implementation": [
      "Optimize media, preconnect to key origins, use lazy-loading."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  },
  {
    "id": "A14_qna_scaffold",
    "slug": "qanda-scaffold",
    "title": "Q&A scaffold (A14_qna_scaffold)",
    "category": "Structure",
    "weight": 10,
    "summary": "Detects visible FAQ or Q&A blocks that match structured schema.",
    "whyItMatters": "Explicit question-answer pairs improve snippet extraction and citation likelihood.",
    "detectionNotes": [
      "Automated HTML analysis + schema validation"
    ],
    "examples": {
      "good": [
        {
          "caption": "Correct implementation",
          "text": "Proper implementation of q&a scaffold"
        }
      ],
      "bad": [
        {
          "caption": "Common issue",
          "text": "No Q&A; schema mismatch; questions without answers; buried below fold."
        }
      ]
    },
    "implementation": [
      "Add 3–5 Q&A blocks and mark up with FAQPage schema."
    ],
    "qaChecklist": [
      "Verify implementation is complete",
      "Test across multiple pages",
      "Validate with browser DevTools"
    ]
  }
];

// ID to slug mapping for deep-linking
export const ID_TO_SLUG: Record<string, string> = 
  Object.fromEntries(CHECKS.map(c => [c.id, c.slug]));

// Helper to get check by ID
export function getCheckById(id: string): CheckDoc | undefined {
  return CHECKS.find(c => c.id === id);
}

// Helper to get check by slug
export function getCheckBySlug(slug: string): CheckDoc | undefined {
  return CHECKS.find(c => c.slug === slug);
}

// Group checks by category
export function groupChecksByCategory() {
  const grouped: Record<string, CheckDoc[]> = {};
  for (const check of CHECKS) {
    if (!grouped[check.category]) grouped[check.category] = [];
    grouped[check.category].push(check);
  }
  return grouped;
}
