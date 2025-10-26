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
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-brand via-brand/90 to-brand/80 text-white">
        <div className="page-max container-px py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-5xl font-bold mb-3">
                Optiview Score Guide
              </h1>
              <p className="text-xl opacity-95 max-w-3xl">
                {STATS.total} diagnostic checks that determine how AI assistants discover, understand, and cite your content
              </p>
            </div>
            <ViewToggle />
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
              <div className="text-3xl font-bold">{STATS.total}</div>
              <div className="text-sm opacity-90">Total Checks</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
              <div className="text-3xl font-bold">{STATS.page}</div>
              <div className="text-sm opacity-90">Page-Level</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
              <div className="text-3xl font-bold">{STATS.site}</div>
              <div className="text-sm opacity-90">Site-Level</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
              <div className="text-3xl font-bold">6</div>
              <div className="text-sm opacity-90">Categories</div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-max container-px py-8">
        {/* Methodology Overview */}
        <header className="mb-12">

          {/* Methodology Overview */}
          <div className="card card-body space-y-6 mt-8">
            <div>
              <h2 className="text-2xl font-bold mb-3">How Optiview Scoring Works</h2>
              <p className="text-base muted leading-relaxed">
                Optiview provides a comprehensive assessment of your AI visibility across 36 diagnostic criteria organized into 6 practical categories. 
                Our scoring system combines deterministic HTML analysis, AI-assisted evaluation, site-level aggregates, and real-world citation testing 
                to give you a complete picture of how LLMs discover, understand, and reference your content.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-surface-1 p-6 rounded-xl border border-border">
                <div className="flex items-start gap-3 mb-3">
                  <svg className="w-6 h-6 text-brand flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                  <h3 className="text-lg font-semibold">What We Look For</h3>
                </div>
                <ul className="space-y-2 text-sm muted">
                  <li><strong>Technical Foundation:</strong> Schema markup, meta tags, canonical URLs, mobile optimization</li>
                  <li><strong>Content Quality:</strong> Answer-first structure, FAQ presence, semantic headings, clarity</li>
                  <li><strong>Semantic Structure:</strong> Entity graphs, structured data, internal linking, breadcrumbs</li>
                  <li><strong>Crawl Access:</strong> Robots policies, sitemap coverage, render visibility, AI crawler access</li>
                  <li><strong>Authority Signals:</strong> Author attribution, dates, citations, external references</li>
                  <li><strong>Real Citations:</strong> Actual appearance in ChatGPT, Claude, and Perplexity responses</li>
                </ul>
              </div>

              <div className="bg-surface-1 p-6 rounded-xl border border-border">
                <div className="flex items-start gap-3 mb-3">
                  <svg className="w-6 h-6 text-brand flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18"/>
                    <path d="M18 17V9M12 17v-4M6 17v-2"/>
                  </svg>
                  <h3 className="text-lg font-semibold">Scoring Methodology</h3>
                </div>
                <ul className="space-y-2 text-sm muted">
                  <li><strong>Page-Level Checks ({STATS.page}):</strong> Run on every page analyzed, measuring content quality, structure, and technical implementation</li>
                  <li><strong>Site-Level Checks ({STATS.site}):</strong> Evaluate overall site properties like FAQ coverage, entity graph completeness, and crawl policies</li>
                  <li><strong>Weighted Scores:</strong> Each check has an impact weight (1-15) reflecting its importance for AI visibility</li>
                  <li><strong>Composite Score:</strong> Overall score combines page and site checks, weighted by impact and normalized to 0-100</li>
                  <li><strong>Category Scores:</strong> Grouped into 6 actionable categories for easier prioritization</li>
                </ul>
              </div>
            </div>

            <div className="bg-gradient-to-br from-brand/5 to-brand/10 p-6 rounded-xl border border-brand/20">
              <div className="flex items-start gap-3 mb-3">
                <svg className="w-6 h-6 text-brand flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                <h3 className="text-lg font-semibold">Executive Summary Reports</h3>
              </div>
              <p className="text-sm muted leading-relaxed mb-3">
                Every audit generates a comprehensive <strong>executive summary report</strong> that includes:
              </p>
              <ul className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm muted">
                <li>• Cover page with overall score and citation rate</li>
                <li>• Category breakdown with strengths and opportunities</li>
                <li>• Priority fixes ranked by weighted impact</li>
                <li>• Site-level diagnostics with status indicators</li>
                <li>• Successful citation examples (queries where you appear)</li>
                <li>• Missed opportunities (queries where you don't appear)</li>
                <li>• Page-level insights and quick wins</li>
                <li>• One-click PDF export for stakeholder sharing</li>
              </ul>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-sm muted">
                <strong>Industry-Specific Testing:</strong> Citation queries are tailored to your industry using 200+ taxonomies, 
                ensuring relevant, realistic prompts that reflect how users actually search for information in your space.
              </p>
            </div>
          </div>

        </header>

        {/* Category Quick Navigation */}
        {mode === 'business' && (
          <nav className="card card-body mb-8">
            <h3 className="text-lg font-semibold mb-4">Jump to Category</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {CATEGORY_ORDER.map((category) => {
                const categoryId = category.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-');
                return (
                  <a
                    key={category}
                    href={`#${categoryId}`}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-brand hover:bg-brand/5 transition-all group"
                  >
                    <div className="w-2 h-2 rounded-full bg-brand group-hover:scale-125 transition-transform"></div>
                    <span className="text-sm font-medium group-hover:text-brand">{category}</span>
                  </a>
                );
              })}
            </div>
          </nav>
        )}

        {/* Content */}
        {mode === 'business' ? (
          // Business View: Category Sections
          <div>
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
