#!/usr/bin/env node

/**
 * Sync D1 scoring_criteria to frontend criteriaV3.ts
 */

const fs = require('fs');
const path = require('path');

const D1_EXPORT = path.join(__dirname, '../exports/d1_export_temp.json');
const FRONTEND_FILE = path.join(__dirname, '../../../apps/app/src/content/criteriaV3.ts');

console.log('🔄 Syncing D1 criteria to frontend...\n');

// Read D1 export
const d1Data = JSON.parse(fs.readFileSync(D1_EXPORT, 'utf8'));
const criteria = d1Data[0].results;

console.log(`Found ${criteria.length} criteria from D1\n`);

// Build TypeScript content
const tsContent = `/**
 * Scoring Criteria V3 - Generated from D1 Table
 * 
 * This is auto-synced from the scoring_criteria D1 table.
 * Run: npm run sync-score-guide to update from latest D1 export.
 * 
 * Includes all 36 checks (23 page-level + 13 site-level)
 * Last synced: ${new Date().toISOString()}
 */

export type Category = 
  | "Content & Clarity"
  | "Structure & Organization"
  | "Authority & Trust"
  | "Technical Foundations"
  | "Crawl & Discoverability"
  | "Experience & Performance";

export interface CriterionMeta {
  id: string;
  version: number;
  label: string;
  title: string;
  description: string;
  category: Category;
  scope: "page" | "site";
  weight: number;
  impact: "High" | "Medium" | "Low";
  pass_threshold: number;
  warn_threshold: number;
  check_type: "html_dom" | "http" | "aggregate" | "llm";
  enabled: boolean;
  preview: boolean;
  why_it_matters?: string;
  how_to_fix?: string;
  common_issues?: string;
  quick_fixes?: string;
  references?: string[];
  learn_more_links?: string;
  official_docs?: string;
  examples?: string;
  display_order?: number;
  points_possible?: number;
  importance_rank?: number;
  scoring_approach?: string;
  view_in_ui?: boolean;
}

export const ALL_CRITERIA: CriterionMeta[] = ${JSON.stringify(
  criteria.map(c => ({
    id: c.id,
    version: c.version || 1,
    label: c.label,
    title: c.label,
    description: c.description,
    category: c.category,
    scope: c.scope,
    weight: c.weight,
    impact: c.impact_level,
    pass_threshold: c.pass_threshold,
    warn_threshold: c.warn_threshold,
    check_type: c.check_type,
    enabled: c.enabled === 1,
    preview: c.preview === 1,
    why_it_matters: c.why_it_matters || undefined,
    how_to_fix: c.how_to_fix || undefined,
    common_issues: c.common_issues || undefined,
    quick_fixes: c.quick_fixes || undefined,
    references: c.references_json ? JSON.parse(c.references_json) : undefined,
    learn_more_links: c.learn_more_links || undefined,
    official_docs: c.official_docs || undefined,
    examples: c.examples || undefined,
    display_order: c.display_order || undefined,
    points_possible: c.points_possible || undefined,
    importance_rank: c.importance_rank || undefined,
    scoring_approach: c.scoring_approach || undefined,
    view_in_ui: c.view_in_ui === "1" || c.view_in_ui === 1,
  })),
  null,
  2
)};

// Create lookup maps
export const CRITERIA_BY_ID = new Map<string, CriterionMeta>(
  ALL_CRITERIA.map(c => [c.id, c])
);

export const CRITERIA_BY_CATEGORY = ALL_CRITERIA.reduce((acc, c) => {
  if (!acc[c.category]) acc[c.category] = [];
  acc[c.category].push(c);
  return acc;
}, {} as Record<Category, CriterionMeta[]>);

export const CATEGORY_ORDER: Category[] = [
  "Content & Clarity",
  "Structure & Organization",
  "Authority & Trust",
  "Technical Foundations",
  "Crawl & Discoverability",
  "Experience & Performance"
];

export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  "Content & Clarity": "Clear, comprehensive content that answers user intent directly",
  "Structure & Organization": "Semantic markup, headings, and structured data for AI understanding",
  "Authority & Trust": "Signals of expertise, credibility, and entity authority",
  "Technical Foundations": "Core metadata, tags, and technical SEO elements",
  "Crawl & Discoverability": "Sitemaps, canonicals, robots, and crawl efficiency",
  "Experience & Performance": "Speed, mobile-readiness, and user experience metrics"
};

export const CATEGORY_EMOJIS: Record<Category, string> = {
  "Content & Clarity": "📝",
  "Structure & Organization": "🏗️",
  "Authority & Trust": "🎖️",
  "Technical Foundations": "⚙️",
  "Crawl & Discoverability": "🔍",
  "Experience & Performance": "⚡"
};

export const CATEGORY_SLUGS: Record<Category, string> = {
  "Content & Clarity": "content-clarity",
  "Structure & Organization": "structure-organization",
  "Authority & Trust": "authority-trust",
  "Technical Foundations": "technical-foundations",
  "Crawl & Discoverability": "crawl-discoverability",
  "Experience & Performance": "experience-performance"
};

export const SLUG_TO_CATEGORY: Record<string, Category> = {
  "content-clarity": "Content & Clarity",
  "structure-organization": "Structure & Organization",
  "authority-trust": "Authority & Trust",
  "technical-foundations": "Technical Foundations",
  "crawl-discoverability": "Crawl & Discoverability",
  "experience-performance": "Experience & Performance"
};
`;

// Write to frontend file
fs.writeFileSync(FRONTEND_FILE, tsContent, 'utf8');

console.log(`✅ Written to: ${FRONTEND_FILE}`);
console.log(`📊 Synced ${criteria.length} criteria to frontend\n`);
console.log('🎉 Frontend criteriaV3.ts is now up to date!');

