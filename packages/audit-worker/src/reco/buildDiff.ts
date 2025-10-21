/**
 * Recommendation Diff Builder
 * 
 * Compares uncited page to cited winner and generates actionable recommendations
 */

import { CRITERIA_BY_ID } from '../scoring/criteria';

export interface RecommendationDiff {
  criterion: string;
  action: string;
  priority: 'High' | 'Medium' | 'Low';
  delta: number;  // Score difference (winner - target)
}

export interface Recommendations {
  diffs: RecommendationDiff[];
}

// Criteria to compare for recommendations
const COMPARISON_CRITERIA = ['A1', 'A3', 'A5', 'A11', 'A12', 'G10', 'G11', 'G12'];

// Action templates per criterion
const ACTION_TEMPLATES: Record<string, (delta: number) => string> = {
  A1: () => 'Add a concise, answer-first summary in the first paragraph to improve snippet inclusion.',
  A3: () => 'Add visible author byline with credentials to establish expertise.',
  A5: () => 'Add or enhance JSON-LD structured data (Article, FAQPage, or relevant schema types).',
  A11: () => 'Ensure key content is present in static HTML (not JavaScript-dependent) for crawler visibility.',
  A12: () => 'Add FAQ schema or explicit Q&A blocks to improve snippetability.',
  G10: (delta) => `Add ${Math.ceil(delta * 3)} contextual internal links to related subtopics.`,
  G11: () => 'Connect this page to your entity graph with internal links from hub pages.',
  G12: () => 'Expand topic coverage with related terms, examples, and supporting evidence.'
};

/**
 * Build recommendations by comparing target page to winner
 */
export function buildRecommendations(
  targetChecks: Record<string, number>,
  winnerChecks: Record<string, number>,
  targetMetadata: any,
  winnerMetadata: any
): Recommendations {
  const diffs: RecommendationDiff[] = [];

  for (const criterionId of COMPARISON_CRITERIA) {
    const targetScore = targetChecks[criterionId] || 0;
    const winnerScore = winnerChecks[criterionId] || 0;
    const delta = winnerScore - targetScore;

    // Only recommend if winner is significantly better (delta >= 1 on 0-3 scale)
    if (delta < 1) continue;

    const criterion = CRITERIA_BY_ID.get(criterionId);
    if (!criterion) continue;

    const actionTemplate = ACTION_TEMPLATES[criterionId];
    if (!actionTemplate) continue;

    diffs.push({
      criterion: criterionId,
      action: actionTemplate(delta),
      priority: criterion.impact,
      delta
    });
  }

  // Sort by priority (High > Medium > Low) and delta (larger first)
  const priorityOrder = { High: 3, Medium: 2, Low: 1 };
  diffs.sort((a, b) => {
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.delta - a.delta;
  });

  // Limit to top 5 recommendations
  return {
    diffs: diffs.slice(0, 5)
  };
}

/**
 * Format recommendations for display
 */
export function formatRecommendations(recommendations: Recommendations): string[] {
  return recommendations.diffs.map(diff => {
    const criterion = CRITERIA_BY_ID.get(diff.criterion);
    const title = criterion?.title || diff.criterion;
    return `[${diff.criterion}] ${title}: ${diff.action}`;
  });
}

