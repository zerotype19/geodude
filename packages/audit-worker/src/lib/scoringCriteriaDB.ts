/**
 * Scoring Criteria Database Layer
 * 
 * Functions to query and manage scoring criteria from D1
 */

export interface ScoringCriterion {
  id: string;
  version: number;
  label: string;
  description: string | null;
  category: string;
  scope: 'page' | 'site';
  weight: number;
  impact_level: 'High' | 'Medium' | 'Low';
  pass_threshold: number;
  warn_threshold: number;
  check_type: 'html_dom' | 'llm' | 'aggregate' | 'http';
  enabled: boolean;
  preview: boolean;

  // Enhanced fields matching live score guide
  points_possible: number;
  importance_rank: number; // 1=Critical, 2=High, 3=Medium
  scoring_approach: string; // e.g., "Automated HTML analysis"
  examples: string | null; // Good/bad examples
  view_in_ui: string | null; // Where to find in UI
  common_issues: string | null; // Common problems
  quick_fixes: string | null; // Actionable steps
  learn_more_links: string | null; // JSON array
  official_docs: string | null; // JSON array
  display_order: number | null;

  // Original fields
  why_it_matters: string | null;
  how_to_fix: string | null;
  references_json: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get all enabled scoring criteria
 */
export async function getAllCriteria(db: D1Database): Promise<ScoringCriterion[]> {
  const result = await db
    .prepare('SELECT * FROM scoring_criteria WHERE enabled = 1 ORDER BY scope, display_order NULLS LAST, id')
    .all();
  
  return (result.results || []).map(transformRow);
}

/**
 * Get criteria by scope (page or site)
 */
export async function getCriteriaByScope(
  db: D1Database,
  scope: 'page' | 'site'
): Promise<ScoringCriterion[]> {
  const result = await db
    .prepare('SELECT * FROM scoring_criteria WHERE enabled = 1 AND scope = ? ORDER BY display_order NULLS LAST, id')
    .bind(scope)
    .all();
  
  return (result.results || []).map(transformRow);
}

/**
 * Get criteria by category
 */
export async function getCriteriaByCategory(
  db: D1Database,
  category: string
): Promise<ScoringCriterion[]> {
  const result = await db
    .prepare('SELECT * FROM scoring_criteria WHERE enabled = 1 AND category = ? ORDER BY display_order NULLS LAST, id')
    .bind(category)
    .all();
  
  return (result.results || []).map(transformRow);
}

/**
 * Get production-ready criteria (excluding preview)
 */
export async function getProductionCriteria(db: D1Database): Promise<ScoringCriterion[]> {
  const result = await db
    .prepare('SELECT * FROM scoring_criteria WHERE enabled = 1 AND preview = 0 ORDER BY scope, display_order NULLS LAST, id')
    .all();
  
  return (result.results || []).map(transformRow);
}

/**
 * Get single criterion by ID
 */
export async function getCriterionById(
  db: D1Database,
  id: string
): Promise<ScoringCriterion | null> {
  const result = await db
    .prepare('SELECT * FROM scoring_criteria WHERE id = ?')
    .bind(id)
    .first();
  
  return result ? transformRow(result) : null;
}

/**
 * Get criteria statistics
 */
export async function getCriteriaStats(db: D1Database): Promise<{
  total: number;
  page: number;
  site: number;
  production: number;
  preview: number;
  byCategory: Record<string, number>;
  byCheckType: Record<string, number>;
}> {
  const all = await getAllCriteria(db);
  
  const stats = {
    total: all.length,
    page: all.filter(c => c.scope === 'page').length,
    site: all.filter(c => c.scope === 'site').length,
    production: all.filter(c => !c.preview).length,
    preview: all.filter(c => c.preview).length,
    byCategory: {} as Record<string, number>,
    byCheckType: {} as Record<string, number>
  };
  
  // Count by category
  all.forEach(c => {
    stats.byCategory[c.category] = (stats.byCategory[c.category] || 0) + 1;
    stats.byCheckType[c.check_type] = (stats.byCheckType[c.check_type] || 0) + 1;
  });
  
  return stats;
}

/**
 * Get criteria map (ID -> criterion) for fast lookups
 */
export async function getCriteriaMap(db: D1Database): Promise<Map<string, ScoringCriterion>> {
  const criteria = await getAllCriteria(db);
  return new Map(criteria.map(c => [c.id, c]));
}

/**
 * Transform D1 row to ScoringCriterion
 */
function transformRow(row: any): ScoringCriterion {
  return {
    id: row.id,
    version: row.version || 1,
    label: row.label,
    description: row.description,
    category: row.category,
    scope: row.scope as 'page' | 'site',
    weight: row.weight,
    impact_level: row.impact_level as 'High' | 'Medium' | 'Low',
    pass_threshold: row.pass_threshold,
    warn_threshold: row.warn_threshold,
    check_type: row.check_type as 'html_dom' | 'llm' | 'aggregate' | 'http',
    enabled: row.enabled === 1,
    preview: row.preview === 1,
    points_possible: row.points_possible || 100,
    importance_rank: row.importance_rank || 2,
    scoring_approach: row.scoring_approach || '',
    examples: row.examples,
    view_in_ui: row.view_in_ui,
    common_issues: row.common_issues,
    quick_fixes: row.quick_fixes,
    learn_more_links: row.learn_more_links,
    official_docs: row.official_docs,
    display_order: row.display_order,
    why_it_matters: row.why_it_matters,
    how_to_fix: row.how_to_fix,
    references_json: row.references_json,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Calculate weighted score from check results
 * 
 * @param checkResults Map of check ID to score (0-100)
 * @param criteria Array of criteria to weight
 * @returns Weighted average score
 */
export function calculateWeightedScore(
  checkResults: Map<string, number>,
  criteria: ScoringCriterion[]
): number {
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const criterion of criteria) {
    const score = checkResults.get(criterion.id);
    if (score !== undefined) {
      weightedSum += score * criterion.weight;
      totalWeight += criterion.weight;
    }
  }
  
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Group criteria by category
 */
export function groupByCategory(criteria: ScoringCriterion[]): Record<string, ScoringCriterion[]> {
  const grouped: Record<string, ScoringCriterion[]> = {};
  
  for (const criterion of criteria) {
    if (!grouped[criterion.category]) {
      grouped[criterion.category] = [];
    }
    grouped[criterion.category].push(criterion);
  }
  
  return grouped;
}

/**
 * Validate that scoring criteria are properly seeded
 */
export async function validateCriteriaSeeded(db: D1Database): Promise<void> {
  const count = await db
    .prepare('SELECT COUNT(*) as count FROM scoring_criteria WHERE enabled = 1')
    .first<number>('count');
  
  if (!count || count < 30) {
    throw new Error(`❌ Scoring criteria not seeded correctly. Expected ≥30, got ${count || 0}`);
  }
}
