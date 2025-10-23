import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import CitationsTab from '/src/components/CitationsTab';
import CheckPill from '/src/components/CheckPill';
import ScoreBadge from '/src/components/ScoreBadge';
import ScoreLegend from '/src/components/ScoreLegend';
import CheckCategories from '/src/components/CheckCategories';
import CategoryScoreCard from '/src/components/CategoryScoreCard';
import FixFirst from '/src/components/FixFirst';
import CitationSummaryCard from '/src/components/CitationSummaryCard';
import PagesTab from '/src/components/PagesTab';
import RenderParityPanel from '/src/components/RenderParityPanel';
import AuditTour from '/src/components/AuditTour';
import CompositeBanner from '/src/components/CompositeBanner';
import SiteOverview from '/src/components/SiteOverview';
import PageChecksTable from '/src/components/PageChecksTable';
import { apiGet, apiPost } from '/src/lib/api';
import { useAuditDiagnostics } from '/src/hooks/useAuditDiagnostics';

interface CategoryScore {
  category: string;
  score: number;
  weight_total: number;
  checks_count: number;
}

interface FixItem {
  id: string;
  name: string;
  category: string;
  impact_level: 'High' | 'Medium' | 'Low';
  weight: number;
  score: number;
  why_it_matters?: string;
}

interface Audit {
  id: string;
  project_id: string;
  root_url: string;
  site_description?: string; // User-provided description of the site
  started_at: string;
  finished_at?: string;
  status: 'running' | 'complete' | 'failed';
  aeo_score?: number;
  geo_score?: number;
  geo_adjusted?: number; // GEO score adjusted for real-world citations
  geo_adjustment_details?: {
    geo_raw: number;
    geo_adjusted: number;
    citation_bonus: number;
    breakdown: {
      chatgpt_contribution: number;
      claude_contribution: number;
      perplexity_contribution: number;
    };
    performance_flag?: 'citation_overperformance' | 'structural_advantage' | 'balanced';
    explanation: string;
  };
  pages_analyzed: number;
  avg_aeo_score: number;
  avg_geo_score: number;
  fail_reason?: string;
  fail_at?: string;
  render_gap_ratio?: number; // Average render visibility across all pages (0-1)
  // Scorecard V2 fields
  category_scores?: CategoryScore[];
  fix_first?: FixItem[];
  scorecard_v2?: boolean;
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rerunLoading, setRerunLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'pages' | 'citations' | 'actions' | 'diagnostics'>('overview');
  
  // Load diagnostics data
  const diagnostics = useAuditDiagnostics(id);

  // Handle tab from URL query parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'citations' || tabParam === 'pages' || tabParam === 'overview' || tabParam === 'actions' || tabParam === 'diagnostics') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Handler to change tabs and update URL
  const handleTabChange = (tab: 'overview' | 'pages' | 'citations' | 'actions' | 'diagnostics') => {
    setActiveTab(tab);
    navigate(`/audits/${id}?tab=${tab}`, { replace: true });
  };

  useEffect(() => {
    if (id) {
      fetchAudit();
      fetchPages();
    }
  }, [id]);

