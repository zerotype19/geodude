/**
 * Score Guide - D1-Powered
 * 
 * Displays all 36 diagnostic checks organized into 6 practical categories
 * 
 * Data source: D1 scoring_criteria table (synced via sync-d1-to-score-guide.ts)
 */

import { 
  ALL_CRITERIA, 
  CATEGORY_ORDER, 
  CRITERIA_BY_CATEGORY, 
  CATEGORY_DESCRIPTIONS, 
  CATEGORY_EMOJIS,
  type Category
} from '../../content/criteriaV3';
import CategorySection from '../../components/ScoreGuide/CategorySection';

// Calculate stats from ALL_CRITERIA
const STATS = {
  total: ALL_CRITERIA.length,
  production: ALL_CRITERIA.filter(c => !c.preview).length,
  preview: ALL_CRITERIA.filter(c => c.preview).length,
  page: ALL_CRITERIA.filter(c => c.scope === 'page').length,
  site: ALL_CRITERIA.filter(c => c.scope === 'site').length,
};

export default function ScoreGuide() {
  return (
    <div className="min-h-screen bg-surface-2">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-brand via-brand/90 to-brand/80 text-white">
        <div className="page-max container-px py-12">
          <div className="mb-8">
            <h1 className="text-5xl font-bold mb-3 text-white">
              Optiview Score Guide
            </h1>
            <p className="text-xl text-white max-w-3xl">
              {STATS.total} diagnostic checks that determine how AI assistants discover, understand, and cite your content
            </p>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
              <div className="text-3xl font-bold text-white">{STATS.total}</div>
              <div className="text-sm text-white">Total Checks</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
              <div className="text-3xl font-bold text-white">{STATS.page}</div>
              <div className="text-sm text-white">Page-Level</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
              <div className="text-3xl font-bold text-white">{STATS.site}</div>
              <div className="text-sm text-white">Site-Level</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
              <div className="text-3xl font-bold text-white">6</div>
              <div className="text-sm text-white">Categories</div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-max container-px py-8">
        {/* How It Works Section */}
        <section className="mb-12">
          <div className="card card-body bg-gradient-to-br from-brand/5 via-surface-1 to-surface-1 border-brand/20 mb-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 p-3 bg-brand/10 rounded-xl">
                <svg className="w-8 h-8 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4M12 8h.01"/>
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-3">How Optiview Scoring Works</h2>
                <p className="text-lg text-ink-muted leading-relaxed">
                  Comprehensive AI visibility assessment across 36 diagnostic criteria, combining deterministic HTML analysis, 
                  AI-assisted evaluation, and real-world citation testing
                </p>
              </div>
            </div>

            {/* Two Main Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* What We Look For Card */}
              <div className="bg-white rounded-xl border-2 border-border p-6 hover:border-brand/50 hover:shadow-xl transition-all">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-brand/10 rounded-lg">
                    <svg className="w-6 h-6 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.35-4.35"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold">What We Look For</h3>
                </div>
                <div className="space-y-5">
                  <div className="pl-4 border-l-3 border-brand/30 hover:border-brand transition-colors">
                    <p className="font-semibold text-base mb-1.5">Technical Foundation</p>
                    <p className="text-sm text-ink-muted leading-relaxed">Schema markup, meta tags, canonical URLs, mobile optimization</p>
                  </div>
                  <div className="pl-4 border-l-3 border-brand/30 hover:border-brand transition-colors">
                    <p className="font-semibold text-base mb-1.5">Content Quality</p>
                    <p className="text-sm text-ink-muted leading-relaxed">Answer-first structure, FAQ presence, semantic headings, clarity</p>
                  </div>
                  <div className="pl-4 border-l-3 border-brand/30 hover:border-brand transition-colors">
                    <p className="font-semibold text-base mb-1.5">Semantic Structure</p>
                    <p className="text-sm text-ink-muted leading-relaxed">Entity graphs, structured data, internal linking, breadcrumbs</p>
                  </div>
                  <div className="pl-4 border-l-3 border-brand/30 hover:border-brand transition-colors">
                    <p className="font-semibold text-base mb-1.5">Crawl Access</p>
                    <p className="text-sm text-ink-muted leading-relaxed">Robots policies, sitemap coverage, render visibility, AI crawler access</p>
                  </div>
                  <div className="pl-4 border-l-3 border-brand/30 hover:border-brand transition-colors">
                    <p className="font-semibold text-base mb-1.5">Authority Signals</p>
                    <p className="text-sm text-ink-muted leading-relaxed">Author attribution, dates, citations, external references</p>
                  </div>
                  <div className="pl-4 border-l-3 border-brand/30 hover:border-brand transition-colors">
                    <p className="font-semibold text-base mb-1.5">Real Citations</p>
                    <p className="text-sm text-ink-muted leading-relaxed">Actual appearance in ChatGPT, Claude, and Perplexity responses</p>
                  </div>
                </div>
              </div>

              {/* Scoring Methodology Card */}
              <div className="bg-white rounded-xl border-2 border-border p-6 hover:border-brand/50 hover:shadow-xl transition-all">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-brand/10 rounded-lg">
                    <svg className="w-6 h-6 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M3 3v18h18"/>
                      <path d="M18 17V9M12 17v-4M6 17v-2"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold">Scoring Methodology</h3>
                </div>
                <div className="space-y-5">
                  <div className="pl-4 border-l-3 border-brand/30 hover:border-brand transition-colors">
                    <p className="font-semibold text-base mb-1.5">Page-Level Checks ({STATS.page})</p>
                    <p className="text-sm text-ink-muted leading-relaxed">Run on every page analyzed, measuring content quality, structure, and technical implementation</p>
                  </div>
                  <div className="pl-4 border-l-3 border-brand/30 hover:border-brand transition-colors">
                    <p className="font-semibold text-base mb-1.5">Site-Level Checks ({STATS.site})</p>
                    <p className="text-sm text-ink-muted leading-relaxed">Evaluate overall site properties like FAQ coverage, entity graph completeness, and crawl policies</p>
                  </div>
                  <div className="pl-4 border-l-3 border-brand/30 hover:border-brand transition-colors">
                    <p className="font-semibold text-base mb-1.5">Weighted Scores</p>
                    <p className="text-sm text-ink-muted leading-relaxed">Each check has an impact weight (1-15) reflecting its importance for AI visibility</p>
                  </div>
                  <div className="pl-4 border-l-3 border-brand/30 hover:border-brand transition-colors">
                    <p className="font-semibold text-base mb-1.5">Composite Score</p>
                    <p className="text-sm text-ink-muted leading-relaxed">Overall score combines page and site checks, weighted by impact and normalized to 0-100</p>
                  </div>
                  <div className="pl-4 border-l-3 border-brand/30 hover:border-brand transition-colors">
                    <p className="font-semibold text-base mb-1.5">Category Scores</p>
                    <p className="text-sm text-ink-muted leading-relaxed">Grouped into 6 actionable categories for easier prioritization</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Executive Summary Card */}
            <div className="bg-white rounded-xl border-2 border-brand/30 p-6 hover:shadow-xl transition-all">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-brand/10 rounded-lg">
                  <svg className="w-6 h-6 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Executive Summary Reports</h3>
                  <p className="text-sm text-ink-muted">Comprehensive PDF-exportable reports with all findings</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 text-sm mb-5">
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-success/5 border border-success/20">
                  <svg className="w-4 h-4 text-success mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="leading-relaxed">Cover page with overall score and citation rate</span>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-success/5 border border-success/20">
                  <svg className="w-4 h-4 text-success mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="leading-relaxed">Category breakdown with strengths and opportunities</span>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-success/5 border border-success/20">
                  <svg className="w-4 h-4 text-success mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="leading-relaxed">Priority fixes ranked by weighted impact</span>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-success/5 border border-success/20">
                  <svg className="w-4 h-4 text-success mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="leading-relaxed">Site-level diagnostics with status indicators</span>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-success/5 border border-success/20">
                  <svg className="w-4 h-4 text-success mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="leading-relaxed">Successful citation examples</span>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-success/5 border border-success/20">
                  <svg className="w-4 h-4 text-success mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="leading-relaxed">Missed opportunities analysis</span>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-success/5 border border-success/20">
                  <svg className="w-4 h-4 text-success mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="leading-relaxed">Page-level insights and quick wins</span>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-success/5 border border-success/20">
                  <svg className="w-4 h-4 text-success mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="leading-relaxed">One-click PDF export</span>
                </div>
              </div>
              <div className="pt-5 border-t border-border">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-brand/5 border border-brand/20">
                  <svg className="w-5 h-5 text-brand mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                  <p className="text-sm text-ink-muted leading-relaxed">
                    <strong className="text-ink">Industry-Specific Testing:</strong> Citation queries are tailored to your industry using 200+ taxonomies, 
                    ensuring relevant, realistic prompts that reflect how users actually search for information in your space.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Category Quick Navigation */}
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

        {/* Content */}
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
