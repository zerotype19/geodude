/**
 * Phase Next: Unified Criteria Registry
 * 
 * This is the single source of truth for all AEO/GEO checks, including:
 * - Practical categories (6 categories for business users)
 * - E-E-A-T pillars (5 pillars for technical users)
 * - Impact levels (High/Medium/Low for prioritization)
 * - Plain-language descriptions (outcome-led, not task-led)
 * 
 * IDs remain stable for backward compatibility (A1-A12, G1-G12, C1, etc.)
 */

export type Impact = 'High' | 'Medium' | 'Low';

export type Category =
  | 'Content & Clarity'
  | 'Structure & Organization'
  | 'Authority & Trust'
  | 'Technical Foundations'
  | 'Crawl & Discoverability'
  | 'Experience & Performance';

export type EEATPillar =
  | 'Access & Indexability'
  | 'Entities & Structure'
  | 'Answer Fitness'
  | 'Authority/Trust'
  | 'Performance & Stability';

export interface CriterionMeta {
  id: string;               // e.g., 'A1', 'G2', 'A12', 'C1'
  title: string;            // Display name
  description: string;      // Plain-language, outcome-led description
  category: Category;       // Practical category
  eeat: EEATPillar;        // E-E-A-T pillar
  impact: Impact;           // High/Medium/Low
  weight: number;           // Scoring weight (existing W#)
  references?: { label: string; url: string }[];  // Optional supporting docs
  preview?: boolean;        // True for new checks in shadow mode
}

/**
 * Complete criteria registry
 * Phase Next: existing checks remapped + new checks (A12, C1, G11, G12)
 */
