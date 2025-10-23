/**
 * Score Guide - D1-Powered
 * 
 * Business view: 6 practical categories
 * Technical view: Flat list by ID with weights
 * 
 * Data source: D1 scoring_criteria table (synced via sync-d1-to-score-guide.ts)
 */

import { useViewMode } from '../../store/viewMode';
import { 
  ALL_CRITERIA, 
  CATEGORY_ORDER, 
  CRITERIA_BY_CATEGORY, 
  CATEGORY_DESCRIPTIONS, 
  CATEGORY_EMOJIS,
  type Category
} from '../../content/criteriaV3';
import ViewToggle from '../../components/ViewToggle';
import CategorySection from '../../components/ScoreGuide/CategorySection';
import CriteriaCard from '../../components/ScoreGuide/CriteriaCard';

// Calculate stats from ALL_CRITERIA
const STATS = {
  total: ALL_CRITERIA.length,
  production: ALL_CRITERIA.filter(c => !c.preview).length,
  preview: ALL_CRITERIA.filter(c => c.preview).length,
  page: ALL_CRITERIA.filter(c => c.scope === 'page').length,
  site: ALL_CRITERIA.filter(c => c.scope === 'site').length,
};

export default function ScoreGuide() {
  const { mode } = useViewMode();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <header className="mb-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Optiview Score Guide
              </h1>
              <p className="text-lg text-gray-600">
                {STATS.total} checks ({STATS.page} page-level + {STATS.site} site-level) that determine how assistants discover, understand, and cite your content
              </p>
            </div>
            <ViewToggle />
          </div>

          {/* Explainer */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <p className="text-gray-700 leading-relaxed mb-4">
              {mode === 'business' ? (
                <>
                  This guide organizes our {STATS.total} checks into <strong>6 practical categories</strong> that 
                  map to business outcomes. Each check includes its ID, impact level, and plain-language explanation 
                  of why it matters for AI visibility.
                </>
              ) : (
                <>
                  Technical view shows all checks sorted by ID with detection weights and implementation 
                  notes. {STATS.preview > 0 && `${STATS.preview} checks marked "Preview" are in shadow mode and don't yet affect composite scores.`}
                </>
              )}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-4 border-t border-gray-100">
              <div>
                <div className="text-2xl font-bold text-blue-600">{STATS.production}</div>
                <div className="text-gray-600">Production Ready</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">{STATS.preview}</div>
                <div className="text-gray-600">In Preview</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{STATS.page}</div>
                <div className="text-gray-600">Page-Level</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{STATS.site}</div>
                <div className="text-gray-600">Site-Level</div>
              </div>
            </div>
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
                icon={CATEGORY_EMOJIS[category]}
                description={CATEGORY_DESCRIPTIONS[category]}
                criteria={CRITERIA_BY_CATEGORY[category] || []}
              />
            ))}
          </div>
        ) : (
          // Technical View: Flat List by ID
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              All Criteria (Technical)
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {ALL_CRITERIA.sort((a, b) => a.id.localeCompare(b.id)).map((criterion) => (
                <CriteriaCard key={criterion.id} criterion={criterion} />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200">
          <div className="text-sm text-gray-500 space-y-2">
            <p>
              <strong>Check Types:</strong> {' '}
              <span className="inline-flex items-center gap-1">
                <span className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">html_dom</span> (deterministic HTML analysis), {' '}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="font-mono text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">llm</span> (AI-assisted), {' '}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="font-mono text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">aggregate</span> (site-level rollups), {' '}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="font-mono text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">http</span> (robots/sitemap validation)
              </span>
            </p>
            <p>
              <strong>Impact Levels:</strong> {' '}
              <span className="text-red-600">High</span>, {' '}
              <span className="text-amber-600">Medium</span>, {' '}
              <span className="text-green-600">Low</span> {' '}
              indicate priority for fixing failures.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
