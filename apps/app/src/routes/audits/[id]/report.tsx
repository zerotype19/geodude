import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet } from '/src/lib/api';
import type { ReportData, CategoryDetail, PriorityFix, CitationAnalysis } from '/src/types/report';

export default function AuditReport() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchReport();
    }
  }, [id]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await apiGet<ReportData>(`/api/audits/${id}/report`);
      setReport(data);
    } catch (err: any) {
      console.error('Failed to fetch report:', err);
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-2 py-12">
        <div className="page-max container-px">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-surface-3 rounded w-1/3 mx-auto mb-8"></div>
              <div className="h-4 bg-surface-3 rounded w-1/2 mx-auto mb-4"></div>
              <div className="h-4 bg-surface-3 rounded w-2/3 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-surface-2 py-12">
        <div className="page-max container-px">
          <div className="card card-body text-center">
            <h1 className="text-2xl font-bold mb-4">Error Loading Report</h1>
            <p className="text-ink-muted mb-6">{error || 'Report not found'}</p>
            <Link to={`/audits/${id}`} className="btn-primary inline-block">
              Back to Audit
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-2 report-view">
      {/* Print-only styles + tighter spacing */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .report-view { background: white !important; }
          .page-max { max-width: 100% !important; padding: 1rem !important; }
          .card { page-break-inside: avoid; margin-bottom: 1rem !important; padding: 0.75rem !important; }
          .page-break { page-break-before: always; }
          h2 { font-size: 1.5rem !important; margin-bottom: 0.75rem !important; }
          h3 { font-size: 1.125rem !important; margin-bottom: 0.5rem !important; }
          .mb-12 { margin-bottom: 1.5rem !important; }
          .mb-6 { margin-bottom: 0.75rem !important; }
          .mb-4 { margin-bottom: 0.5rem !important; }
          .py-12 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
        }
        
        /* Tighter on screen too */
        .report-view .mb-12 { margin-bottom: 2rem; }
        .report-view .mb-6 { margin-bottom: 1rem; }
        .report-view h2 { font-size: 1.875rem; margin-bottom: 1rem; }
        .report-view h3 { font-size: 1.25rem; margin-bottom: 0.75rem; }
      `}</style>

      {/* Screen-only header */}
      <div className="no-print bg-surface-1 border-b border-border py-4">
        <div className="page-max container-px flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/audits/${id}`} className="text-ink-subtle hover:text-ink">
              ← Back to Audit
            </Link>
            <h1 className="text-xl font-semibold">Executive Summary</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={handlePrint} className="btn-primary">
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="page-max container-px py-12">
        {/* Cover Page */}
        <CoverPage report={report} />

        {/* Executive Summary */}
        <div className="page-break"></div>
        <ExecutiveSummary report={report} />

        {/* Category Breakdown */}
        <div className="page-break"></div>
        <CategoryBreakdown categories={report.categories} />

        {/* Priority Fixes */}
        <div className="page-break"></div>
        <PriorityFixes fixes={report.priorityFixes} />

        {/* Site-Level Diagnostics */}
        {report.siteDiagnostics && report.siteDiagnostics.length > 0 && (
          <>
            <div className="page-break"></div>
            <SiteDiagnostics diagnostics={report.siteDiagnostics} />
          </>
        )}

        {/* Citation Analysis */}
        {report.citations.total_queries > 0 && (
          <>
            <div className="page-break"></div>
            <CitationAnalysis citations={report.citations} />
          </>
        )}

        {/* Page Insights */}
        {report.topPages.length > 0 && (
          <>
            <div className="page-break"></div>
            <PageInsights topPages={report.topPages} quickWins={report.quickWins} />
          </>
        )}
      </div>
    </div>
  );
}

// Cover Page Component
function CoverPage({ report }: { report: ReportData }) {
  const date = new Date(report.audit.finished_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="card p-12 text-center mb-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-brand mb-2">OPTIVIEW AI VISIBILITY AUDIT</h1>
        <div className="h-1 w-32 bg-brand mx-auto rounded-full"></div>
      </div>

      <h2 className="text-3xl font-semibold text-ink mb-8">{report.audit.domain}</h2>

      <div className="space-y-2 text-ink-subtle mb-12">
        <p>{date}</p>
        <p>{report.audit.pages_analyzed} Pages Analyzed</p>
      </div>

      <div className="inline-block">
        <div className="text-7xl font-bold text-brand mb-2">
          {report.scores.overall}
        </div>
        <div className="text-xl text-ink-subtle">OPTIVIEW SCORE</div>
      </div>

      {report.citations.total_queries > 0 && (
        <div className="mt-8 pt-8 border-t border-border">
          <div className="text-4xl font-bold text-ink-muted mb-2">
            {report.citations.overall_rate}%
          </div>
          <div className="text-sm text-ink-subtle">AI CITATION RATE</div>
        </div>
      )}
    </div>
  );
}

