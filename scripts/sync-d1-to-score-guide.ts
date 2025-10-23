#!/usr/bin/env ts-node
/**
 * Sync D1 scoring criteria export to score guide checks.ts
 * 
 * Transforms scoring_criteria D1 table data into the CheckDoc format
 * used by the frontend score guide.
 */

import * as fs from 'fs';
import * as path from 'path';

// D1 scoring criterion shape
interface D1Criterion {
  id: string;
  label: string;
  description: string | null;
  category: string;
  scope: 'page' | 'site';
  weight: number;
  impact_level: 'High' | 'Medium' | 'Low';
  check_type: 'html_dom' | 'llm' | 'aggregate' | 'http';
  preview: number; // 0 or 1
  why_it_matters: string | null;
  how_to_fix: string | null;
  common_issues: string | null;
  quick_fixes: string | null;
  scoring_approach: string | null;
  display_order: number | null;
  examples: string | null;
  view_in_ui: number;
}

// Frontend CheckDoc shape
interface CheckDoc {
  id: string;
  slug: string;
  title: string;
  category: string;
  weight: number;
  summary: string;
  whyItMatters: string;
  detectionNotes?: string[];
  examples: {
    good: Array<{ caption: string; html?: string; text?: string; schema?: string }>;
    bad: Array<{ caption: string; html?: string; text?: string; schema?: string }>;
  };
  implementation: string[];
  qaChecklist: string[];
  links?: Array<{ label: string; href: string }>;
}

// Category mapping from D1 to frontend
const CATEGORY_MAP: Record<string, string> = {
  'Technical Foundations': 'Schema',
  'Structure & Organization': 'Structure',
  'Content & Clarity': 'Structure',
  'Authority & Trust': 'Authority',
  'Crawl & Discoverability': 'Crawl',
  'Experience & Performance': 'UX'
};

// Convert ID to slug
function idToSlug(id: string, label: string): string {
  return label.toLowerCase()
    .replace(/[()]/g, '')
    .replace(/&/g, 'and')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
}

// Parse bullet list string into array
function parseBulletList(text: string | null): string[] {
  if (!text) return [];
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('•') || line.startsWith('-') || line.startsWith('*'))
    .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
    .filter(Boolean);
}

// Transform D1 criterion to CheckDoc
function transformCriterion(c: D1Criterion): CheckDoc {
  const slug = idToSlug(c.id, c.label);
  const category = CATEGORY_MAP[c.category] || 'Structure';
  
  // Parse implementation steps from how_to_fix
  const implementation = parseBulletList(c.how_to_fix);
  if (implementation.length === 0) {
    implementation.push(c.how_to_fix || 'Implementation steps to be added.');
  }
  
  // Parse QA checklist from quick_fixes or common_issues
  const qaChecklist = parseBulletList(c.quick_fixes || c.common_issues);
  if (qaChecklist.length === 0) {
    qaChecklist.push('Verify implementation is complete');
    qaChecklist.push('Test across multiple pages');
    qaChecklist.push('Validate with browser DevTools');
  }
  
  // Detection notes from scoring_approach
  const detectionNotes = c.scoring_approach 
    ? [c.scoring_approach]
    : undefined;
  
  // Create examples (placeholder for now - can be enhanced)
  const examples = {
    good: [
      { 
        caption: 'Correct implementation',
        text: c.examples || `Proper implementation of ${c.label.toLowerCase()}`
      }
    ],
    bad: [
      {
        caption: 'Common issue',
        text: c.common_issues?.split('\n')[0] || `Missing or incorrect ${c.label.toLowerCase()}`
      }
    ]
  };
  
  return {
    id: c.id,
    slug,
    title: `${c.label} (${c.id})`,
    category,
    weight: c.weight,
    summary: c.description || c.label,
    whyItMatters: c.why_it_matters || `Important for ${category.toLowerCase()} optimization.`,
    detectionNotes,
    examples,
    implementation,
    qaChecklist,
  };
}

// Main function
function main() {
  const exportPath = path.join(__dirname, '../packages/audit-worker/exports/scoring_criteria_latest.json');
  const outputPath = path.join(__dirname, '../apps/app/src/content/score-guide/checks.ts');
  
  console.log('📖 Reading D1 export:', exportPath);
  const criteria: D1Criterion[] = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  
  console.log(`✅ Found ${criteria.length} criteria`);
  
  // Filter to page-level checks only (exclude site-level aggregates)
  const pageChecks = criteria.filter(c => c.scope === 'page');
  console.log(`📄 ${pageChecks.length} page-level checks`);
  
  // Sort by display_order
  pageChecks.sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
  
  // Transform to CheckDoc format
  const checks = pageChecks.map(transformCriterion);
  
  // Generate TypeScript file content
  const tsContent = `/**
 * Scoring Guide Checks
 * 
 * Generated from D1 scoring_criteria table
 * Run: npm run sync-score-guide
 * 
 * Last synced: ${new Date().toISOString()}
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

export const CHECKS: CheckDoc[] = ${JSON.stringify(checks, null, 2)};

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
`;
  
  console.log('💾 Writing checks.ts:', outputPath);
  fs.writeFileSync(outputPath, tsContent, 'utf8');
  
  console.log('✨ Done! Score guide updated with', checks.length, 'checks');
  console.log('\nCategories:');
  const byCategory = checks.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(`  • ${cat}: ${count}`);
  });
}

main();

