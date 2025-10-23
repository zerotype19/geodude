/**
 * Scoring Criteria V3 - Generated from D1 Table
 * 
 * This is auto-synced from the scoring_criteria D1 table.
 * Run: npm run sync-score-guide to update from latest D1 export.
 * 
 * Includes all 36 checks (23 page-level + 13 site-level)
 * Last synced: 2025-10-23T07:35:09Z
 */

import scoringCriteriaExport from '../data/scoring_criteria.json';

export type Impact = 'High' | 'Medium' | 'Low';

export type Category =
  | 'Content & Clarity'
  | 'Structure & Organization'
  | 'Authority & Trust'
  | 'Technical Foundations'
  | 'Crawl & Discoverability'
  | 'Experience & Performance';

export type Scope = 'page' | 'site';
export type CheckType = 'html_dom' | 'llm' | 'aggregate' | 'http';

export interface CriterionMeta {
  id: string;
  title: string;
  description: string;
  category: Category;
  scope: Scope;
  weight: number;
  impact: Impact;
  check_type: CheckType;
  preview: boolean;
  why_it_matters: string;
  how_to_fix: string;
  common_issues: string;
  quick_fixes: string;
  scoring_approach: string;
  display_order: number | null;
}

// Transform D1 export to CriterionMeta format
export const CRITERIA: CriterionMeta[] = (scoringCriteriaExport as any[])
  .filter((c: any) => c.enabled === 1)
  .map((c: any) => ({
    id: c.id,
    title: c.label,
    description: c.description || c.label,
    category: c.category as Category,
    scope: c.scope as Scope,
    weight: c.weight,
    impact: c.impact_level as Impact,
    check_type: c.check_type as CheckType,
    preview: c.preview === 1,
    why_it_matters: c.why_it_matters || '',
    how_to_fix: c.how_to_fix || '',
    common_issues: c.common_issues || '',
    quick_fixes: c.quick_fixes || '',
    scoring_approach: c.scoring_approach || '',
    display_order: c.display_order
  }))
  .sort((a, b) => (a.display_order || 999) - (b.display_order || 999));

// Page-level checks only
export const PAGE_CRITERIA = CRITERIA.filter(c => c.scope === 'page');

// Site-level checks only
export const SITE_CRITERIA = CRITERIA.filter(c => c.scope === 'site');

/**
 * Lookup maps
 */
export const CRITERIA_BY_ID = new Map(CRITERIA.map(c => [c.id, c]));

export const CRITERIA_BY_CATEGORY = CRITERIA.reduce((acc, c) => {
  if (!acc[c.category]) acc[c.category] = [];
  acc[c.category].push(c);
  return acc;
}, {} as Record<Category, CriterionMeta[]>);

export const CRITERIA_BY_SCOPE = CRITERIA.reduce((acc, c) => {
  if (!acc[c.scope]) acc[c.scope] = [];
  acc[c.scope].push(c);
  return acc;
}, {} as Record<Scope, CriterionMeta[]>);

export const CRITERIA_BY_IMPACT = CRITERIA.reduce((acc, c) => {
  if (!acc[c.impact]) acc[c.impact] = [];
  acc[c.impact].push(c);
  return acc;
}, {} as Record<Impact, CriterionMeta[]>);

/**
 * Helper functions
 */
export function getCriteriaForCategory(category: Category): CriterionMeta[] {
  return CRITERIA_BY_CATEGORY[category] || [];
}

export function getCriteriaForScope(scope: Scope): CriterionMeta[] {
  return CRITERIA_BY_SCOPE[scope] || [];
}

export function getHighImpactCriteria(): CriterionMeta[] {
  return CRITERIA_BY_IMPACT['High'] || [];
}

export function isPreviewCriterion(id: string): boolean {
  return CRITERIA_BY_ID.get(id)?.preview === true;
}

export function getWeight(id: string): number {
  return CRITERIA_BY_ID.get(id)?.weight || 0;
}

/**
 * Category display order
 */
export const CATEGORY_ORDER: Category[] = [
  'Technical Foundations',
  'Structure & Organization',
  'Content & Clarity',
  'Authority & Trust',
  'Crawl & Discoverability',
  'Experience & Performance'
];

/**
 * Category descriptions
 */
export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  'Technical Foundations': 'Core technical setup that enables assistants to access and understand your content.',
  'Structure & Organization': 'Organize information so assistants can parse and extract key facts reliably.',
  'Content & Clarity': 'Make your content easy to understand and cite with clear, comprehensive answers.',
  'Authority & Trust': 'Build credibility through authorship, citations, and demonstrable expertise.',
  'Crawl & Discoverability': 'Make it easy for AI crawlers to find and index your content.',
  'Experience & Performance': 'Deliver fast, mobile-friendly experiences that signal quality to assistants.'
};

/**
 * Category icons
 */
export const CATEGORY_ICONS: Record<Category, string> = {
  'Technical Foundations': '⚙️',
  'Structure & Organization': '🗂️',
  'Content & Clarity': '📝',
  'Authority & Trust': '🛡️',
  'Crawl & Discoverability': '🔍',
  'Experience & Performance': '⚡'
};

/**
 * Stats
 */
export const STATS = {
  total: CRITERIA.length,
  page: PAGE_CRITERIA.length,
  site: SITE_CRITERIA.length,
  preview: CRITERIA.filter(c => c.preview).length,
  production: CRITERIA.filter(c => !c.preview).length,
  highImpact: CRITERIA.filter(c => c.impact === 'High').length
};

