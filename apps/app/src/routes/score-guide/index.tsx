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
              <div>
                <h3 className="text-lg font-semibold mb-2">🔍 What We Look For</h3>
                <ul className="space-y-2 text-sm muted">
                  <li><strong>Technical Foundation:</strong> Schema markup, meta tags, canonical URLs, mobile optimization</li>
                  <li><strong>Content Quality:</strong> Answer-first structure, FAQ presence, semantic headings, clarity</li>
                  <li><strong>Semantic Structure:</strong> Entity graphs, structured data, internal linking, breadcrumbs</li>
                  <li><strong>Crawl Access:</strong> Robots policies, sitemap coverage, render visibility, AI crawler access</li>
                  <li><strong>Authority Signals:</strong> Author attribution, dates, citations, external references</li>
                  <li><strong>Real Citations:</strong> Actual appearance in ChatGPT, Claude, and Perplexity responses</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">📊 Scoring Methodology</h3>
                <ul className="space-y-2 text-sm muted">
                  <li><strong>Page-Level Checks ({STATS.page}):</strong> Run on every page analyzed, measuring content quality, structure, and technical implementation</li>
                  <li><strong>Site-Level Checks ({STATS.site}):</strong> Evaluate overall site properties like FAQ coverage, entity graph completeness, and crawl policies</li>
                  <li><strong>Weighted Scores:</strong> Each check has an impact weight (1-15) reflecting its importance for AI visibility</li>
                  <li><strong>Composite Score:</strong> Overall score combines page and site checks, weighted by impact and normalized to 0-100</li>
                  <li><strong>Category Scores:</strong> Grouped into 6 actionable categories for easier prioritization</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">📄 Executive Summary Reports</h3>
              <p className="text-sm muted leading-relaxed">
                Every audit generates a comprehensive <strong>executive summary report</strong> that includes:
              </p>
              <ul className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm muted mt-2">
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
