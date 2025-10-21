/**
 * Scorecard 2.0 - Category-based Check Organization
 * 
 * Restructures 21 checks (A1-A11, G1-G10) into 6 practical categories:
 * - Content & Clarity
 * - Structure & Organization  
 * - Authority & Trust
 * - Technical Foundations
 * - Crawl & Discoverability
 * - Experience & Performance
 * 
 * Keeps all existing scoring logic (IDs, weights, rules) intact.
 */

export type ImpactLevel = 'High' | 'Medium' | 'Low';

export type CheckCategory = 
  | 'Content & Clarity'
  | 'Structure & Organization'
  | 'Authority & Trust'
  | 'Technical Foundations'
  | 'Crawl & Discoverability'
  | 'Experience & Performance';

export interface CheckMetaV2 {
  id: string;                      // e.g., "A1"
  code: string;                    // same as id (for compatibility)
  label: string;                   // Human-friendly short name
  description: string;             // 1-line technical description
  category: CheckCategory;         // New: practical category grouping
  impact_level: ImpactLevel;       // New: High/Medium/Low for prioritization
  why_it_matters: string;          // New: Business-friendly explanation
  weight: number;                  // Existing scoring weight (W#)
  weightKey: "aeo" | "geo";        // Which score this contributes to
  guideAnchor: string;             // Link to detailed guide
  refs?: string[];                 // Optional: proof/citation links
}

// Category descriptions for UI
export const CATEGORY_DESCRIPTIONS: Record<CheckCategory, string> = {
  'Content & Clarity': 'How well your content communicates meaning, answers intent, and supports AI understanding.',
  'Structure & Organization': 'How information is arranged and connected for scanners and parsers.',
  'Authority & Trust': 'Signals that demonstrate credibility, expertise, and reliability.',
  'Technical Foundations': 'Code and markup that explain meaning to machines (schema, semantics).',
  'Crawl & Discoverability': 'How easily crawlers and assistants can access and index your content.',
  'Experience & Performance': 'How fast, usable, and accessible the experience feels.'
};

