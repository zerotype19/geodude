import React, { useState, useEffect } from 'react';
import { apiGet } from '../lib/api';
import { Link } from 'react-router-dom';
import AICitedBadge from './AICitedBadge';
import { useCitedPages } from '../hooks/useCitedPages';

interface PageCheck {
  id: string;
  score: number;
  status: string;
  scope: 'page';
  preview?: boolean;
  impact?: string;
  details?: Record<string, any>;
}

interface Page {
  id: string;
  url: string;
  status_code: number;
  content_type: string;
  aeo_score?: number;
  geo_score?: number;
  checks_json?: string;
}

interface PagesTabProps {
  auditId: string;
}

const API_BASE = 'https://api.optiview.ai';

export default function PagesTab({ auditId }: PagesTabProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'issues' | 'good'>('all');
  const [sortBy, setSortBy] = useState<'url' | 'score'>('url');
  const { getCitationCount } = useCitedPages(auditId);

  useEffect(() => {
    fetchPages();
  }, [auditId]);

  const fetchPages = async () => {
    try {
      const data = await apiGet<{ pages: Page[] }>(`/api/audits/${auditId}/pages?limit=500`);
      setPages(data.pages || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const parseChecks = (checksJson?: string): PageCheck[] => {
    if (!checksJson) return [];
    
    try {
      const checks = JSON.parse(checksJson);
      return Array.isArray(checks) ? checks : [];
    } catch (e) {
      return [];
    }
  };

  const calculatePageScore = (checks: PageCheck[]): number => {
    // Filter out preview checks
    const productionChecks = checks.filter((c) => !c.preview);
    if (productionChecks.length === 0) return 0;
    
    // Simple average for now (could use weights from criteria table)
    const sum = productionChecks.reduce((acc, check) => acc + check.score, 0);
    return Math.round(sum / productionChecks.length);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 85) return 'text-success';
    if (score >= 60) return 'text-warn';
    return 'text-danger';
  };

  const getScoreGlow = (score: number): string => {
    if (!Number.isFinite(score)) return '';
    if (score >= 85) return 'score-glow-success';
    if (score >= 60) return 'score-glow-warn';
    return 'score-glow-danger';
  };

  const getScoreBadgeColor = (score: number): string => {
    if (score >= 85) return 'bg-success-soft text-success';
    if (score >= 60) return 'bg-warn-soft text-warn';
    return 'bg-danger-soft text-danger';
  };

  const getStatusChip = (status: string): string => {
    switch (status) {
      case 'ok':
        return 'bg-success-soft0';
      case 'warn':
        return 'bg-warn-soft0';
      case 'fail':
        return 'bg-danger-soft0';
      default:
        return 'bg-gray-500';
    }
  };

  const pagesWithScores = pages.map((page) => {
    const checks = parseChecks(page.checks_json);
    const score = calculatePageScore(checks);
    return { ...page, checks, diagnosticScore: score };
  });

  const filteredAndSortedPages = pagesWithScores
    .filter((page) => {
      if (filter === 'issues') return page.diagnosticScore < 60;
      if (filter === 'good') return page.diagnosticScore >= 85;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.diagnosticScore - a.diagnosticScore;
        case 'url':
        default:
          return a.url.localeCompare(b.url);
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 muted">Loading pages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-danger mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium  mb-2">Error Loading Pages</h3>
          <p className="muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filters and Sorting */}
      <div className="bg-surface-1 shadow rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium muted mb-1">Filter</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="all">All Pages</option>
                <option value="issues">Issues (&lt;60)</option>
                <option value="good">Good (≥85)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium muted mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="url">URL</option>
                <option value="score">Diagnostic Score</option>
              </select>
            </div>
          </div>
          
          <div className="text-sm muted">
            Showing {filteredAndSortedPages.length} of {pages.length} pages
          </div>
        </div>
      </div>

      {/* Pages Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAndSortedPages.map((page) => {
          const failingChecks = page.checks.filter((c) => !c.preview && c.status === 'fail');
          const warningChecks = page.checks.filter((c) => !c.preview && c.status === 'warn');
          
          return (
            <div key={page.id} className={`bg-surface-1 rounded-lg hover:shadow-md transition-shadow border ${getScoreGlow(page.diagnosticScore)}`}>
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-medium truncate">
                        <a href={page.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand">
                          {new URL(page.url).pathname || '/'}
                        </a>
                      </h3>
                      {getCitationCount(page.url) > 0 && (
                        <AICitedBadge citationCount={getCitationCount(page.url)} />
                      )}
                    </div>
                    <p className="text-sm subtle truncate">{page.url}</p>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ml-2 flex-shrink-0 ${
                    page.status_code >= 200 && page.status_code < 300 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
                  }`}>
                    {page.status_code}
                  </span>
                </div>

                {/* Diagnostic Score */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium muted">Diagnostic Score</div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getScoreBadgeColor(page.diagnosticScore)}`}>
                      {page.diagnosticScore >= 85 ? 'Good' : page.diagnosticScore >= 60 ? 'Fair' : 'Needs Work'}
                    </span>
                  </div>
                  <div className={`text-3xl font-bold ${getScoreColor(page.diagnosticScore)} mb-2`}>
                    {page.diagnosticScore}
                  </div>
                  <div className="w-full bg-surface-3 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        page.diagnosticScore >= 85 ? 'bg-success-soft0' : page.diagnosticScore >= 60 ? 'bg-warn-soft0' : 'bg-danger-soft0'
                      }`}
                      style={{ width: `${Math.min(100, page.diagnosticScore)}%` }}
                    />
                  </div>
                </div>

                {/* Check Summary */}
                <div className="mb-4 text-sm muted">
                  <div className="flex items-center justify-between">
                    <span>{page.checks.filter(c => !c.preview).length} active checks</span>
                    {failingChecks.length > 0 && (
                      <span className="text-danger font-semibold">{failingChecks.length} failing</span>
                    )}
                    {failingChecks.length === 0 && warningChecks.length > 0 && (
                      <span className="text-warn font-semibold">{warningChecks.length} warnings</span>
                    )}
                  </div>
                </div>

                {/* Top Issues */}
                {failingChecks.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-medium muted mb-2">Top Issues</div>
                    <div className="space-y-1">
                      {failingChecks.slice(0, 3).map((check) => (
                        <div key={check.id} className="flex items-center text-xs">
                          <span className={`w-2 h-2 rounded-full ${getStatusChip(check.status)} mr-2`}></span>
                          <span className="font-mono muted">{check.id}</span>
                        </div>
                      ))}
                      {failingChecks.length > 3 && (
                        <div className="text-xs subtle pl-4">+{failingChecks.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <Link
                    to={`/audits/${auditId}/pages/${page.id}`}
                    className="text-brand hover:text-brand text-sm font-medium"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAndSortedPages.length === 0 && (
        <div className="text-center py-12">
          <div className="subtle mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium  mb-2">No pages found</h3>
          <p className="muted">Try adjusting your filters or check back later.</p>
        </div>
      )}
    </div>
  );
}
