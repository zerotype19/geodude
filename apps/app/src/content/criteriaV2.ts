/**
 * Phase Next: Criteria Registry (Frontend)
 * 
 * Duplicates backend CRITERIA for now; will fetch from API in Phase 3.
 * 
 * 21 checks organized into:
 * - 6 Practical Categories (Business view)
 * - 5 E-E-A-T Pillars (Technical view)
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
  id: string;
  title: string;
  description: string;
  whyItMatters: string;     // Added for UI
  category: Category;
  eeat: EEATPillar;
  impact: Impact;
  weight: number;
  references?: { label: string; url: string }[];
  preview?: boolean;
}

export const CRITERIA: CriterionMeta[] = [
  // Content & Clarity
  {
    id: 'A1',
    title: 'Answer-first design',
    description: 'Clear, concise summary in the first viewport.',
    whyItMatters: 'Improves snippet inclusion and LLM answer utility.',
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
    description: 'Define the main entity early and unambiguously.',
    whyItMatters: 'Helps assistants understand what this page is about.',
    category: 'Content & Clarity',
    eeat: 'Entities & Structure',
    impact: 'High',
    weight: 15
  },
  {
    id: 'G2',
    title: 'Comprehensive coverage',
    description: 'Cover core facets of the topic thoroughly.',
    whyItMatters: 'Depth matters more than breadth for citations.',
    category: 'Content & Clarity',
    eeat: 'Answer Fitness',
    impact: 'High',
    weight: 15
  },
  {
    id: 'G3',
    title: 'Natural language',
    description: 'Conversational tone; avoid keyword stuffing.',
    whyItMatters: 'LLMs prefer natural, readable text.',
    category: 'Content & Clarity',
    eeat: 'Answer Fitness',
    impact: 'Medium',
    weight: 12
  },
  {
    id: 'G9',
    title: 'Content freshness',
    description: 'Up-to-date publish/update dates and periodic review.',
    whyItMatters: 'Fresh content earns more citations.',
    category: 'Content & Clarity',
    eeat: 'Authority/Trust',
    impact: 'Medium',
    weight: 7
  },
  {
    id: 'A12',
    title: 'Q&A scaffold',
    description: 'Explicit Q&A blocks, FAQ schema, or concise answer blocks.',
    whyItMatters: 'Makes your content easy to extract and cite.',
    category: 'Content & Clarity',
    eeat: 'Answer Fitness',
    impact: 'High',
    weight: 10,
    preview: true
  },
  {
    id: 'G12',
    title: 'Topic depth & semantic coverage',
    description: 'Coverage of key co-occurring terms and intents.',
    whyItMatters: 'Shows topical authority and expertise.',
    category: 'Content & Clarity',
    eeat: 'Answer Fitness',
    impact: 'Medium',
    weight: 8,
    preview: true
  },

  // Structure & Organization
  {
    id: 'A2',
    title: 'Topical cluster integrity',
    description: 'Connect related pages; build coherent topic clusters.',
    whyItMatters: 'Internal linking signals topical authority.',
    category: 'Structure & Organization',
    eeat: 'Entities & Structure',
    impact: 'High',
    weight: 15
  },
  {
    id: 'A9',
    title: 'Structured content',
    description: 'Use headings, lists, tables for scannability.',
    whyItMatters: 'Helps both users and AI parsers extract information.',
    category: 'Structure & Organization',
    eeat: 'Answer Fitness',
    impact: 'Medium',
    weight: 5
  },
  {
    id: 'G8',
    title: 'Semantic HTML',
    description: 'Use <article>, <section>, <nav> for hierarchy.',
    whyItMatters: 'Semantic tags communicate meaning beyond visual layout.',
    category: 'Structure & Organization',
    eeat: 'Entities & Structure',
    impact: 'Medium',
    weight: 6
  },
  {
    id: 'G10',
    title: 'Contextual linking',
    description: 'Descriptive anchors that communicate relationships.',
    whyItMatters: '"Learn more" tells nothing; "Compare term vs whole life" tells everything.',
    category: 'Structure & Organization',
    eeat: 'Entities & Structure',
    impact: 'Medium',
    weight: 7
  },
  {
    id: 'G6',
    title: 'Canonical fact URLs',
    description: 'Stable URLs and anchors for individual facts.',
    whyItMatters: 'Makes your content citable at the fact level.',
    category: 'Structure & Organization',
    eeat: 'Entities & Structure',
    impact: 'Medium',
    weight: 8
  },
  {
    id: 'G11',
    title: 'Entity graph completeness',
    description: 'Internal links and schema connect entities across the site.',
    whyItMatters: 'Detects orphaned entities that should be connected.',
    category: 'Structure & Organization',
    eeat: 'Entities & Structure',
    impact: 'Medium',
    weight: 8,
    preview: true
  },

  // Authority & Trust
  {
    id: 'A3',
    title: 'Author attribution',
    description: 'Visible byline and credentials where expertise matters.',
    whyItMatters: 'Essential for YMYL content.',
    category: 'Authority & Trust',
    eeat: 'Authority/Trust',
    impact: 'High',
    weight: 15
  },
  {
    id: 'A4',
    title: 'Cite credible sources',
    description: 'Reference reputable sources; show provenance.',
    whyItMatters: 'Evidence-backed claims reduce hallucination risk.',
    category: 'Authority & Trust',
    eeat: 'Authority/Trust',
    impact: 'High',
    weight: 12
  },
  {
    id: 'A10',
    title: 'Citations & sources section',
    description: 'A short sources section that\'s easy to parse.',
    whyItMatters: 'Concentrates authority signals in one place.',
    category: 'Authority & Trust',
    eeat: 'Authority/Trust',
    impact: 'High',
    weight: 4
  },
  {
    id: 'G7',
    title: 'Brand consistency',
    description: 'Consistent name, voice, and identity.',
    whyItMatters: 'Reduces entity disambiguation errors.',
    category: 'Authority & Trust',
    eeat: 'Authority/Trust',
    impact: 'Medium',
    weight: 8
  },

  // Technical Foundations
  {
    id: 'A5',
    title: 'Schema accuracy & breadth',
    description: 'Valid JSON-LD with appropriate types and required properties.',
    whyItMatters: 'Structured markup helps search and AI systems understand who/what/why.',
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
    description: 'Use Organization, Product, Person, and relationships.',
    whyItMatters: 'Explicit relationships strengthen graph linkage.',
    category: 'Technical Foundations',
    eeat: 'Entities & Structure',
    impact: 'High',
    weight: 10
  },

  // Crawl & Discoverability
  {
    id: 'A6',
    title: 'Crawlable URLs',
    description: 'Clean, semantic paths; sitemaps; internal discovery.',
    whyItMatters: 'Clean URLs improve discovery and deduplication.',
    category: 'Crawl & Discoverability',
    eeat: 'Access & Indexability',
    impact: 'High',
    weight: 10
  },
  {
    id: 'A8',
    title: 'Sitemaps & discoverability',
    description: 'Fresh sitemap with accurate lastmod dates.',
    whyItMatters: 'Accelerates discovery and signals update frequency.',
    category: 'Crawl & Discoverability',
    eeat: 'Access & Indexability',
    impact: 'Medium',
    weight: 6
  },
  {
    id: 'A11',
    title: 'Render visibility (SPA risk)',
    description: 'Key content present in static HTML.',
    whyItMatters: 'Prevents "content missing at crawl-time" failures for bots.',
    category: 'Crawl & Discoverability',
    eeat: 'Access & Indexability',
    impact: 'High',
    weight: 10
  },
  {
    id: 'G4',
    title: 'AI crawler access & parity',
    description: 'Bots see the same DOM as users; robots policy verified.',
    whyItMatters: 'GPTBot/Claude-Web/Perplexity must see the same content.',
    category: 'Crawl & Discoverability',
    eeat: 'Access & Indexability',
    impact: 'High',
    weight: 12
  },
  {
    id: 'C1',
    title: 'AI bot access status',
    description: 'Robots.txt/headers allow GPTBot, Claude-Web, Perplexity-Web.',
    whyItMatters: 'Explicit permission for AI crawlers.',
    category: 'Crawl & Discoverability',
    eeat: 'Access & Indexability',
    impact: 'High',
    weight: 10,
    preview: true
  },

  // Experience & Performance
  {
    id: 'A7',
    title: 'Mobile UX',
    description: 'Readable, usable on small screens.',
    whyItMatters: 'Mobile-first indexing makes this essential.',
    category: 'Experience & Performance',
    eeat: 'Performance & Stability',
    impact: 'Medium',
    weight: 8
  },
  {
    id: 'A8',
    title: 'Page speed (LCP)',
    description: 'Fast LCP; efficient resource delivery.',
    whyItMatters: 'Page speed affects both user engagement and crawl efficiency.',
    category: 'Experience & Performance',
    eeat: 'Performance & Stability',
    impact: 'High',
    weight: 7
  }
];

// Lookup maps
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

// Category order for display
export const CATEGORY_ORDER: Category[] = [
  'Content & Clarity',
  'Structure & Organization',
  'Authority & Trust',
  'Technical Foundations',
  'Crawl & Discoverability',
  'Experience & Performance'
];

// E-E-A-T order for display
export const EEAT_ORDER: EEATPillar[] = [
  'Access & Indexability',
  'Entities & Structure',
  'Answer Fitness',
  'Authority/Trust',
  'Performance & Stability'
];

// Category descriptions
export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  'Content & Clarity': 'Clear, complete answers that assistants can quote.',
  'Structure & Organization': 'Pages and links arranged so people and parsers "get it."',
  'Authority & Trust': 'Visible expertise and evidence to earn citations.',
  'Technical Foundations': 'Schema and semantics that explain meaning to machines.',
  'Crawl & Discoverability': 'Make sure crawlers and AIs can reach and render it.',
  'Experience & Performance': 'Fast, readable, accessible everywhere.'
};

// Category icons/emojis
export const CATEGORY_ICONS: Record<Category, string> = {
  'Content & Clarity': '📝',
  'Structure & Organization': '🏗️',
  'Authority & Trust': '🛡️',
  'Technical Foundations': '⚙️',
  'Crawl & Discoverability': '🔍',
  'Experience & Performance': '⚡'
};

