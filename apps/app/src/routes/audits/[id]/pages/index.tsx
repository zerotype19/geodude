import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

interface Page {
  id: string;
  url: string;
  status_code: number;
  content_type: string;
  aeo_score?: number;
  geo_score?: number;
  checks_json?: string;
}

const API_BASE = 'https://api.optiview.ai';

export default function AuditPages() {
  const { id } = useParams<{ id: string }>();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'aeo' | 'geo'>('all');
  const [sortBy, setSortBy] = useState<'url' | 'aeo_score' | 'geo_score'>('url');

  useEffect(() => {
    if (id) {
      fetchPages();
    }
  }, [id]);

  const fetchPages = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/audits/${id}/pages?limit=500`);
      if (!response.ok) {
        throw new Error('Failed to fetch pages');
      }
      const data = await response.json();
      setPages(data.pages || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-500';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCheckChips = (checksJson?: string) => {
    if (!checksJson) return [];
    
    try {
      const checks = JSON.parse(checksJson);
      return checks.map((check: any) => ({
        id: check.id,
        score: check.score,
        weight: check.weight
      }));
    } catch (e) {
      return [];
    }
  };

  const getCheckChipColor = (score: number) => {
    switch (score) {
      case 3: return 'bg-green-100 text-green-800';
      case 2: return 'bg-blue-100 text-blue-800';
      case 1: return 'bg-yellow-100 text-yellow-800';
      case 0: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredAndSortedPages = pages
    .filter(page => {
      if (filter === 'aeo') return page.aeo_score !== undefined && page.aeo_score < 70;
      if (filter === 'geo') return page.geo_score !== undefined && page.geo_score < 70;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'aeo_score':
          return (b.aeo_score || 0) - (a.aeo_score || 0);
        case 'geo_score':
          return (b.geo_score || 0) - (a.geo_score || 0);
        case 'url':
        default:
          return a.url.localeCompare(b.url);
      }
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading pages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Pages</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link
            to={`/audits/${id}`}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Back to Audit
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <Link to={`/audits/${id}`} className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
                ← Back to Audit
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Pages Analysis</h1>
              <p className="mt-2 text-gray-600">
                Detailed breakdown of all analyzed pages
              </p>
            </div>
          </div>
        </div>

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
                  <option value="aeo">AEO Issues (&lt;70)</option>
                  <option value="geo">GEO Issues (&lt;70)</option>
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
                  <option value="aeo_score">AEO Score</option>
                  <option value="geo_score">GEO Score</option>
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
            const checkChips = getCheckChips(page.checks_json);
            
            return (
              <div key={page.id} className="bg-white shadow rounded-lg overflow-hidden">
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
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      page.status_code >= 200 && page.status_code < 300 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {page.status_code}
                    </span>
                  </div>

                  {/* Scores */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {page.aeo_score ? Math.round(page.aeo_score) : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">AEO Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {page.geo_score ? Math.round(page.geo_score) : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">GEO Score</div>
                    </div>
                  </div>

                  {/* Check Chips */}
                  <div className="mb-4">
                    <div className="text-xs font-medium text-gray-700 mb-2">Check Results</div>
                    <div className="flex flex-wrap gap-1">
                      {checkChips.slice(0, 8).map((check) => (
                        <span
                          key={check.id}
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCheckChipColor(check.score)}`}
                          title={`${check.id}: ${check.score}/3 (weight: ${check.weight})`}
                        >
                          {check.id}
                        </span>
                      ))}
                      {checkChips.length > 8 && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          +{checkChips.length - 8}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end">
                    <Link
                      to={`/audits/${id}/pages/${page.id}`}
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
    </div>
  );
}
