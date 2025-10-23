import React, { useState, useEffect } from 'react';
import { apiGet } from '../lib/api';
import { Link } from 'react-router-dom';

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
    if (score >= 85) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBadgeColor = (score: number): string => {
    if (score >= 85) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusChip = (status: string): string => {
    switch (status) {
      case 'ok':
        return 'bg-green-500';
      case 'warn':
        return 'bg-amber-500';
      case 'fail':
        return 'bg-red-500';
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
          <p className="mt-4 text-gray-600">Loading pages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Pages</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filters and Sorting */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Pages</option>
                <option value="issues">Issues (&lt;60)</option>
                <option value="good">Good (≥85)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="url">URL</option>
                <option value="score">Diagnostic Score</option>
              </select>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
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
            <div key={page.id} className="bg-white shadow rounded-lg hover:shadow-md transition-shadow">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      <a href={page.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                        {new URL(page.url).pathname || '/'}
                      </a>
                    </h3>
                    <p className="text-sm text-gray-500 truncate">{page.url}</p>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ml-2 flex-shrink-0 ${
                    page.status_code >= 200 && page.status_code < 300 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {page.status_code}
                  </span>
                </div>

                {/* Diagnostic Score */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium text-gray-700">Diagnostic Score</div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getScoreBadgeColor(page.diagnosticScore)}`}>
                      {page.diagnosticScore >= 85 ? 'Good' : page.diagnosticScore >= 60 ? 'Fair' : 'Needs Work'}
                    </span>
                  </div>
                  <div className={`text-3xl font-bold ${getScoreColor(page.diagnosticScore)} mb-2`}>
                    {page.diagnosticScore}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        page.diagnosticScore >= 85 ? 'bg-green-500' : page.diagnosticScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, page.diagnosticScore)}%` }}
                    />
                  </div>
                </div>

                {/* Check Summary */}
                <div className="mb-4 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>{page.checks.filter(c => !c.preview).length} active checks</span>
                    {failingChecks.length > 0 && (
                      <span className="text-red-600 font-semibold">{failingChecks.length} failing</span>
                    )}
                    {failingChecks.length === 0 && warningChecks.length > 0 && (
                      <span className="text-amber-600 font-semibold">{warningChecks.length} warnings</span>
                    )}
                  </div>
                </div>

                {/* Top Issues */}
                {failingChecks.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-medium text-gray-700 mb-2">Top Issues</div>
                    <div className="space-y-1">
                      {failingChecks.slice(0, 3).map((check) => (
                        <div key={check.id} className="flex items-center text-xs">
                          <span className={`w-2 h-2 rounded-full ${getStatusChip(check.status)} mr-2`}></span>
                          <span className="font-mono text-gray-600">{check.id}</span>
                        </div>
                      ))}
                      {failingChecks.length > 3 && (
                        <div className="text-xs text-gray-500 pl-4">+{failingChecks.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <Link
                    to={`/audits/${auditId}/pages/${page.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
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
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pages found</h3>
          <p className="text-gray-600">Try adjusting your filters or check back later.</p>
        </div>
      )}
    </div>
  );
}
