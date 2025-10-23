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
    <div className="min-h-screen bg-surface-2">
      <div className="page-max container-px py-8">
        {/* Header */}
        <header className="mb-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Optiview Score Guide
              </h1>
              <p className="text-lg muted">
                {STATS.total} checks ({STATS.page} page-level + {STATS.site} site-level) that determine how assistants discover, understand, and cite your content
              </p>
            </div>
            <ViewToggle />
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
            <h2 className="text-2xl font-bold mb-6">
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
        <footer className="mt-16 pt-8 border-t border-border">
          <div className="text-sm subtle space-y-2">
            <p>
              <strong>Check Types:</strong> {' '}
              <span className="inline-flex items-center gap-1">
                <span className="pill pill-brand">html_dom</span> (deterministic HTML analysis), {' '}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="pill pill-brand">llm</span> (AI-assisted), {' '}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="pill pill-success">aggregate</span> (site-level rollups), {' '}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="pill pill-warn">http</span> (robots/sitemap validation)
              </span>
            </p>
            <p>
              <strong>Impact Levels:</strong> {' '}
              <span className="text-danger">High</span>, {' '}
              <span className="text-warn">Medium</span>, {' '}
              <span className="text-success">Low</span> {' '}
              indicate priority for fixing failures.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