export const CRITERIA: CriterionMeta[] = [
  // ═════════════════════════════════════════════════════════════════
  // Content & Clarity
  // ═════════════════════════════════════════════════════════════════
  {
    id: 'A1',
    title: 'Answer-first design',
    description: 'Clear, concise summary in the first viewport. Improves snippet inclusion and LLM answer utility.',
    category: 'Content & Clarity',
    eeat: 'Answer Fitness',
    impact: 'High',
    weight: 15,
    references: [
      { label: 'Google Snippet Guidelines', url: 'https://developers.google.com/search/docs/appearance/snippet' }
    ]
  },
  {
    id: 'G1',
    title: 'Clear entity definition',
    description: 'Define the main entity (brand, product, concept) early and unambiguously. Helps assistants understand what this page is about.',
    category: 'Content & Clarity',
    eeat: 'Entities & Structure',
    impact: 'High',
    weight: 15
  },
  {
    id: 'G2',
    title: 'Comprehensive coverage',
    description: 'Cover core facets of the topic so assistants can cite you with confidence. Depth matters more than breadth.',
    category: 'Content & Clarity',
    eeat: 'Answer Fitness',
    impact: 'High',
    weight: 15
  },
  {
    id: 'G3',
    title: 'Natural language',
    description: 'Conversational tone; avoid keyword stuffing. LLMs prefer natural, readable text.',
    category: 'Content & Clarity',
    eeat: 'Answer Fitness',
    impact: 'Medium',
    weight: 12
  },
  {
    id: 'G9',
    title: 'Content freshness',
    description: 'Up-to-date publish/update dates and periodic review. Fresh content earns more citations.',
    category: 'Content & Clarity',
    eeat: 'Authority/Trust',
    impact: 'Medium',
    weight: 7
  },
  {
    id: 'A12',
    title: 'Q&A scaffold',
    description: 'Explicit Q&A blocks, FAQ schema, or concise answer blocks that increase snippetability. Makes your content easy to extract.',
    category: 'Content & Clarity',
    eeat: 'Answer Fitness',
    impact: 'High',
    weight: 10,
    preview: true  // Shadow mode
  },
  {
    id: 'G12',
    title: 'Topic depth & semantic coverage',
    description: 'Coverage of key co-occurring terms and intents for the topic. Shows topical authority.',
    category: 'Content & Clarity',
    eeat: 'Answer Fitness',
    impact: 'Medium',
    weight: 8,
    preview: true  // Shadow mode
  },

  // ═════════════════════════════════════════════════════════════════
  // Structure & Organization
  // ═════════════════════════════════════════════════════════════════
  {
    id: 'A2',
    title: 'Topical cluster integrity',
    description: 'Connect related pages; build coherent topic clusters. Internal linking signals topical authority.',
    category: 'Structure & Organization',
    eeat: 'Entities & Structure',
    impact: 'High',
    weight: 15
  },
  {
    id: 'A9',
    title: 'Structured content',
    description: 'Use headings, lists, tables for scannability. Helps both users and AI parsers extract information.',
    category: 'Structure & Organization',
    eeat: 'Answer Fitness',
    impact: 'Medium',
    weight: 5
  },
  {
    id: 'G8',
    title: 'Semantic HTML',
    description: 'Use <article>, <section>, <nav> for hierarchy. Semantic tags communicate meaning beyond visual layout.',
    category: 'Structure & Organization',
    eeat: 'Entities & Structure',
    impact: 'Medium',
    weight: 6
  },
  {
    id: 'G10',
    title: 'Contextual linking',
    description: 'Descriptive anchors that communicate relationships. "Learn more" tells nothing; "Compare term life vs whole life" tells everything.',
    category: 'Structure & Organization',
    eeat: 'Entities & Structure',
    impact: 'Medium',
    weight: 7
  },
  {
    id: 'G6',
    title: 'Canonical fact URLs',
    description: 'Stable URLs and anchors for individual facts. Makes your content citable at the fact level.',
    category: 'Structure & Organization',
    eeat: 'Entities & Structure',
    impact: 'Medium',
    weight: 8
  },
  {
    id: 'G11',
    title: 'Entity graph completeness',
    description: 'Internal links and schema connect entities across the site. Detects orphaned entities that should be connected.',
    category: 'Structure & Organization',
    eeat: 'Entities & Structure',
    impact: 'Medium',
    weight: 8,
    preview: true  // Shadow mode
  },

  // ═════════════════════════════════════════════════════════════════
  // Authority & Trust
  // ═════════════════════════════════════════════════════════════════
  {
    id: 'A3',
    title: 'Author attribution',
    description: 'Visible byline and credentials where expertise matters. Essential for YMYL content.',
    category: 'Authority & Trust',
    eeat: 'Authority/Trust',
    impact: 'High',
    weight: 15
  },
  {
    id: 'A4',
    title: 'Cite credible sources',
    description: 'Reference reputable sources; show provenance. Evidence-backed claims reduce hallucination risk.',
    category: 'Authority & Trust',
    eeat: 'Authority/Trust',
    impact: 'High',
    weight: 12
  },
  {
    id: 'A10',
    title: 'Citations & sources section',
    description: 'A short sources section that is easy to parse. Concentrates authority signals in one place.',
    category: 'Authority & Trust',
    eeat: 'Authority/Trust',
    impact: 'High',
    weight: 4
  },
  {
    id: 'G6',
    title: 'Factual accuracy',
    description: 'No contradictions or outdated claims. Contradictions undermine inclusion in LLM answers.',
    category: 'Authority & Trust',
    eeat: 'Authority/Trust',
    impact: 'High',
    weight: 12
  },
  {
    id: 'G7',
    title: 'Brand consistency',
    description: 'Consistent name, voice, and identity. Reduces entity disambiguation errors.',
    category: 'Authority & Trust',
    eeat: 'Authority/Trust',
    impact: 'Medium',
    weight: 8
  },

  // ═════════════════════════════════════════════════════════════════
  // Technical Foundations
  // ═════════════════════════════════════════════════════════════════
  {
    id: 'A5',
    title: 'Schema accuracy & breadth',
    description: 'Valid JSON-LD with appropriate types and required properties. Structured markup helps search and AI systems understand who/what/why this page exists.',
    category: 'Technical Foundations',
    eeat: 'Entities & Structure',
    impact: 'High',
    weight: 10,
    references: [
      { label: 'Schema.org', url: 'https://schema.org' },
      { label: 'Google Structured Data', url: 'https://developers.google.com/search/docs/appearance/structured-data' }
    ]
  },
  {
    id: 'G5',
    title: 'Entity relationships (schema)',
    description: 'Use Organization, Product, Person, and relationships. Explicit relationships strengthen graph linkage.',
    category: 'Technical Foundations',
    eeat: 'Entities & Structure',
    impact: 'High',
    weight: 10
  },

  // ═════════════════════════════════════════════════════════════════
  // Crawl & Discoverability
  // ═════════════════════════════════════════════════════════════════
  {
    id: 'A6',
    title: 'Crawlable URLs',
    description: 'Clean, semantic paths; sitemaps; internal discovery. Clean URLs improve discovery and deduplication.',
    category: 'Crawl & Discoverability',
    eeat: 'Access & Indexability',
    impact: 'High',
    weight: 10
  },
  {
    id: 'A8',
    title: 'Sitemaps & discoverability',
    description: 'Fresh sitemap with accurate lastmod dates. Accelerates discovery and signals update frequency.',
    category: 'Crawl & Discoverability',
    eeat: 'Access & Indexability',
    impact: 'Medium',
    weight: 6
  },
  {
    id: 'A11',
    title: 'Render visibility (SPA risk)',
    description: 'Key content present in static HTML. Prevents "content missing at crawl-time" failures for bots that don\'t execute JavaScript.',
    category: 'Crawl & Discoverability',
    eeat: 'Access & Indexability',
    impact: 'High',
    weight: 10
  },
  {
    id: 'G4',
    title: 'AI crawler access & parity',
    description: 'Bots see the same DOM as users; robots policy verified. GPTBot/Claude-Web/Perplexity must see the same content.',
    category: 'Crawl & Discoverability',
    eeat: 'Access & Indexability',
    impact: 'High',
    weight: 12
  },
  {
    id: 'C1',
    title: 'AI bot access status',
    description: 'Robots.txt/headers allow GPTBot, Claude-Web, Perplexity-Web. Explicit permission for AI crawlers.',
    category: 'Crawl & Discoverability',
    eeat: 'Access & Indexability',
    impact: 'High',
    weight: 10,
    preview: true  // Shadow mode
  },

  // ═════════════════════════════════════════════════════════════════
  // Experience & Performance
  // ═════════════════════════════════════════════════════════════════
  {
    id: 'A7',
    title: 'Mobile UX',
    description: 'Readable, usable on small screens. Mobile-first indexing makes this essential.',
    category: 'Experience & Performance',
    eeat: 'Performance & Stability',
    impact: 'Medium',
    weight: 8
  },
  {
    id: 'A8',
    title: 'Page speed (LCP)',
    description: 'Fast LCP; efficient resource delivery. Page speed affects both user engagement and crawl efficiency.',
    category: 'Experience & Performance',
    eeat: 'Performance & Stability',
    impact: 'High',
    weight: 7
  }
];

