/**
 * Composite Score Calculation
 * 
 * Calculates weighted scores across categories using scoring criteria from D1
 */

import { ScoringCriterion, calculateWeightedScore, groupByCategory } from './scoringCriteriaDB';

export interface CheckResult {
  id: string;
  score: number;
  status: 'ok' | 'warn' | 'fail' | 'not_applicable' | 'error';
  details?: any;
}

export interface CategoryScore {
  category: string;
  score: number;
  status: 'ok' | 'warn' | 'fail' | 'not_applicable';
  checksPresent: number;
  checksTotal: number;
  checks: Array<{
    id: string;
    label: string;
    score: number;
    status: string;
    weight: number;
  }>;
}

export interface CompositeScore {
  overall: number;
  overallStatus: 'ok' | 'warn' | 'fail';
  categories: CategoryScore[];
  pageScore: number | null;
  siteScore: number | null;
  stats: {
    totalChecks: number;
    checksRun: number;
    productionChecks: number;
    previewChecks: number;
  };
}

/**
 * Calculate composite score for an audit
 * 
 * @param checkResults Array of check results from audit
 * @param criteria Scoring criteria from D1 (production only)
 * @returns Composite score with category breakdown
 */
export function calculateCompositeScore(
  checkResults: CheckResult[],
  criteria: ScoringCriterion[]
): CompositeScore {
  // Filter to production criteria only (exclude preview)
  const productionCriteria = criteria.filter(c => !c.preview);
  
  // Create maps for fast lookup
  const resultsMap = new Map(checkResults.map(r => [r.id, r]));
  const criteriaMap = new Map(productionCriteria.map(c => [c.id, c]));
  
  // Separate page and site criteria
  const pageCriteria = productionCriteria.filter(c => c.scope === 'page');
  const siteCriteria = productionCriteria.filter(c => c.scope === 'site');
  
  // Calculate page-level score
  const pageScores = new Map<string, number>();
  pageCriteria.forEach(c => {
    const result = resultsMap.get(c.id);
    if (result && result.status !== 'not_applicable' && result.status !== 'error') {
      pageScores.set(c.id, result.score);
    }
  });
  const pageScore = pageCriteria.length > 0 
    ? calculateWeightedScore(pageScores, pageCriteria) 
    : null;
  
  // Calculate site-level score
  const siteScores = new Map<string, number>();
  siteCriteria.forEach(c => {
    const result = resultsMap.get(c.id);
    if (result && result.status !== 'not_applicable' && result.status !== 'error') {
      siteScores.set(c.id, result.score);
    }
  });
  const siteScore = siteCriteria.length > 0 
    ? calculateWeightedScore(siteScores, siteCriteria) 
    : null;
  
  // Calculate category scores
  const categoryCriteria = groupByCategory(productionCriteria);
  const categories: CategoryScore[] = [];
  
  for (const [category, catCriteria] of Object.entries(categoryCriteria)) {
    const categoryScores = new Map<string, number>();
    const checksPresent: Array<{
      id: string;
      label: string;
      score: number;
      status: string;
      weight: number;
    }> = [];
    
    for (const criterion of catCriteria) {
      const result = resultsMap.get(criterion.id);
      if (result && result.status !== 'not_applicable' && result.status !== 'error') {
        categoryScores.set(criterion.id, result.score);
        checksPresent.push({
          id: criterion.id,
          label: criterion.label,
          score: result.score,
          status: result.status,
          weight: criterion.weight
        });
      }
    }
    
    if (categoryScores.size > 0) {
      const score = calculateWeightedScore(categoryScores, catCriteria);
      categories.push({
        category,
        score,
        status: scoreToStatus(score),
        checksPresent: checksPresent.length,
        checksTotal: catCriteria.length,
        checks: checksPresent
      });
    } else {
      // Category not applicable (no checks present)
      categories.push({
        category,
        score: 0,
        status: 'not_applicable',
        checksPresent: 0,
        checksTotal: catCriteria.length,
        checks: []
      });
    }
  }
  
  // Calculate overall score (weighted average of categories with results)
  const applicableCategories = categories.filter(c => c.status !== 'not_applicable');
  const overall = applicableCategories.length > 0
    ? Math.round(
        applicableCategories.reduce((sum, c) => sum + c.score, 0) / applicableCategories.length
      )
    : 0;
  
  return {
    overall,
    overallStatus: scoreToStatus(overall),
    categories: categories.sort((a, b) => b.score - a.score),
    pageScore,
    siteScore,
    stats: {
      totalChecks: productionCriteria.length,
      checksRun: checkResults.filter(r => 
        r.status !== 'not_applicable' && r.status !== 'error'
      ).length,
      productionChecks: productionCriteria.length,
      previewChecks: criteria.length - productionCriteria.length
    }
  };
}

/**
 * Convert score to status
 */
function scoreToStatus(score: number): 'ok' | 'warn' | 'fail' {
  if (score >= 85) return 'ok';
  if (score >= 60) return 'warn';
  return 'fail';
}

/**
 * Calculate category-level scores from page results
 * Used when you have per-page check results and want to aggregate by category
 */
export function aggregatePageResultsByCategory(
  pageResults: Array<{ pageId: string; checks: CheckResult[] }>,
  criteria: ScoringCriterion[]
): Record<string, CategoryScore> {
  const categoryCriteria = groupByCategory(criteria.filter(c => !c.preview && c.scope === 'page'));
  const categoryScores: Record<string, CategoryScore> = {};
  
  for (const [category, catCriteria] of Object.entries(categoryCriteria)) {
    const allScores: number[] = [];
    const checksMap = new Map<string, { score: number; count: number }>();
    
    // Aggregate scores across all pages
    for (const page of pageResults) {
      for (const check of page.checks) {
        const criterion = catCriteria.find(c => c.id === check.id);
        if (criterion && check.status !== 'not_applicable' && check.status !== 'error') {
          const existing = checksMap.get(check.id) || { score: 0, count: 0 };
          checksMap.set(check.id, {
            score: existing.score + check.score,
            count: existing.count + 1
          });
          allScores.push(check.score);
        }
      }
    }
    
    // Calculate averages
    const checks = Array.from(checksMap.entries()).map(([id, data]) => {
      const criterion = catCriteria.find(c => c.id === id)!;
      const avgScore = Math.round(data.score / data.count);
      return {
        id,
        label: criterion.label,
        score: avgScore,
        status: scoreToStatus(avgScore),
        weight: criterion.weight
      };
    });
    
    const categoryScore = checks.length > 0
      ? Math.round(checks.reduce((sum, c) => sum + c.score * c.weight, 0) / checks.reduce((sum, c) => sum + c.weight, 0))
      : 0;
    
    categoryScores[category] = {
      category,
      score: categoryScore,
      status: checks.length > 0 ? scoreToStatus(categoryScore) : 'not_applicable',
      checksPresent: checks.length,
      checksTotal: catCriteria.length,
      checks
    };
  }
  
  return categoryScores;
}

