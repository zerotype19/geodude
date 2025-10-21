/**
 * Score Guide - Rewritten for Phase Next
 * 
 * Business view: 6 practical categories
 * Technical view: Flat list by ID with weights
 */

import { useViewMode } from '../../store/viewMode';
import { CRITERIA, CATEGORY_ORDER, CRITERIA_BY_CATEGORY, CATEGORY_DESCRIPTIONS, CATEGORY_ICONS } from '../../content/criteriaV2';
import ViewToggle from '../../components/ViewToggle';
import CategorySection from '../../components/ScoreGuide/CategorySection';
import CriteriaCard from '../../components/ScoreGuide/CriteriaCard';

export default function ScoreGuide() {
  const { mode } = useViewMode();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <header className="mb-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                Optiview Score Guide
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                21 checks that determine how assistants discover, understand, and cite your content
              </p>
            </div>
            <ViewToggle />
          </div>

          {/* Explainer */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {mode === 'business' ? (
                <>
                  This guide organizes our 21 AEO/GEO checks into <strong>6 practical categories</strong> that 
                  map to business outcomes. Each check includes its technical ID (e.g., A1), impact level, 
                  and plain-language explanation of why it matters for AI visibility.
                </>
              ) : (
                <>
                  Technical view shows all checks sorted by ID with detection weights and implementation 
                  notes. Checks marked "Preview" are in shadow mode and don't yet affect composite scores.
                </>
              )}
            </p>
          </div>
        </header>

        {/* Content */}
        {mode === 'business' ? (
          // Business View: Category Sections
          <div className="space-y-16">
            {CATEGORY_ORDER.map((category) => (
              <CategorySection
                key={category}
                title={category}
                icon={CATEGORY_ICONS[category]}
                description={CATEGORY_DESCRIPTIONS[category]}
                criteria={CRITERIA_BY_CATEGORY[category] || []}
              />
            ))}
          </div>
        ) : (
          // Technical View: Flat List by ID
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              All Criteria (Technical)
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {CRITERIA.sort((a, b) => a.id.localeCompare(b.id)).map((criterion) => (
                <CriteriaCard key={criterion.id} criterion={criterion} />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
            <p>
              <strong>Weights:</strong> Each check has a weight (W4-W15) that determines its contribution 
              to the composite AEO/GEO scores.
            </p>
            <p>
              <strong>Impact Levels:</strong> High (red), Medium (yellow), Low (green) indicate priority 
              for fixing failures.
            </p>
            <p>
              <strong>Preview Checks:</strong> New checks (A12, C1, G11, G12) are computed but don't 
              affect scores until promoted from shadow mode.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
