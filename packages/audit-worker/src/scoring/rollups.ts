/**
 * Phase Next: Category & E-E-A-T Rollup Calculations
 * 
 * Computes weighted scores for:
 * - 6 Practical Categories (Content & Clarity, Structure & Organization, etc.)
 * - 5 E-E-A-T Pillars (Access & Indexability, Entities & Structure, etc.)
 */

import { CRITERIA, CRITERIA_BY_CATEGORY, CRITERIA_BY_EEAT, Category, EEATPillar } from './criteria';

export interface CategoryScore {
  category: Category;
  score: number;          // 0-100
  weight_total: number;
  checks_count: number;
  checks: string[];       // Check IDs in this category
}

export interface EEATScore {
  pillar: EEATPillar;
  score: number;          // 0-100
  weight_total: number;
  checks_count: number;
  checks: string[];       // Check IDs in this pillar
}

/**
 * Compute category rollup scores from individual check scores
 * 
 * @param checkScores - Map of check ID to score (0-3 scale)
 * @returns Array of category scores
 */
export function computeCategoryRollups(checkScores: Record<string, number>): CategoryScore[] {
  const rollups: Record<Category, { sum: number; weight: number; checks: string[] }> = {} as any;

  for (const criterion of CRITERIA) {
    const score = checkScores[criterion.id];
    if (score == null) continue;

    if (!rollups[criterion.category]) {
      rollups[criterion.category] = { sum: 0, weight: 0, checks: [] };
    }

    // Normalize score to 0-100 scale (score is 0-3, so * 100/3)
    const normalizedScore = (score / 3) * 100;
    rollups[criterion.category].sum += normalizedScore * criterion.weight;
    rollups[criterion.category].weight += criterion.weight;
    rollups[criterion.category].checks.push(criterion.id);
  }

  return Object.entries(rollups).map(([category, data]) => ({
    category: category as Category,
    score: Math.round(data.sum / Math.max(1, data.weight)),
    weight_total: data.weight,
    checks_count: data.checks.length,
    checks: data.checks
  }));
}

/**
 * Compute E-E-A-T rollup scores from individual check scores
 * 
 * @param checkScores - Map of check ID to score (0-3 scale)
 * @returns Array of E-E-A-T pillar scores
 */
export function computeEEATRollups(checkScores: Record<string, number>): EEATScore[] {
  const rollups: Record<EEATPillar, { sum: number; weight: number; checks: string[] }> = {} as any;

  for (const criterion of CRITERIA) {
    const score = checkScores[criterion.id];
    if (score == null) continue;

    if (!rollups[criterion.eeat]) {
      rollups[criterion.eeat] = { sum: 0, weight: 0, checks: [] };
    }

    // Normalize score to 0-100 scale
    const normalizedScore = (score / 3) * 100;
    rollups[criterion.eeat].sum += normalizedScore * criterion.weight;
    rollups[criterion.eeat].weight += criterion.weight;
    rollups[criterion.eeat].checks.push(criterion.id);
  }

  return Object.entries(rollups).map(([pillar, data]) => ({
    pillar: pillar as EEATPillar,
    score: Math.round(data.sum / Math.max(1, data.weight)),
    weight_total: data.weight,
    checks_count: data.checks.length,
    checks: data.checks
  }));
}

/**
 * Get top failing checks for recommendations
 * Prioritizes by impact level then weight
 * 
 * @param checkScores - Map of check ID to score (0-3 scale)
 * @param limit - Maximum number of checks to return
 * @returns Array of check IDs sorted by priority
 */
export function getTopFailingChecks(checkScores: Record<string, number>, limit: number = 5): string[] {
  const impactWeights = { High: 3, Medium: 2, Low: 1 };

  const failing = CRITERIA
    .filter(c => {
      const score = checkScores[c.id];
      return score != null && score < 3;  // Failing = score < 3
    })
    .map(c => ({
      id: c.id,
      score: checkScores[c.id],
      priority: impactWeights[c.impact] * c.weight * (3 - checkScores[c.id])
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map(c => c.id);

  return failing;
}

/**
 * Get category score for a specific category
 */
export function getCategoryScore(checkScores: Record<string, number>, category: Category): number {
  const rollups = computeCategoryRollups(checkScores);
  const categoryRollup = rollups.find(r => r.category === category);
  return categoryRollup?.score || 0;
}

/**
 * Get E-E-A-T score for a specific pillar
 */
export function getEEATScore(checkScores: Record<string, number>, pillar: EEATPillar): number {
  const rollups = computeEEATRollups(checkScores);
  const pillarRollup = rollups.find(r => r.pillar === pillar);
  return pillarRollup?.score || 0;
}

/**
 * Format rollups for storage in audit_page_analysis.metadata
 */
export function formatRollupsForStorage(checkScores: Record<string, number>): {
  category_scores: Record<Category, number>;
  eeat_scores: Record<EEATPillar, number>;
} {
  const categoryRollups = computeCategoryRollups(checkScores);
  const eeatRollups = computeEEATRollups(checkScores);

  return {
    category_scores: categoryRollups.reduce((acc, r) => {
      acc[r.category] = r.score;
      return acc;
    }, {} as Record<Category, number>),
    eeat_scores: eeatRollups.reduce((acc, r) => {
      acc[r.pillar] = r.score;
      return acc;
    }, {} as Record<EEATPillar, number>)
  };
}