/**
 * Lookup maps for fast access
 */
export const CRITERIA_BY_ID = new Map(CRITERIA.map(c => [c.id, c]));

export const CRITERIA_BY_CATEGORY = CRITERIA.reduce((acc, c) => {
  if (!acc[c.category]) acc[c.category] = [];
  acc[c.category].push(c);
  return acc;
}, {} as Record<Category, CriterionMeta[]>);

export const CRITERIA_BY_EEAT = CRITERIA.reduce((acc, c) => {
  if (!acc[c.eeat]) acc[c.eeat] = [];
  acc[c.eeat].push(c);
  return acc;
}, {} as Record<EEATPillar, CriterionMeta[]>);

export const CRITERIA_BY_IMPACT = CRITERIA.reduce((acc, c) => {
  if (!acc[c.impact]) acc[c.impact] = [];
  acc[c.impact].push(c);
  return acc;
}, {} as Record<Impact, CriterionMeta[]>);

/**
 * Get all criteria IDs for a specific category
 */
export function getCriteriaForCategory(category: Category): string[] {
  return (CRITERIA_BY_CATEGORY[category] || []).map(c => c.id);
}

/**
 * Get all criteria IDs for a specific E-E-A-T pillar
 */
export function getCriteriaForEEAT(pillar: EEATPillar): string[] {
  return (CRITERIA_BY_EEAT[pillar] || []).map(c => c.id);
}

/**
 * Get all high-impact criteria IDs
 */
export function getHighImpactCriteria(): string[] {
  return (CRITERIA_BY_IMPACT['High'] || []).map(c => c.id);
}

/**
 * Check if a criterion is in preview/shadow mode
 */
export function isPreviewCriterion(id: string): boolean {
  return CRITERIA_BY_ID.get(id)?.preview === true;
}

/**
 * Get scoring weight for a criterion
 */
export function getWeight(id: string): number {
  return CRITERIA_BY_ID.get(id)?.weight || 0;
}


/**
 * Category display order
 */
export const CATEGORY_ORDER: Category[] = [
  'Content & Clarity',
  'Structure & Organization',
  'Authority & Trust',
  'Technical Foundations',
  'Crawl & Discoverability',
  'Experience & Performance'
];

/**
 * Category descriptions
 */
export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  'Content & Clarity': 'Make your content easy to understand and cite with clear, comprehensive answers.',
  'Structure & Organization': 'Organize information so assistants can parse and extract key facts reliably.',
  'Authority & Trust': 'Build credibility through authorship, citations, and demonstrable expertise.',
  'Technical Foundations': 'Ensure assistants can access, parse, and understand your site structure.',
  'Crawl & Discoverability': 'Make it easy for AI crawlers to find and index your content.',
  'Experience & Performance': 'Deliver fast, mobile-friendly experiences that signal quality to assistants.'
};

/**
 * Category icons
 */
export const CATEGORY_ICONS: Record<Category, string> = {
  'Content & Clarity': '📝',
  'Structure & Organization': '🗂️',
  'Authority & Trust': '🛡️',
  'Technical Foundations': '⚙️',
  'Crawl & Discoverability': '🔍',
  'Experience & Performance': '⚡'
};