export const CHECKS_V2: Record<string, CheckMetaV2> = {
  // ═════════════════════════════════════════════════════════════════
  // Content & Clarity
  // ═════════════════════════════════════════════════════════════════
  
  A1: {
    id: 'A1',
    code: 'A1',
    label: 'Answer-first design',
    description: 'Concise answer at the top; add anchors and list/table when helpful (TOC is optional).',
    category: 'Content & Clarity',
    impact_level: 'High',
    why_it_matters: 'Clear early answers increase snippet usage and assistant citations.',
    weight: 15,
    weightKey: 'aeo',
    guideAnchor: '#a1-answer-first-design',
    refs: [
      'https://developers.google.com/search/docs/appearance/snippet',
      'https://support.google.com/webmasters/answer/35624'
    ]
  },

  G1: {
    id: 'G1',
    code: 'G1',
    label: 'Citable facts block',
    description: 'Key facts section with 3-7 atomic bullets.',
    category: 'Content & Clarity',
    impact_level: 'High',
    why_it_matters: 'LLMs and search map pages to entities; clarity improves matching.',
    weight: 15,
    weightKey: 'geo',
    guideAnchor: '#g1-citable-key-facts-block'
  },

  G5: {
    id: 'G5',
    code: 'G5',
    label: 'Chunkability & structure',
    description: 'Short paragraphs, semantic headings, glossary.',
    category: 'Content & Clarity',
    impact_level: 'High',
    why_it_matters: 'Depth across facets improves topical authority and answer completeness.',
    weight: 10,
    weightKey: 'geo',
    guideAnchor: '#g5-chunkability-structure'
  },

  A10: {
    id: 'A10',
    code: 'A10',
    label: 'AI Overviews readiness',
    description: 'Complete, safe, well-cited answer with short "Sources" section. Note: AIO behavior evolves; monitor over time.',
    category: 'Content & Clarity',
    impact_level: 'Medium',
    why_it_matters: 'Conversational tone reads better and avoids keyword-stuffing penalties.',
    weight: 4,
    weightKey: 'aeo',
    guideAnchor: '#a10-ai-overviews-readiness'
  },

  A9: {
    id: 'A9',
    code: 'A9',
    label: 'Freshness & stability',
    description: 'Updated dates, working links, stable URLs.',
    category: 'Content & Clarity',
    impact_level: 'Medium',
    why_it_matters: 'Recent, maintained content earns trust and is favored for time-sensitive answers.',
    weight: 5,
    weightKey: 'aeo',
    guideAnchor: '#a9-freshness-stability'
  },

  // ═════════════════════════════════════════════════════════════════
  // Structure & Organization
  // ═════════════════════════════════════════════════════════════════

  A2: {
    id: 'A2',
    code: 'A2',
    label: 'Topical cluster integrity',
    description: 'Dense internal links within the pillar/topic.',
    category: 'Structure & Organization',
    impact_level: 'High',
    why_it_matters: 'Internal linking forms coherent topic clusters used by engines to infer context.',
    weight: 15,
    weightKey: 'aeo',
    guideAnchor: '#a2-topical-cluster-integrity'
  },

  G6: {
    id: 'G6',
    code: 'G6',
    label: 'Canonical fact URLs',
    description: 'Stable URLs and anchors for individual facts.',
    category: 'Structure & Organization',
    impact_level: 'Medium',
    why_it_matters: 'Clear headings/lists/tables help scanners and parsers extract facts.',
    weight: 8,
    weightKey: 'geo',
    guideAnchor: '#g6-canonical-fact-urls'
  },

  G10: {
    id: 'G10',
    code: 'G10',
    label: 'Cluster-evidence linking',
    description: 'Pillars link to sources hub and back.',
    category: 'Structure & Organization',
    impact_level: 'Medium',
    why_it_matters: 'Descriptive anchors clarify relationships for both users and crawlers.',
    weight: 7,
    weightKey: 'geo',
    guideAnchor: '#g10-cluster-evidence-linking'
  },

  // ═════════════════════════════════════════════════════════════════
  // Authority & Trust
  // ═════════════════════════════════════════════════════════════════

  A3: {
    id: 'A3',
    code: 'A3',
    label: 'Host/site authority',
    description: 'Organization schema, author credentials, editorial standards.',
    category: 'Authority & Trust',
    impact_level: 'High',
    why_it_matters: 'Visible expertise increases reliability for YMYL and expert content.',
    weight: 15,
    weightKey: 'aeo',
    guideAnchor: '#a3-host-site-level-authority'
  },

  G2: {
    id: 'G2',
    code: 'G2',
    label: 'Provenance schema',
    description: 'Author, publisher, dates, citations in JSON-LD.',
    category: 'Authority & Trust',
    impact_level: 'High',
    why_it_matters: 'Evidence-backed claims reduce hallucination risk and increase citation likelihood.',
    weight: 15,
    weightKey: 'geo',
    guideAnchor: '#g2-provenance-schema'
  },

  G3: {
    id: 'G3',
    code: 'G3',
    label: 'Evidence density',
    description: 'References section with outbound links and data.',
    category: 'Authority & Trust',
    impact_level: 'High',
    why_it_matters: 'A dedicated "Sources" block concentrates signals for parsers and readers.',
    weight: 12,
    weightKey: 'geo',
    guideAnchor: '#g3-evidence-density'
  },

  A4: {
    id: 'A4',
    code: 'A4',
    label: 'Originality & effort',
    description: 'Unique data, tools, diagrams, code, methods.',
    category: 'Authority & Trust',
    impact_level: 'High',
    why_it_matters: 'Contradictions/outdated facts undermine inclusion in LLM answers.',
    weight: 12,
    weightKey: 'aeo',
    guideAnchor: '#a4-originality-effort'
  },

  G7: {
    id: 'G7',
    code: 'G7',
    label: 'Dataset availability',
    description: 'Downloadable CSV/JSON with version notes.',
    category: 'Authority & Trust',
    impact_level: 'Medium',
    why_it_matters: 'Consistent naming/logos reduce entity disambiguation errors.',
    weight: 8,
    weightKey: 'geo',
    guideAnchor: '#g7-dataset-availability'
  },

  G9: {
    id: 'G9',
    code: 'G9',
    label: 'Update hygiene',
    description: 'Visible changelog and aligned dateModified.',
    category: 'Authority & Trust',
    impact_level: 'Medium',
    why_it_matters: 'Visible update history demonstrates ongoing maintenance and reliability.',
    weight: 7,
    weightKey: 'geo',
    guideAnchor: '#g9-update-hygiene'
  },

  // ═════════════════════════════════════════════════════════════════
  // Technical Foundations
  // ═════════════════════════════════════════════════════════════════

  A5: {
    id: 'A5',
    code: 'A5',
    label: 'Schema accuracy',
    description: 'Valid JSON-LD for page intent. Note: FAQPage/HowTo rich results limited since 2023—use when truly relevant.',
    category: 'Technical Foundations',
    impact_level: 'High',
    why_it_matters: 'Valid JSON-LD maps your page to entities/types answer engines rely on.',
    weight: 10,
    weightKey: 'aeo',
    guideAnchor: '#a5-schema-accuracy-breadth',
    refs: [
      'https://schema.org',
      'https://developers.google.com/search/docs/appearance/structured-data'
    ]
  },

  G8: {
    id: 'G8',
    code: 'G8',
    label: 'Policy transparency',
    description: 'Clear content license and AI reuse stance.',
    category: 'Technical Foundations',
    impact_level: 'High',
    why_it_matters: 'Explicit relationships (Organization→Product→Person) strengthen graph linkage.',
    weight: 6,
    weightKey: 'geo',
    guideAnchor: '#g8-policy-transparency'
  },

  // ═════════════════════════════════════════════════════════════════
  // Crawl & Discoverability
  // ═════════════════════════════════════════════════════════════════

  A6: {
    id: 'A6',
    code: 'A6',
    label: 'Crawlability & canonicals',
    description: 'Self-canonical, unique title/H1, crawlable.',
    category: 'Crawl & Discoverability',
    impact_level: 'High',
    why_it_matters: 'Clean URLs + sitemap improve discovery and deduplication.',
    weight: 10,
    weightKey: 'aeo',
    guideAnchor: '#a6-crawlability-canonicals'
  },

  A8: {
    id: 'A8',
    code: 'A8',
    label: 'Sitemaps & discoverability',
    description: 'Fresh sitemap with accurate lastmod dates.',
    category: 'Crawl & Discoverability',
    impact_level: 'Medium',
    why_it_matters: 'Sitemaps accelerate discovery and signal update frequency.',
    weight: 6,
    weightKey: 'aeo',
    guideAnchor: '#a8-sitemaps-discoverability'
  },

  A11: {
    id: 'A11',
    code: 'A11',
    label: 'Render visibility (SPA risk)',
    description: 'Keep key content and JSON-LD in HTML. AEO: small site penalty only if below 30%. GEO: stricter—bots often don\'t run JS.',
    category: 'Crawl & Discoverability',
    impact_level: 'High',
    why_it_matters: 'Static HTML parity prevents "content missing at crawl-time" failures.',
    weight: 10,
    weightKey: 'aeo',
    guideAnchor: '#a11-render-visibility-spa-risk'
  },

  G4: {
    id: 'G4',
    code: 'G4',
    label: 'AI crawler access',
    description: 'Be explicit with AI bots and ensure HTML≈rendered content. Note: real-world tests show occasional non-compliance; verify via logs.',
    category: 'Crawl & Discoverability',
    impact_level: 'High',
    why_it_matters: 'GPTBot/Claude-Web/Perplexity must see the same DOM users see.',
    weight: 12,
    weightKey: 'geo',
    guideAnchor: '#g4-ai-crawler-access-parity'
  },

  // ═════════════════════════════════════════════════════════════════
  // Experience & Performance
  // ═════════════════════════════════════════════════════════════════

  A7: {
    id: 'A7',
    code: 'A7',
    label: 'UX & performance',
    description: 'Stable layout, no CLS, fast rendering.',
    category: 'Experience & Performance',
    impact_level: 'Medium',
    why_it_matters: 'Readable mobile layouts reduce bounce and improve perceived quality.',
    weight: 8,
    weightKey: 'aeo',
    guideAnchor: '#a7-ux-performance-proxies'
  }
};