  const fetchAudit = async () => {
    try {
      const data = await apiGet<Audit>(`/api/audits/${id}`);
      setAudit(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const fetchPages = async () => {
    try {
      const data = await apiGet<{ pages: Page[] }>(`/api/audits/${id}/pages?limit=100`);
      setPages(data.pages || []);
    } catch (error) {
      console.error('Failed to fetch pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRerun = async () => {
    if (!id || !audit) return;
    
    if (!confirm('This will re-crawl the entire site and may take several minutes. Continue?')) {
      return;
    }
    
    setRerunLoading(true);
    try {
      // Trigger a new audit with the same parameters, including site_description
      const requestBody: any = {
        project_id: audit.project_id,
        root_url: audit.root_url,
        max_pages: 100, // Default limit
      };
      
      // Include site_description if it exists
      if (audit.site_description) {
        requestBody.site_description = audit.site_description;
      }
      
      const result = await apiPost<any>(`/api/audits`, requestBody);
      console.log('New audit started:', result);
      
      // API returns audit_id, not id
      const newAuditId = result.audit_id || result.id;
      
      if (!newAuditId) {
        throw new Error('No audit ID returned from API');
      }
      
      // Redirect to the new audit
      alert(`New audit started! Redirecting to new audit page...`);
      window.location.href = `/audits/${newAuditId}`;
    } catch (error) {
      console.error('Failed to re-run audit:', error);
      alert('Failed to start new audit. Please try again.');
    } finally {
      setRerunLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-success-soft text-success';
      case 'running': return 'bg-brand-soft text-brand';
      case 'failed': return 'bg-danger-soft text-danger';
      default: return 'bg-surface-2 text-gray-800';
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'subtle';
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warn';
    return 'text-danger';
  };

  const getCheckScoreColor = (score: number) => {
    switch (score) {
      case 3: return 'bg-success-soft text-success';
      case 2: return 'bg-brand-soft text-brand';
      case 1: return 'bg-warn-soft text-warn';
      case 0: return 'bg-danger-soft text-danger';
      default: return 'bg-surface-2 text-gray-800';
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
      <div className="min-h-screen bg-surface-2 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 muted">Loading audit details...</p>
        </div>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center">
        <div className="text-center">
          <div className="text-danger mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium  mb-2">Error Loading Audit</h3>
          <p className="muted mb-4">{error || 'Audit not found'}</p>
          <Link
            to="/audits"
            className="bg-brand hover:bg-brand text-white font-medium py-2 px-4 rounded-lg transition-colors"
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
    <div className="min-h-screen bg-surface-1">
      <AuditTour />
      <div className="page-max container-px py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <Link to="/audits" className="text-brand hover:underline mb-2 inline-block">
                ← Back to Audits
              </Link>
              <h1 className="text-3xl font-bold">Audit Details</h1>
              <p className="mt-2 muted">
                {audit.project_id} • {audit.root_url}
                {audit.started_at && (
                  <span className="ml-2">
                    • {new Date(audit.started_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRerun}
                disabled={rerunLoading}
                className={rerunLoading ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'}
                title="Re-crawl the site and generate fresh analysis"
              >
                {rerunLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Starting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Re-run
                  </>
                )}
              </button>
              <span className={`pill ${getStatusColor(audit.status)}`}>
                {audit.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-8 border-b border-border">
            <button
              data-tour="overview-tab"
              onClick={() => handleTabChange('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-brand text-brand'
                  : 'border-transparent muted hover:border-border'
              }`}
            >
              Overview
            </button>
            <button
              data-tour="pages-tab"
              onClick={() => handleTabChange('pages')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pages'
                  ? 'border-brand text-brand'
                  : 'border-transparent muted hover:border-border'
              }`}
            >
              Pages
            </button>
            <button
              data-tour="citations-tab"
              onClick={() => handleTabChange('citations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'citations'
                  ? 'border-brand text-brand'
                  : 'border-transparent muted hover:border-border'
              }`}
            >
              Citations
            </button>
            <button
              onClick={() => handleTabChange('actions')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'actions'
                  ? 'border-brand text-brand'
                  : 'border-transparent muted hover:border-border'
              }`}
            >
              Actions
            </button>
            <button
              onClick={() => handleTabChange('diagnostics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'diagnostics'
                  ? 'border-brand text-brand'
                  : 'border-transparent muted hover:border-border'
              }`}
            >
              Diagnostics
              {diagnostics.composite && (
                <span className="ml-2 pill pill-brand">
                  {diagnostics.composite.total.toFixed(1)}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Failure Banner */}
        {audit.status === 'failed' && (
          <div className="mb-8 card bg-danger-soft border-l-4 border-danger">
            <div className="flex p-4">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-danger" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium">
                  Audit Failed
                </h3>
                <div className="mt-2 text-sm">
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
                  <p className="mt-2 text-xs text-danger">
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
            auditId={id!} 
          />
        ) : activeTab === 'pages' ? (
          <PagesTab auditId={id!} />
        ) : activeTab === 'actions' ? (
          <>
            {/* Actions Tab - Fix First Priority Queue */}
            {audit.scorecard_v2 && audit.fix_first && audit.fix_first.length > 0 ? (
              <div className="mb-8">
                <FixFirst fixes={audit.fix_first} />
              </div>
            ) : (
              <div className="bg-surface-1 rounded-lg border border-border p-8 text-center">
                <p className="muted">No priority actions identified yet. Complete the audit to see recommendations.</p>
              </div>
            )}
          </>
        ) : activeTab === 'diagnostics' ? (
          <>
            {/* Diagnostics Tab */}
            {diagnostics.loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 muted">Loading diagnostics...</p>
              </div>
            ) : diagnostics.error ? (
              <div className="bg-danger-soft border border-danger rounded-lg p-6 text-center">
                <p className="text-danger">{diagnostics.error}</p>
              </div>
            ) : (
              <>
                {/* Composite Scores Banner */}
                {diagnostics.composite && (
                  <CompositeBanner data={diagnostics.composite} />
                )}

                {/* Site-Level Diagnostics */}
                {diagnostics.siteChecks.length > 0 && (
                  <SiteOverview 
                    siteChecks={diagnostics.siteChecks} 
                    criteriaMap={diagnostics.criteriaMap} 
                  />
                )}

                {/* Page-Level Diagnostics (Sample - First Page) */}
                {pages.length > 0 && diagnostics.pageChecks[pages[0].id] && (
                  <div className="mb-8">
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold  mb-1">Sample Page Checks</h2>
                      <p className="text-sm muted">
                        Showing checks for: <span className="font-mono text-xs">{pages[0].url}</span>
                      </p>
                    </div>
                    <PageChecksTable 
                      rows={diagnostics.pageChecks[pages[0].id]} 
                      criteriaMap={diagnostics.criteriaMap} 
                    />
                  </div>
                )}

                {/* Empty State */}
                {diagnostics.siteChecks.length === 0 && Object.keys(diagnostics.pageChecks).length === 0 && (
                  <div className="bg-warn-soft border border-warn rounded-lg p-8 text-center">
                    <p className="text-warn mb-4">
                      No diagnostics data available yet. The scoring system may still be processing this audit.
                    </p>
                    <p className="text-sm text-warn">
                      Try refreshing the page in a few moments, or re-run the audit to generate new scores.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Overview Tab - Composite Banner */}
            {diagnostics.composite && (
              <CompositeBanner data={diagnostics.composite} />
            )}

        {/* Category Scores (Scorecard V2) */}
        {audit.scorecard_v2 && audit.category_scores && audit.category_scores.length > 0 && (
          <div className="mb-8">
            <div className="mb-4">
              <h2 className="text-xl font-semibold  mb-1">Category Breakdown</h2>
              <p className="text-sm muted">
                Your site performance across 6 key categories (0-100 scale)
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {audit.category_scores.map((categoryScore) => (
                <CategoryScoreCard 
                  key={categoryScore.category} 
                  categoryScore={categoryScore} 
                />
              ))}
            </div>
          </div>
        )}

        {/* Citation Summary */}
        <div className="mb-8">
          <CitationSummaryCard auditId={id!} />
        </div>
          </>
        )}
      </div>
    </div>
  );
}
