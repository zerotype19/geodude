import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import CitationsTab from '/src/components/CitationsTab';
import CheckPill from '/src/components/CheckPill';
import ScoreBadge from '/src/components/ScoreBadge';
import ScoreLegend from '/src/components/ScoreLegend';
import CheckCategories from '/src/components/CheckCategories';

interface Audit {
  id: string;
  project_id: string;
  root_url: string;
  started_at: string;
  finished_at?: string;
  status: 'running' | 'complete' | 'failed';
  aeo_score?: number;
  geo_score?: number;
  pages_analyzed: number;
  avg_aeo_score: number;
  avg_geo_score: number;
  fail_reason?: string;
  fail_at?: string;
}

interface CheckResult {
  id: string;
  score: number;
  weight: number;
  evidence: {
    found: boolean;
    details: string;
    snippets?: string[];
  };
}

interface Page {
  id: string;
  url: string;
  status_code: number;
  aeo_score?: number;
  geo_score?: number;
  checks_json?: string;
}

const API_BASE = 'https://api.optiview.ai';

export default function AuditDetail() {
  const { id } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rescoreLoading, setRescoreLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'citations'>('overview');

  useEffect(() => {
    if (id) {
      fetchAudit();
      fetchPages();
    }
  }, [id]);

  const fetchAudit = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/audits/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch audit');
      }
      const data = await response.json();
      setAudit(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const fetchPages = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/audits/${id}/pages?limit=100`);
      if (!response.ok) {
        throw new Error('Failed to fetch pages');
      }
      const data = await response.json();
      setPages(data.pages || []);
    } catch (error) {
      console.error('Failed to fetch pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRescore = async () => {
    if (!id) return;
    
    setRescoreLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/audits/${id}/recompute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to rescore audit');
      }
      
      const result = await response.json();
      console.log('Rescore result:', result);
      
      // Refresh the audit and pages data
      await fetchAudit();
      await fetchPages();
      
      // Show success message (you could add a toast notification here)
      alert('Audit rescored successfully!');
    } catch (error) {
      console.error('Failed to rescore audit:', error);
      alert('Failed to rescore audit. Please try again.');
    } finally {
      setRescoreLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-500';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCheckScoreColor = (score: number) => {
    switch (score) {
      case 3: return 'bg-green-100 text-green-800';
      case 2: return 'bg-blue-100 text-blue-800';
      case 1: return 'bg-yellow-100 text-yellow-800';
      case 0: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTopBlockers = () => {
    const allChecks: CheckResult[] = [];
    
    pages.forEach(page => {
      if (page.checks_json) {
        try {
          const checks = JSON.parse(page.checks_json);
          allChecks.push(...checks);
        } catch (e) {
          console.error('Failed to parse checks:', e);
        }
      }
    });

    // Group by check ID and calculate average scores
    const checkAverages: Record<string, { score: number, weight: number, count: number }> = {};
    
    allChecks.forEach(check => {
      if (!checkAverages[check.id]) {
        checkAverages[check.id] = { score: 0, weight: check.weight, count: 0 };
      }
      checkAverages[check.id].score += check.score;
      checkAverages[check.id].count += 1;
    });

    // Calculate averages and sort by weighted impact
    const blockers = Object.entries(checkAverages)
      .map(([id, data]) => ({
        id,
        score: data.score / data.count,
        weight: data.weight,
        impact: (data.weight * (3 - data.score / data.count)) // Higher weight + lower score = higher impact
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5);

    return blockers;
  };

  const getQuickWins = () => {
    const allChecks: CheckResult[] = [];
    
    pages.forEach(page => {
      if (page.checks_json) {
        try {
          const checks = JSON.parse(page.checks_json);
          allChecks.push(...checks);
        } catch (e) {
          console.error('Failed to parse checks:', e);
        }
      }
    });

    // Find high-weight checks with score 0
    const quickWins = allChecks
      .filter(check => check.score === 0 && check.weight >= 10)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    // Remove duplicates
    const unique = quickWins.filter((check, index, self) => 
      index === self.findIndex(c => c.id === check.id)
    );

    return unique;
  };

  const getAllCheckScores = () => {
    const allChecks: CheckResult[] = [];
    
    pages.forEach(page => {
      if (page.checks_json) {
        try {
          const checks = JSON.parse(page.checks_json);
          allChecks.push(...checks);
        } catch (e) {
          console.error('Failed to parse checks:', e);
        }
      }
    });

    // Group by check ID and calculate average scores
    const checkAverages: Record<string, { score: number, weight: number, count: number }> = {};
    
    allChecks.forEach(check => {
      if (!checkAverages[check.id]) {
        checkAverages[check.id] = { score: 0, weight: check.weight, count: 0 };
      }
      checkAverages[check.id].score += check.score;
      checkAverages[check.id].count += 1;
    });

    // Calculate averages
    const scores: Record<string, { score: number; weight: number }> = {};
    Object.entries(checkAverages).forEach(([id, data]) => {
      scores[id] = {
        score: Math.round(data.score / data.count),
        weight: data.weight
      };
    });

    return scores;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading audit details...</p>
        </div>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Audit</h3>
          <p className="text-gray-600 mb-4">{error || 'Audit not found'}</p>
          <Link
            to="/audits"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Back to Audits
          </Link>
        </div>
      </div>
    );
  }

  const topBlockers = getTopBlockers();
  const quickWins = getQuickWins();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <Link to="/audits" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
                ← Back to Audits
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Audit Details</h1>
              <p className="mt-2 text-gray-600">
                {audit.project_id} • {audit.root_url}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRescore}
                disabled={rescoreLoading || audit.status !== 'complete'}
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  rescoreLoading || audit.status !== 'complete'
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title={audit.status !== 'complete' ? 'Only available for completed audits' : 'Rescore existing data with current rules'}
              >
                {rescoreLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Rescoring...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Rescore
                  </>
                )}
              </button>
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(audit.status)}`}>
                {audit.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('citations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'citations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Citations
            </button>
          </nav>
        </div>

        {/* Failure Banner */}
        {audit.status === 'failed' && (
          <div className="mb-8 bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">
                  Audit Failed
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>
                    {audit.fail_reason === 'non_content_platform' && 
                      'This platform requires login or is a web application (not a content site). Try a different domain.'}
                    {audit.fail_reason === 'timeout_no_pages_discovered' && 
                      'No pages discovered after 2 minutes. The site may be blocking our crawler or have no accessible content.'}
                    {audit.fail_reason === 'no_crawlable_pages_found' && 
                      'No crawlable pages found. Check if you entered the correct domain or if the site blocks crawlers.'}
                    {audit.fail_reason === 'domain_error_or_empty_page' && 
                      'Domain returned an error page or is not configured. Please check the URL and try again.'}
                    {audit.fail_reason?.startsWith('precheck_failed') && 
                      `Domain validation failed: ${audit.fail_reason.replace('precheck_failed_', '').replace(/_/g, ' ')}`}
                    {(!audit.fail_reason || (
                      audit.fail_reason !== 'non_content_platform' && 
                      audit.fail_reason !== 'timeout_no_pages_discovered' &&
                      audit.fail_reason !== 'no_crawlable_pages_found' &&
                      audit.fail_reason !== 'domain_error_or_empty_page' &&
                      !audit.fail_reason.startsWith('precheck_failed')
                    )) && 
                      `Reason: ${audit.fail_reason || 'Unknown error'}`}
                  </p>
                </div>
                {audit.fail_at && (
                  <p className="mt-2 text-xs text-red-600">
                    Failed at: {new Date(audit.fail_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'citations' ? (
          <CitationsTab 
            projectId={audit.project_id} 
            domain={new URL(audit.root_url).hostname} 
          />
        ) : (
          <>
            {/* Score Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <ScoreBadge
            score={audit.aeo_score}
            label="AEO Score"
            icon="A"
            iconColor="bg-blue-500"
            penalty={audit.aeo_score && audit.avg_aeo_score ? Math.round(audit.avg_aeo_score - audit.aeo_score) : undefined}
            penaltyReason={audit.aeo_score && audit.avg_aeo_score && audit.avg_aeo_score - audit.aeo_score > 0 
              ? "SPA visibility penalty applied (-5 to -10 points for low render gap)" 
              : undefined}
          />

          <ScoreBadge
            score={audit.geo_score}
            label="GEO Score"
            icon="G"
            iconColor="bg-green-500"
          />

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">P</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pages Analyzed</dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {audit.pages_analyzed}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Score Legend */}
        <div className="mb-8">
          <ScoreLegend />
        </div>

        {/* Top Blockers & Quick Wins */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Blockers */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Top Blockers</h2>
              <p className="text-sm text-gray-600">Highest impact issues to fix first</p>
            </div>
            <div className="p-6">
              {topBlockers.length === 0 ? (
                <p className="text-gray-500 text-sm">No blockers identified</p>
              ) : (
                <div className="space-y-3">
                  {topBlockers.map((blocker, index) => (
                    <div key={blocker.id} className="flex items-center justify-between">
                      <CheckPill 
                        code={blocker.id} 
                        weight={blocker.weight} 
                        score={Math.round(blocker.score)}
                      />
                      <div className="text-xs text-gray-500">
                        Impact: {Math.round(blocker.impact)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Wins */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Quick Wins</h2>
              <p className="text-sm text-gray-600">High-impact improvements you can make</p>
            </div>
            <div className="p-6">
              {quickWins.length === 0 ? (
                <p className="text-gray-500 text-sm">No quick wins identified</p>
              ) : (
                <div className="space-y-3">
                  {quickWins.map((win, index) => (
                    <div key={win.id}>
                      <CheckPill 
                        code={win.id} 
                        weight={win.weight} 
                        score={0}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Check Categories */}
        <div className="mb-8">
          <CheckCategories scores={getAllCheckScores()} />
        </div>

        {/* Pages List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Pages Analyzed</h2>
            <p className="text-sm text-gray-600">Individual page scores and details</p>
          </div>
          
          {pages.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">No pages analyzed yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AEO Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      GEO Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pages.map((page) => (
                    <tr key={page.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        <a href={page.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                          {page.url}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          page.status_code >= 200 && page.status_code < 300 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {page.status_code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={getScoreColor(page.aeo_score)}>
                          {page.aeo_score ? Math.round(page.aeo_score) : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={getScoreColor(page.geo_score)}>
                          {page.geo_score ? Math.round(page.geo_score) : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          to={`/audits/${id}/pages/${page.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
