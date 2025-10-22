/**
 * Scorecard V2 - Check Metadata
 * Backend-compatible version of check definitions
 */

export type ImpactLevel = 'High' | 'Medium' | 'Low';

export type CheckCategory =
  | 'Content & Clarity'
  | 'Structure & Organization'
  | 'Authority & Trust'
  | 'Technical Foundations'
  | 'Crawl & Discoverability'
  | 'Experience & Performance';

export interface CheckMeta {
  id: string;
  label: string;
  category: CheckCategory;
  impact_level: ImpactLevel;
  why_it_matters?: string;
  refs?: string[];
  weight: number;
}

export const CHECKS_METADATA: Record<string, CheckMeta> = {
  // Content & Clarity
  A1: {
    id: 'A1',
    label: 'Answer-first design',
    weight: 15,
    category: 'Content & Clarity',
    impact_level: 'High',
    why_it_matters: 'Clear early answers increase snippet usage and assistant citations.',
    refs: [
      'https://developers.google.com/search/docs/appearance/snippet',
      'https://support.google.com/webmasters/answer/35624'
    ]
  },
  G1: {
    id: 'G1',
    label: 'Clear entity definition',
    weight: 15,
    category: 'Content & Clarity',
    impact_level: 'High',
    why_it_matters: 'LLMs and search map pages to entities; clarity improves matching.'
  },
  G5: {
    id: 'G5',
    label: 'Comprehensive coverage',
    weight: 10,
    category: 'Content & Clarity',
    impact_level: 'High',
    why_it_matters: 'Depth across facets improves topical authority and answer completeness.'
  },
  A10: {
    id: 'A10',
    label: 'Citations and sources section',
    weight: 4,
    category: 'Content & Clarity',
    impact_level: 'High',
    why_it_matters: 'A dedicated "Sources" block concentrates signals for parsers and readers.'
  },
  A9: {
    id: 'A9',
    label: 'Structured content',
    weight: 5,
    category: 'Content & Clarity',
    impact_level: 'Medium',
    why_it_matters: 'Clear headings/lists/tables help scanners and parsers extract facts.'
  },

  // Structure & Organization
  A2: {
    id: 'A2',
    label: 'Topical cluster integrity',
    weight: 10,
    category: 'Structure & Organization',
    impact_level: 'High',
    why_it_matters: 'Internal linking forms coherent topic clusters used by engines to infer context.'
  },
  G6: {
    id: 'G6',
    label: 'Factual accuracy',
    weight: 12,
    category: 'Structure & Organization',
    impact_level: 'High',
    why_it_matters: 'Contradictions/outdated facts undermine inclusion in LLM answers.'
  },
  G10: {
    id: 'G10',
    label: 'Contextual linking',
    weight: 8,
    category: 'Structure & Organization',
    impact_level: 'Medium',
    why_it_matters: 'Descriptive anchors clarify relationships for both users and crawlers.'
  },

  // Authority & Trust
  A3: {
    id: 'A3',
    label: 'Author attribution',
    weight: 8,
    category: 'Authority & Trust',
    impact_level: 'Medium',
    why_it_matters: 'Visible expertise increases reliability for YMYL and expert content.'
  },
  G2: {
    id: 'G2',
    label: 'Natural language',
    weight: 8,
    category: 'Authority & Trust',
    impact_level: 'Medium',
    why_it_matters: 'Conversational tone reads better and avoids keyword-stuffing penalties.'
  },
  G3: {
    id: 'G3',
    label: 'Brand consistency',
    weight: 8,
    category: 'Authority & Trust',
    impact_level: 'Medium',
    why_it_matters: 'Consistent naming/logos reduce entity disambiguation errors.'
  },
  A4: {
    id: 'A4',
    label: 'Cite credible sources',
    weight: 12,
    category: 'Authority & Trust',
    impact_level: 'High',
    why_it_matters: 'Evidence-backed claims reduce hallucination risk and increase citation likelihood.'
  },
  G7: {
    id: 'G7',
    label: 'Content freshness',
    weight: 7,
    category: 'Authority & Trust',
    impact_level: 'Medium',
    why_it_matters: 'Recent, maintained content earns trust and is favored for time-sensitive answers.'
  },
  G9: {
    id: 'G9',
    label: 'Entity relationships (schema)',
    weight: 10,
    category: 'Authority & Trust',
    impact_level: 'High',
    why_it_matters: 'Explicit relationships (Organization→Product→Person) strengthen graph linkage.'
  },

  // Technical Foundations
  A5: {
    id: 'A5',
    label: 'Schema accuracy & breadth',
    weight: 10,
    category: 'Technical Foundations',
    impact_level: 'High',
    why_it_matters: 'Valid JSON-LD maps your page to entities/types answer engines rely on.',
    refs: [
      'https://schema.org',
      'https://developers.google.com/search/docs/appearance/structured-data'
    ]
  },
  G8: {
    id: 'G8',
    label: 'Semantic HTML',
    weight: 8,
    category: 'Technical Foundations',
    impact_level: 'Medium',
    why_it_matters: 'Semantic tags communicate hierarchy and meaning beyond visual layout.'
  },

  // Crawl & Discoverability
  A6: {
    id: 'A6',
    label: 'Crawlable URLs',
    weight: 10,
    category: 'Crawl & Discoverability',
    impact_level: 'High',
    why_it_matters: 'Clean URLs + sitemap improve discovery and deduplication.'
  },
  A8: {
    id: 'A8',
    label: 'Page speed (LCP)',
    weight: 7,
    category: 'Crawl & Discoverability',
    impact_level: 'Medium',
    why_it_matters: 'Faster loads improve engagement and crawling efficiency.'
  },
  A11: {
    id: 'A11',
    label: 'Render visibility (SPA risk)',
    weight: 10,
    category: 'Crawl & Discoverability',
    impact_level: 'High',
    why_it_matters: 'Static HTML parity prevents "content missing at crawl-time" failures.'
  },
  G4: {
    id: 'G4',
    label: 'AI crawler access & parity',
    weight: 12,
    category: 'Crawl & Discoverability',
    impact_level: 'High',
    why_it_matters: 'GPTBot/Claude-Web/Perplexity must see the same DOM users see.'
  },

  // Experience & Performance
  A7: {
    id: 'A7',
    label: 'Mobile UX',
    weight: 8,
    category: 'Experience & Performance',
    impact_level: 'Medium',
    why_it_matters: 'Readable mobile layouts reduce bounce and improve perceived quality.'
  },

  // ═════════════════════════════════════════════════════════════════
  // Scoring V1 - HTML-based Deterministic Checks (Page-level)
  // ═════════════════════════════════════════════════════════════════
  
  C1_title_quality: {
    id: 'C1_title_quality',
    label: 'Title tag quality',
    weight: 12,
    category: 'Technical Foundations',
    impact_level: 'High',
    why_it_matters: 'Well-crafted titles improve click-through and snippet generation.'
  },
  C2_meta_description: {
    id: 'C2_meta_description',
    label: 'Meta description present',
    weight: 8,
    category: 'Technical Foundations',
    impact_level: 'Medium',
    why_it_matters: 'Descriptions guide snippet generation and set user expectations.'
  },
  C3_h1_presence: {
    id: 'C3_h1_presence',
    label: 'Single H1 tag',
    weight: 10,
    category: 'Structure & Organization',
    impact_level: 'High',
    why_it_matters: 'Clear page hierarchy helps parsers identify main topic.'
  },
  A1_answer_first: {
    id: 'A1_answer_first',
    label: 'Answer-first hero section',
    weight: 15,
    category: 'Content & Clarity',
    impact_level: 'High',
    why_it_matters: 'Early value proposition improves snippet quality and engagement.'
  },
  A2_headings_semantic: {
    id: 'A2_headings_semantic',
    label: 'Semantic heading structure',
    weight: 10,
    category: 'Structure & Organization',
    impact_level: 'High',
    why_it_matters: 'Proper H1→H2→H3 hierarchy improves content parsing.'
  },
  A3_faq_presence: {
    id: 'A3_faq_presence',
    label: 'FAQ section present',
    weight: 8,
    category: 'Content & Clarity',
    impact_level: 'Medium',
    why_it_matters: 'FAQ blocks increase answer engine citation likelihood.'
  },
  A4_schema_faqpage: {
    id: 'A4_schema_faqpage',
    label: 'FAQPage schema',
    weight: 10,
    category: 'Technical Foundations',
    impact_level: 'High',
    why_it_matters: 'Structured FAQ data enables rich snippets and voice answers.'
  },
  A9_internal_linking: {
    id: 'A9_internal_linking',
    label: 'Internal linking & diversity',
    weight: 7,
    category: 'Structure & Organization',
    impact_level: 'Medium',
    why_it_matters: 'Rich internal links improve crawl depth and topical clustering.'
  },
  G10_canonical: {
    id: 'G10_canonical',
    label: 'Canonical URL correctness',
    weight: 8,
    category: 'Technical Foundations',
    impact_level: 'Medium',
    why_it_matters: 'Proper canonicals prevent duplicate content penalties.'
  },
  T1_mobile_viewport: {
    id: 'T1_mobile_viewport',
    label: 'Mobile viewport tag',
    weight: 8,
    category: 'Experience & Performance',
    impact_level: 'Medium',
    why_it_matters: 'Viewport meta ensures mobile-friendly rendering.'
  },
  T2_lang_region: {
    id: 'T2_lang_region',
    label: 'Language/region tags',
    weight: 6,
    category: 'Technical Foundations',
    impact_level: 'Low',
    why_it_matters: 'Correct lang attributes improve international targeting.'
  },
  T3_noindex_robots: {
    id: 'T3_noindex_robots',
    label: 'No blocking robots directives',
    weight: 12,
    category: 'Crawl & Discoverability',
    impact_level: 'High',
    why_it_matters: 'Noindex/nofollow prevent crawlers from seeing content.'
  },
  A12_entity_graph: {
    id: 'A12_entity_graph',
    label: 'Organization entity graph',
    weight: 10,
    category: 'Authority & Trust',
    impact_level: 'High',
    why_it_matters: 'Rich organization schema strengthens entity recognition.'
  }
};

