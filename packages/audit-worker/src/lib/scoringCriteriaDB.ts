/**
 * Scoring Criteria Database Access
 * 
 * Single source of truth for all scoring checks.
 * Replaces scattered definitions in checksMetadata.ts, criteria.ts, etc.
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
  check_type: 'html_dom' | 'llm' | 'aggregation' | 'manual';
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
 * Get all enabled criteria
 */
export async function getAllCriteria(db: D1Database): Promise<ScoringCriterion[]> {
  const result = await db.prepare(`
    SELECT * FROM scoring_criteria 
    WHERE enabled = 1 
    ORDER BY category, weight DESC, id
  `).all();
  
  return (result.results || []) as ScoringCriterion[];
}

/**
 * Get criteria by IDs
 */
export async function getCriteriaByIds(db: D1Database, ids: string[]): Promise<ScoringCriterion[]> {
  if (!ids.length) return [];
  
  const placeholders = ids.map(() => '?').join(',');
  const result = await db.prepare(`
    SELECT * FROM scoring_criteria 
    WHERE id IN (${placeholders}) AND enabled = 1
  `).bind(...ids).all();
  
  return (result.results || []) as ScoringCriterion[];
}

/**
 * Get criteria by category
 */
export async function getCriteriaByCategory(db: D1Database, category: string): Promise<ScoringCriterion[]> {
  const result = await db.prepare(`
    SELECT * FROM scoring_criteria 
    WHERE category = ? AND enabled = 1 
    ORDER BY weight DESC, id
  `).bind(category).all();
  
  return (result.results || []) as ScoringCriterion[];
}

/**
 * Get criteria by check type (useful for filtering deterministic vs LLM checks)
 */
export async function getCriteriaByType(db: D1Database, checkType: string): Promise<ScoringCriterion[]> {
  const result = await db.prepare(`
    SELECT * FROM scoring_criteria 
    WHERE check_type = ? AND enabled = 1 
    ORDER BY weight DESC, id
  `).bind(checkType).all();
  
  return (result.results || []) as ScoringCriterion[];
}

/**
 * Get single criterion
 */
export async function getCriterion(db: D1Database, id: string): Promise<ScoringCriterion | null> {
  const result = await db.prepare(`
    SELECT * FROM scoring_criteria WHERE id = ?
  `).bind(id).first();
  
  return result as ScoringCriterion | null;
}

/**
 * Update criterion (admin only)
 */
export async function updateCriterion(
  db: D1Database, 
  id: string, 
  updates: Partial<Omit<ScoringCriterion, 'id' | 'created_at'>>
): Promise<void> {
  const sets = Object.keys(updates)
    .filter(k => k !== 'id' && k !== 'created_at')
    .map(k => `${k} = ?`);
  
  if (!sets.length) return;
  
  const values = Object.entries(updates)
    .filter(([k]) => k !== 'id' && k !== 'created_at')
    .map(([, v]) => v);
  
  await db.prepare(`
    UPDATE scoring_criteria 
    SET ${sets.join(', ')}, updated_at = datetime('now')
    WHERE id = ?
  `).bind(...values, id).run();
}

/**
 * Insert new criterion (admin only)
 */
export async function insertCriterion(
  db: D1Database,
  criterion: Omit<ScoringCriterion, 'version' | 'created_at' | 'updated_at'>
): Promise<void> {
  await db.prepare(`
    INSERT INTO scoring_criteria (
      id, label, description, category, scope, weight, impact_level,
      pass_threshold, warn_threshold, check_type, enabled, preview,
      why_it_matters, how_to_fix, references_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    criterion.id,
    criterion.label,
    criterion.description || null,
    criterion.category,
    criterion.scope,
    criterion.weight,
    criterion.impact_level,
    criterion.pass_threshold,
    criterion.warn_threshold,
    criterion.check_type,
    criterion.enabled ? 1 : 0,
    criterion.preview ? 1 : 0,
    criterion.why_it_matters || null,
    criterion.how_to_fix || null,
    criterion.references_json || null
  ).run();
}

/**
 * Get all categories with check counts
 */
export async function getCategorySummary(db: D1Database): Promise<Array<{category: string; count: number; total_weight: number}>> {
  const result = await db.prepare(`
    SELECT 
      category,
      COUNT(*) as count,
      SUM(weight) as total_weight
    FROM scoring_criteria
    WHERE enabled = 1
    GROUP BY category
    ORDER BY total_weight DESC
  `).all();
  
  return result.results as Array<{category: string; count: number; total_weight: number}>;
}

/**
 * Export all criteria as JSON (for syncing to frontend)
 */
export async function exportCriteriaJSON(db: D1Database): Promise<string> {
  const criteria = await getAllCriteria(db);
  return JSON.stringify(criteria, null, 2);
}