// Helper functions
export const getCheckMetaV2 = (code: string): CheckMetaV2 | undefined => {
  return CHECKS_V2[code];
};

export const getChecksByCategory = (): Record<CheckCategory, CheckMetaV2[]> => {
  const byCategory: Record<string, CheckMetaV2[]> = {};
  
  Object.values(CHECKS_V2).forEach(check => {
    if (!byCategory[check.category]) {
      byCategory[check.category] = [];
    }
    byCategory[check.category].push(check);
  });
  
  return byCategory as Record<CheckCategory, CheckMetaV2[]>;
};

export const getChecksByImpact = (level: ImpactLevel): CheckMetaV2[] => {
  return Object.values(CHECKS_V2).filter(check => check.impact_level === level);
};

// Category order for UI display
export const CATEGORY_ORDER: CheckCategory[] = [
  'Content & Clarity',
  'Structure & Organization',
  'Authority & Trust',
  'Technical Foundations',
  'Crawl & Discoverability',
  'Experience & Performance'
];

// Get all checks sorted by category and impact
export const getChecksSortedByPriority = (): CheckMetaV2[] => {
  const impactWeight = { High: 3, Medium: 2, Low: 1 };
  
  return Object.values(CHECKS_V2).sort((a, b) => {
    // First sort by category order
    const catA = CATEGORY_ORDER.indexOf(a.category);
    const catB = CATEGORY_ORDER.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    
    // Then by impact level
    const impactA = impactWeight[a.impact_level];
    const impactB = impactWeight[b.impact_level];
    if (impactA !== impactB) return impactB - impactA;
    
    // Finally by weight
    return b.weight - a.weight;
  });
};