// Executive Summary Component
function ExecutiveSummary({ report }: { report: ReportData }) {
  // Get top 3 strengths (highest scoring categories)
  const strengths = [...report.categories]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3);

  // Get top 3 opportunities (lowest scoring categories)
  const opportunities = [...report.categories]
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 3);

  return (
    <div className="mb-12">
      <h2 className="text-3xl font-bold mb-6">Executive Summary</h2>

      <div className="card card-body mb-6">
        <h3 className="text-xl font-semibold mb-4">Overview</h3>
        <p className="leading-relaxed text-ink-muted">
          This audit analyzed <strong>{report.audit.pages_analyzed} pages</strong> from{' '}
          <strong>{report.audit.domain}</strong> to evaluate its AI visibility and citation
          performance. The overall Optiview Score of <strong>{report.scores.overall}/100</strong>{' '}
          indicates {report.scores.overall >= 70 ? 'strong' : report.scores.overall >= 50 ? 'moderate' : 'limited'}{' '}
          optimization for AI-powered search and answer engines.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="card card-body">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="text-2xl"></span>
            Top Strengths
          </h3>
          <div className="space-y-3">
            {strengths.map((cat) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{cat.display_name}</span>
                  <span className="text-sm font-bold text-success">{cat.percentage}%</span>
                </div>
                <div className="text-sm text-ink-muted">
                  {cat.checks_passing}/{cat.checks_total} checks passing
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Opportunities */}
        <div className="card card-body">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="text-2xl">️</span>
            Key Opportunities
          </h3>
          <div className="space-y-3">
            {opportunities.map((cat) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{cat.display_name}</span>
                  <span className="text-sm font-bold text-warn">{cat.percentage}%</span>
                </div>
                <div className="text-sm text-ink-muted">
                  {cat.checks_total - cat.checks_passing} issues to address
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Citation Performance */}
      {report.citations.total_queries > 0 && (
        <div className="card card-body mt-6">
          <h3 className="text-lg font-semibold mb-4">Citation Performance Snapshot</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {report.citations.by_source.map((source) => (
              <div key={source.source} className="text-center">
                <div className="text-2xl font-bold mb-1">{source.rate}%</div>
                <div className="text-sm text-ink-subtle capitalize">{source.source}</div>
                <div className="text-xs text-ink-muted">
                  {source.cited}/{source.total} queries
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Category Breakdown Component
function CategoryBreakdown({ categories }: { categories: CategoryDetail[] }) {
  const getScoreColor = (percentage: number) => {
    if (percentage >= 70) return 'text-success';
    if (percentage >= 50) return 'text-warn';
    return 'text-danger';
  };

  const getScoreLabel = (percentage: number) => {
    if (percentage >= 70) return 'Strong';
    if (percentage >= 50) return 'Needs Improvement';
    return 'Critical';
  };

  return (
    <div className="mb-12">
      <h2 className="text-3xl font-bold mb-6">Category Score Breakdown</h2>

      <div className="space-y-6">
        {categories.map((cat) => (
          <div key={cat.category} className="card card-body">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold">{cat.display_name}</h3>
                <p className="text-sm text-ink-subtle mt-1">
                  {cat.checks_passing} of {cat.checks_total} checks passing
                </p>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${getScoreColor(cat.percentage)}`}>
                  {cat.percentage}%
                </div>
                <div className="text-sm text-ink-muted">{getScoreLabel(cat.percentage)}</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bar mb-4">
              <span 
                className={cat.percentage >= 70 ? 'bg-success' : cat.percentage >= 50 ? 'bg-warn' : 'bg-danger'}
                style={{ width: `${cat.percentage}%` }}
              ></span>
            </div>

            <div className="text-sm text-ink-muted">
              Impact Level: <span className="font-medium capitalize">{cat.impact_level}</span>
              {' • '}
              {cat.affected_pages} pages affected
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Priority Fixes Component
function PriorityFixes({ fixes }: { fixes: PriorityFix[] }) {
  const getSeverityBadge = (severity: string) => {
    const map = {
      high: 'pill-danger',
      medium: 'pill-warn',
      low: 'pill',
    };
    return map[severity as keyof typeof map] || 'pill';
  };

  return (
    <div className="mb-12">
      <h2 className="text-3xl font-bold mb-6">Priority Fixes</h2>
      <p className="text-ink-muted mb-6">
        Top issues ranked by weighted impact. Address these to maximize your AI visibility improvement.
      </p>

      <div className="space-y-6">
        {fixes.slice(0, 10).map((fix, index) => (
          <div key={fix.id} className="card card-body">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand text-brand-foreground flex items-center justify-center font-bold">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold">{fix.name}</h3>
                  <span className={`pill ${getSeverityBadge(fix.severity)} flex-shrink-0 ml-4`}>
                    {fix.severity.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-ink-subtle mb-3">
                  <span> {fix.category}</span>
                  <span> Weight: {fix.weight}</span>
                  <span> {fix.affected_pages.length} pages</span>
                </div>

                {/* Why it matters */}
                {fix.why_it_matters && (
                  <div className="mb-3">
                    <div className="text-sm font-medium text-ink mb-1">Why it matters:</div>
                    <p className="text-sm text-ink-muted">{fix.why_it_matters}</p>
                  </div>
                )}

                {/* How to fix */}
                {fix.how_to_fix && (
                  <div className="mb-3">
                    <div className="text-sm font-medium text-ink mb-1">How to fix:</div>
                    <p className="text-sm text-ink-muted">{fix.how_to_fix}</p>
                  </div>
                )}

                {/* Affected pages */}
                {fix.affected_pages.length > 0 && (
                  <div className="mb-3">
                    <div className="text-sm font-medium text-ink mb-1">Affected pages:</div>
                    <div className="text-xs text-ink-muted space-y-1">
                      {fix.affected_pages.slice(0, 3).map((page, i) => (
                        <div key={i} className="truncate">• {page.url}</div>
                      ))}
                      {fix.affected_pages.length > 3 && (
                        <div>... and {fix.affected_pages.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Expected impact */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="text-sm">
                    <span className="text-ink-subtle">Expected impact: </span>
                    <span className="font-medium text-ink">{fix.expected_impact}</span>
                  </div>
                  <div className="text-sm text-ink-subtle">
                    Effort: {fix.effort_estimate}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Site Diagnostics Component
function SiteDiagnostics({ diagnostics }: { diagnostics: any[] }) {
  const getStatusColor = (status: string) => {
    if (status === 'ok') return 'text-success';
    if (status === 'warn') return 'text-warn';
    return 'text-danger';
  };

  return (
    <div className="mb-12">
      <h2 className="text-3xl font-bold mb-6">Site-Level Diagnostics</h2>
      <p className="text-ink-muted mb-4 text-sm">
        These checks evaluate your site's overall foundation and structure.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {diagnostics.slice(0, 12).map((diagnostic) => (
          <div key={diagnostic.id} className="card card-body">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-sm flex-1">{diagnostic.name}</h3>
              <span className={`text-2xl font-bold ml-2 ${getStatusColor(diagnostic.status)}`}>
                {diagnostic.score}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={`pill pill-${diagnostic.status === 'ok' ? 'success' : diagnostic.status === 'warn' ? 'warn' : 'danger'}`}>
                {diagnostic.status.toUpperCase()}
              </span>
              <span className="text-ink-subtle">{diagnostic.impact_level} Impact</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Citation Analysis Component
function CitationAnalysis({ citations }: { citations: CitationAnalysis }) {
  return (
    <div className="mb-12">
      <h2 className="text-3xl font-bold mb-6">AI Citation Performance</h2>

      {/* Overall Performance */}
      <div className="card card-body mb-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-brand mb-1">{citations.overall_rate}%</div>
            <div className="text-xs text-ink-subtle">Overall Citation Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-ink-muted mb-1">{citations.cited_queries}</div>
            <div className="text-xs text-ink-subtle">Queries with Citations</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-ink-muted mb-1">{citations.total_queries}</div>
            <div className="text-xs text-ink-subtle">Total Queries Tested</div>
          </div>
        </div>
      </div>

      {/* By Source */}
      <div className="card card-body mb-4">
        <h3 className="text-lg font-semibold mb-3">Performance by AI Source</h3>
        <div className="space-y-3">
          {citations.by_source.map((source) => (
            <div key={source.source}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium capitalize text-sm">{source.source}</span>
                <span className="text-base font-bold">{source.rate}%</span>
              </div>
              <div className="bar">
                <span 
                  className={source.rate >= 50 ? 'bg-success' : source.rate >= 30 ? 'bg-warn' : 'bg-danger'}
                  style={{ width: `${source.rate}%` }}
                ></span>
              </div>
              <div className="text-xs text-ink-subtle mt-1">
                {source.cited} of {source.total} queries cited
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Citation Examples - Real LLM Responses */}
      {citations.successful_citations && citations.successful_citations.length > 0 && (
        <div className="card card-body mb-4">
          <h3 className="text-lg font-semibold mb-3">📝 Citation Examples: How AI Is Citing Your Content</h3>
          <p className="text-sm text-ink-muted mb-4">
            Real examples showing the queries, AI responses, and how your domain is being referenced:
          </p>
          <div className="space-y-4">
            {citations.successful_citations.slice(0, 10).map((citation, index) => (
              <div key={index} className="border border-border rounded-lg p-4 bg-surface-2">
                {/* Query */}
                <div className="mb-3">
                  <div className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">
                    User Query:
                  </div>
                  <div className="text-sm font-medium text-ink">
                    "{citation.query}"
                  </div>
                </div>

                {/* AI Source & Cited URL */}
                <div className="flex items-center gap-3 mb-3 text-xs">
                  <span className="pill pill-brand capitalize">{citation.source}</span>
                  {citation.cited_url && (
                    <span className="text-ink-subtle truncate">
                      Cited: {citation.cited_url.replace(/^https?:\/\//, '')}
                    </span>
                  )}
                </div>

                {/* AI Response Excerpt */}
                {citation.answer_excerpt && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-2">
                      AI Response Excerpt:
                    </div>
                    <div className="text-sm text-ink-muted leading-relaxed bg-surface-1 p-3 rounded border-l-4 border-brand">
                      {citation.answer_excerpt}
                      {citation.answer_excerpt.length >= 500 && (
                        <span className="text-ink-subtle italic"> ...</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missed Opportunities */}
      {citations.missed_opportunities && citations.missed_opportunities.length > 0 && (
        <div className="card card-body mb-4">
          <h3 className="text-lg font-semibold mb-3">️ Missed Opportunities (Where You're Not Cited)</h3>
          <p className="text-sm text-ink-muted mb-3">
            Queries where your domain wasn't cited - potential content gaps:
          </p>
          <div className="space-y-2">
            {citations.missed_opportunities.slice(0, 8).map((miss, index) => (
              <div key={index} className="p-2 bg-surface-2 rounded text-sm">
                <div className="font-medium">"{miss.query}"</div>
                <div className="text-xs text-ink-subtle mt-1">
                  <span className="capitalize">{miss.source}</span> • {miss.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Cited Pages */}
      {citations.top_cited_pages.length > 0 && (
        <div className="card card-body">
          <h3 className="text-lg font-semibold mb-3">Top Cited Pages</h3>
          <div className="space-y-2">
            {citations.top_cited_pages.slice(0, 5).map((page, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex-1 truncate text-sm">
                  <span className="font-medium mr-2">{index + 1}.</span>
                  <span className="truncate">{page.url}</span>
                  {page.top_queries.length > 0 && (
                    <div className="text-xs text-ink-subtle mt-1 ml-6">
                      Ex: "{page.top_queries[0]}"
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 ml-4">
                  <span className="pill pill-brand text-xs">{page.citation_count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Page Insights Component
function PageInsights({ topPages, quickWins }: { topPages: any[]; quickWins: any[] }) {
  return (
    <div className="mb-12">
      <h2 className="text-3xl font-bold mb-6">Page-Level Insights</h2>

      {/* Top Performers */}
      {topPages.length > 0 && (
        <div className="card card-body mb-6">
          <h3 className="text-lg font-semibold mb-4">Best Performing Pages</h3>
          <div className="space-y-3">
            {topPages.slice(0, 5).map((page, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex-1">
                  <div className="text-sm font-medium truncate">{page.url}</div>
                  {page.title && <div className="text-xs text-ink-subtle">{page.title}</div>}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                  <div className="text-sm">
                    Score: <span className="font-bold">{page.score}</span>
                  </div>
                  {page.citation_count > 0 && (
                    <div className="text-sm">
                      Citations: <span className="font-bold">{page.citation_count}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <div className="card card-body">
          <h3 className="text-lg font-semibold mb-4">Quick Win Opportunities</h3>
          <p className="text-sm text-ink-muted mb-4">
            Pages close to passing thresholds. Small fixes can yield significant improvements.
          </p>
          <div className="space-y-4">
            {quickWins.slice(0, 5).map((page, index) => (
              <div key={index} className="p-4 bg-surface-2 rounded-lg">
                <div className="text-sm font-medium mb-2 truncate">{page.url}</div>
                {page.quick_win && (
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-ink-subtle">Fix: </span>
                      <span className="font-medium">{page.quick_win.fix}</span>
                    </div>
                    <div>
                      <span className="text-ink-subtle">Impact: </span>
                      <span className="font-medium text-success">{page.quick_win.impact}</span>
                    </div>
                    <div>
                      <span className="text-ink-subtle">Effort: </span>
                      <span className="font-medium">{page.quick_win.effort}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

