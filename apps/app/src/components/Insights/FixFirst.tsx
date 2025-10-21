/**
 * Fix First Priority List
 * 
 * Shows top failing high-impact criteria across all pages
 */

import { CRITERIA_BY_ID } from '../../content/criteriaV2';
import PreviewBadge from '../PreviewBadge';

interface PageData {
  id: number;
  url: string;
  is_cited: boolean;
  scores?: {
    criteria?: Record<string, number>;
  };
}

interface FixFirstProps {
  pages: PageData[];
  onFilterClick?: (criterionId: string) => void;
}

interface FailureSummary {
  criterionId: string;
  title: string;
  impact: string;
  weight: number;
  failureCount: number;
  uncitedFailures: number;
  preview: boolean;
}

export default function FixFirst({ pages, onFilterClick }: FixFirstProps) {
  // Aggregate failures
  const failures = new Map<string, FailureSummary>();

  for (const page of pages) {
    if (!page.scores?.criteria) continue;

    for (const [criterionId, score] of Object.entries(page.scores.criteria)) {
      // Only track failures (score < 3 on 0-3 scale, or < 75% on 0-100 scale)
      const isFailing = score < 2; // Adjust threshold as needed
      
      if (!isFailing) continue;

      const criterion = CRITERIA_BY_ID.get(criterionId);
      if (!criterion || criterion.impact !== 'High') continue;

      if (!failures.has(criterionId)) {
        failures.set(criterionId, {
          criterionId,
          title: criterion.title,
          impact: criterion.impact,
          weight: criterion.weight,
          failureCount: 0,
          uncitedFailures: 0,
          preview: criterion.preview || false
        });
      }

      const summary = failures.get(criterionId)!;
      summary.failureCount++;
      if (!page.is_cited) {
        summary.uncitedFailures++;
      }
    }
  }

  // Sort by priority
  const sortedFailures = Array.from(failures.values()).sort((a, b) => {
    // Prioritize uncited failures
    if (a.uncitedFailures !== b.uncitedFailures) {
      return b.uncitedFailures - a.uncitedFailures;
    }
    // Then by total failure count
    if (a.failureCount !== b.failureCount) {
      return b.failureCount - a.failureCount;
    }
    // Then by weight
    return b.weight - a.weight;
  }).slice(0, 5);

  if (sortedFailures.length === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">✨</span>
          <div>
            <h3 className="font-semibold text-green-900 dark:text-green-300">
              All high-impact checks passing!
            </h3>
            <p className="text-sm text-green-700 dark:text-green-400">
              Your content is well-optimized for AI visibility.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          🎯 Fix First
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Top {sortedFailures.length} priorities
        </span>
      </div>

      <div className="space-y-3">
        {sortedFailures.map((failure, idx) => (
          <button
            key={failure.criterionId}
            onClick={() => onFilterClick?.(failure.criterionId)}
            className="w-full text-left p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-gray-400 dark:text-gray-500">
                    {idx + 1}.
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {failure.title}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                    {failure.criterionId}
                  </span>
                  {failure.preview && <PreviewBadge />}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {failure.failureCount} page{failure.failureCount !== 1 ? 's' : ''} failing
                  {failure.uncitedFailures > 0 && (
                    <span className="text-orange-600 dark:text-orange-400 font-medium">
                      {' '}• {failure.uncitedFailures} uncited
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Weight: {failure.weight}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          💡 Tip: Click an item to filter the pages table to show only failing pages for that check.
        </p>
      </div>
    </div>
  );
}

