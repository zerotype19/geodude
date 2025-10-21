/**
 * Category-based scoring helper for Scorecard 2.0
 * Computes roll-up scores by category from individual check results
 */

export type CheckCategory = 
  | 'Content & Clarity'
  | 'Structure & Organization'
  | 'Authority & Trust'
  | 'Technical Foundations'
  | 'Crawl & Discoverability'
  | 'Experience & Performance';

// Map check IDs to categories (matches frontend checksV2.ts)
const CHECK_TO_CATEGORY: Record<string, CheckCategory> = {
  // Content & Clarity
  'A1': 'Content & Clarity',
  'G1': 'Content & Clarity',
  'G5': 'Content & Clarity',
  'A10': 'Content & Clarity',
  'A9': 'Content & Clarity',
  
  // Structure & Organization
  'A2': 'Structure & Organization',
  'G6': 'Structure & Organization',
  'G10': 'Structure & Organization',
  
  // Authority & Trust
  'A3': 'Authority & Trust',
  'G2': 'Authority & Trust',
  'G3': 'Authority & Trust',
  'A4': 'Authority & Trust',
  'G7': 'Authority & Trust',
  'G9': 'Authority & Trust',
  
  // Technical Foundations
  'A5': 'Technical Foundations',
  'G8': 'Technical Foundations',
  
  // Crawl & Discoverability
  'A6': 'Crawl & Discoverability',
  'A8': 'Crawl & Discoverability',
  'A11': 'Crawl & Discoverability',
  'G4': 'Crawl & Discoverability',
  
  // Experience & Performance
  'A7': 'Experience & Performance'
};

export interface CategoryScore {
  category: CheckCategory;
  score: number;        // 0-100
  weight_total: number; // Sum of weights in category
  checks_count: number; // Number of checks in category
}

export interface CheckResult {
  id: string;           // e.g., "A1"
  score: number;        // 0-3
  weight: number;       // e.g., 15
}

/**
 * Compute category roll-up scores from individual check results
 * Uses weighted average within each category
 */
export function computeCategoryScores(items: CheckResult[]): CategoryScore[] {
  const categoryMap = new Map<CheckCategory, {
    weighted: number;
    total_weight: number;
    count: number;
  }>();
  
  // Accumulate weighted scores by category
  for (const item of items) {
    const category = CHECK_TO_CATEGORY[item.id];
    if (!category) continue; // Skip unknown checks
    
    const bucket = categoryMap.get(category) ?? { 
      weighted: 0, 
      total_weight: 0, 
      count: 0 
    };
    
    // Weighted contribution: score (0-3) * weight (e.g., 15)
    bucket.weighted += item.score * item.weight;
    bucket.total_weight += item.weight;
    bucket.count += 1;
    
    categoryMap.set(category, bucket);
  }
  
  // Convert to percentage scores (0-100)
  const results: CategoryScore[] = [];
  
  for (const [category, data] of categoryMap.entries()) {
    // Score = (weighted sum / total weight) / 3 * 100
    // Divide by 3 because max score per check is 3
    const score = data.total_weight > 0
      ? Math.round((data.weighted / data.total_weight / 3) * 100)
      : 0;
    
    results.push({
      category,
      score,
      weight_total: data.total_weight,
      checks_count: data.count
    });
  }
  
  // Sort by category importance (order matches frontend)
  const categoryOrder: CheckCategory[] = [
    'Content & Clarity',
    'Structure & Organization',
    'Authority & Trust',
    'Technical Foundations',
    'Crawl & Discoverability',
    'Experience & Performance'
  ];
  
  results.sort((a, b) => {
    const indexA = categoryOrder.indexOf(a.category);
    const indexB = categoryOrder.indexOf(b.category);
    return indexA - indexB;
  });
  
  return results;
}

/**
 * Get category for a specific check ID
 */
export function getCategoryForCheck(checkId: string): CheckCategory | undefined {
  return CHECK_TO_CATEGORY[checkId];
}

/**
 * Get all checks in a category
 */
export function getChecksInCategory(category: CheckCategory): string[] {
  return Object.entries(CHECK_TO_CATEGORY)
    .filter(([_, cat]) => cat === category)
    .map(([id, _]) => id);
}

/**
 * Priority fix item for "Fix First" list
 */
export interface FixFirst {
  id: string;
  name: string;
  category: string;
  impact_level: 'High' | 'Medium' | 'Low';
  weight: number;
  score: number;
}

/**
 * Get top priority fixes for "Fix First" list
 * Returns 3-5 failed checks sorted by impact level, then weight
 */
export function computeTopFixes(
  criteria: Array<{
    id: string;
    name?: string;
    score: number;
    weight: number;
    impact_level?: 'High' | 'Medium' | 'Low';
  }>,
  limit: number = 5
): FixFirst[] {
  const impactWeight = { High: 3, Medium: 2, Low: 1 };
  
  return criteria
    .filter(c => c.score < 3) // Failed checks only
    .map(c => {
      const category = CHECK_TO_CATEGORY[c.id];
      const impact = c.impact_level || 'Medium';
      
      return {
        id: c.id,
        name: c.name || c.id,
        category: category || 'Uncategorized',
        impact_level: impact,
        weight: c.weight,
        score: c.score
      };
    })
    .sort((a, b) => {
      // First sort by impact level (High > Medium > Low)
      const impactDiff = impactWeight[b.impact_level] - impactWeight[a.impact_level];
      if (impactDiff !== 0) return impactDiff;
      
      // Then by weight (higher weight first)
      return b.weight - a.weight;
    })
    .slice(0, limit);
}

