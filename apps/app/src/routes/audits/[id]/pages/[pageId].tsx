import React, { useState, useEffect } from 'react';
import { apiGet } from '../../../../lib/api';
import { useParams, Link } from 'react-router-dom';
import { useAuditDiagnostics } from '/src/hooks/useAuditDiagnostics';
import { CRITERIA_BY_ID, CATEGORY_ORDER, CATEGORY_DESCRIPTIONS } from '/src/content/criteriaV3';

interface PageDetails {
  id: string;
  audit_id: string;
  url: string;
  status_code: number;
  content_type: string;
  html_static: string;
  html_rendered?: string;
  fetched_at: string;
  title?: string;
  h1?: string;
  canonical?: string;
  schema_types?: string;
  jsonld?: string;
  analyzed_at: string;
}

interface CheckResult {
  id: string;
  score: number;
  status: 'ok' | 'warn' | 'fail' | 'error' | 'not_applicable';
  details: Record<string, any>;
  evidence?: string[];
  scope: 'page' | 'site';
  preview?: boolean;
  impact?: 'High' | 'Medium' | 'Low';
}

const API_BASE = 'https://api.optiview.ai';

const STATUS_COLORS = {
  ok: 'bg-green-100 text-green-800 border-green-300',
  warn: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  fail: 'bg-red-100 text-red-800 border-red-300',
  error: 'bg-gray-100 text-gray-800 border-gray-300',
  not_applicable: 'bg-gray-50 text-gray-600 border-gray-200'
};

const STATUS_ICONS = {
  ok: '✓',
  warn: '⚠',
  fail: '✗',
  error: '!',
  not_applicable: '—'
};

const IMPACT_COLORS = {
  High: 'bg-red-50 text-red-700',
  Medium: 'bg-yellow-50 text-yellow-700',
  Low: 'bg-blue-50 text-blue-700'
};

export default function PageDetail() {
  const { id, pageId } = useParams<{ id: string; pageId: string }>();
  const [page, setPage] = useState<PageDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'checks' | 'metadata' | 'html'>('checks');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORY_ORDER)
  );
  
  // Load diagnostics data
  const diagnostics = useAuditDiagnostics(id);

  useEffect(() => {
    if (pageId) {
      fetchPage();
    }
  }, [pageId]);

  const fetchPage = async () => {
    try {
      const data = await apiGet<PageDetails>(`/api/audits/${id}/pages/${pageId}`);
      setPage(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const parseSchemaTypes = () => {
    if (!page?.schema_types) return [];
    try {
      return JSON.parse(page.schema_types);
    } catch (e) {
      return [];
    }
  };

  const parseJsonld = () => {
    if (!page?.jsonld) return [];
    try {
      return JSON.parse(page.jsonld);
    } catch (e) {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading page details...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Page</h3>
          <p className="text-gray-600 mb-4">{error || 'Page not found'}</p>
          <Link
            to={`/audits/${id}/pages`}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Back to Pages
          </Link>
        </div>
      </div>
    );
  }

  const pageChecks: CheckResult[] = pageId && diagnostics.pageChecks[pageId] ? diagnostics.pageChecks[pageId] : [];
  const productionChecks = pageChecks.filter(c => !c.preview);
  
  // Group checks by category
  const checksByCategory = productionChecks.reduce((acc, check) => {
    const criteria = CRITERIA_BY_ID.get(check.id);
    const category = criteria?.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ ...check, criteria });
    return acc;
  }, {} as Record<string, Array<CheckResult & { criteria?: any }>>);

  // Calculate average score
  const avgScore = productionChecks.length > 0
    ? Math.round(productionChecks.reduce((sum, c) => sum + c.score, 0) / productionChecks.length)
    : 0;

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const schemaTypes = parseSchemaTypes();
  const jsonld = parseJsonld();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <Link to={`/audits/${id}/pages`} className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
                ← Back to Pages
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Page Analysis</h1>
              <p className="mt-2 text-gray-600">
                <a href={page.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 break-all">
                  {page.url}
                </a>
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                page.status_code >= 200 && page.status_code < 300 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                HTTP {page.status_code}
              </span>
            </div>
          </div>
        </div>

        {/* Page Score Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-1">Page Diagnostic Score</h2>
              <p className="text-sm text-gray-600">{productionChecks.length} checks analyzed</p>
            </div>
            <div className={`text-5xl font-bold ${getScoreColor(avgScore)}`}>
              {avgScore}
            </div>
          </div>
          
          {/* Quick status summary */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-green-600">✓</span>
              <span className="text-gray-600">
                {productionChecks.filter(c => c.status === 'ok').length} passing
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-yellow-600">⚠</span>
              <span className="text-gray-600">
                {productionChecks.filter(c => c.status === 'warn').length} warnings
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-red-600">✗</span>
              <span className="text-gray-600">
                {productionChecks.filter(c => c.status === 'fail').length} failing
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: 'checks', label: 'Diagnostic Checks', count: productionChecks.length },
                { id: 'metadata', label: 'Schema & Metadata', count: schemaTypes.length },
                { id: 'html', label: 'HTML Analysis' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Check Results Tab */}
            {activeTab === 'checks' && (
              <div className="space-y-4">
                {CATEGORY_ORDER.filter(cat => checksByCategory[cat] && checksByCategory[cat].length > 0).map((category) => {
                  const categoryChecks = checksByCategory[category] || [];
                  const isExpanded = expandedCategories.has(category);
                  const categoryAvg = Math.round(
                    categoryChecks.reduce((sum, c) => sum + c.score, 0) / categoryChecks.length
                  );
                  const failCount = categoryChecks.filter(c => c.status === 'fail').length;
                  const warnCount = categoryChecks.filter(c => c.status === 'warn').length;
                  const okCount = categoryChecks.filter(c => c.status === 'ok').length;

                  return (
                    <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Category Header */}
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-base font-medium text-gray-900">{category}</span>
                          <span className={`text-2xl font-bold ${getScoreColor(categoryAvg)}`}>
                            {categoryAvg}
                          </span>
                          <div className="flex gap-2 text-xs">
                            {okCount > 0 && (
                              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                ✓ {okCount}
                              </span>
                            )}
                            {warnCount > 0 && (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                ⚠ {warnCount}
                              </span>
                            )}
                            {failCount > 0 && (
                              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                                ✗ {failCount}
                              </span>
                            )}
                          </div>
                        </div>
                        <svg
                          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Category Checks */}
                      {isExpanded && (
                        <div className="p-6 space-y-4 bg-white">
                          {categoryChecks.map((check) => (
                            <div
                              key={check.id}
                              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
                            >
                              {/* Check header */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                      {check.id}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${STATUS_COLORS[check.status]}`}>
                                      {STATUS_ICONS[check.status]} {check.status.toUpperCase()}
                                    </span>
                                    {check.impact && (
                                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${IMPACT_COLORS[check.impact]}`}>
                                        {check.impact} Impact
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-base font-medium text-gray-900 mb-1">
                                    {check.criteria?.title || check.id}
                                  </h4>
                                  {check.criteria?.description && (
                                    <p className="text-sm text-gray-600 mb-2">
                                      {check.criteria.description}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right ml-4">
                                  <div className={`text-3xl font-bold ${getScoreColor(check.score)}`}>
                                    {check.score}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    / 100
                                  </div>
                                </div>
                              </div>

                              {/* Check details */}
                              {check.details && Object.keys(check.details).length > 0 && (
                                <div className="bg-gray-50 rounded p-3 mb-3">
                                  <div className="text-xs font-medium text-gray-700 mb-1">Details:</div>
                                  <div className="text-xs text-gray-600 space-y-1">
                                    {Object.entries(check.details).map(([key, value]) => (
                                      <div key={key} className="flex gap-2">
                                        <span className="font-medium">{key}:</span>
                                        <span className="break-all">
                                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Evidence */}
                              {check.evidence && check.evidence.length > 0 && (
                                <div className="bg-blue-50 rounded p-3">
                                  <div className="text-xs font-medium text-blue-900 mb-1">Evidence:</div>
                                  <div className="text-xs text-blue-800 space-y-1">
                                    {check.evidence.map((ev, idx) => (
                                      <div key={idx} className="break-all">{ev}</div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Why it matters & how to fix */}
                              {(check.criteria?.why_it_matters || check.criteria?.how_to_fix) && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  {check.criteria.why_it_matters && (
                                    <div className="mb-2">
                                      <span className="text-xs font-medium text-gray-700">Why it matters:</span>
                                      <p className="text-xs text-gray-600 mt-1">{check.criteria.why_it_matters}</p>
                                    </div>
                                  )}
                                  {check.criteria.how_to_fix && check.status !== 'ok' && (
                                    <div>
                                      <span className="text-xs font-medium text-gray-700">How to fix:</span>
                                      <p className="text-xs text-gray-600 mt-1">{check.criteria.how_to_fix}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {productionChecks.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No diagnostic checks available for this page.</p>
                    <p className="text-sm mt-2">Checks may still be processing.</p>
                  </div>
                )}
              </div>
            )}

            {/* Metadata Tab */}
            {activeTab === 'metadata' && (
              <div>
                {/* Basic Metadata */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Metadata</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Title</dt>
                        <dd className="text-sm text-gray-900 mt-1">{page.title || 'Not found'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">H1</dt>
                        <dd className="text-sm text-gray-900 mt-1">{page.h1 || 'Not found'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Canonical</dt>
                        <dd className="text-sm text-gray-900 mt-1 break-all">{page.canonical || 'Not found'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Content Type</dt>
                        <dd className="text-sm text-gray-900 mt-1">{page.content_type || 'Not found'}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Schema Types */}
                {schemaTypes.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Schema Types</h3>
                    <div className="flex flex-wrap gap-2">
                      {schemaTypes.map((type, index) => (
                        <span key={index} className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* JSON-LD */}
                {jsonld.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">JSON-LD Schema</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <pre className="text-xs text-gray-600 overflow-x-auto">
                        {JSON.stringify(jsonld, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HTML Analysis Tab */}
            {activeTab === 'html' && (
              <div>
                {/* HTML Preview */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">HTML Preview</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="mb-4">
                      <span className="text-sm text-gray-600">
                        Static HTML (first 1000 characters)
                      </span>
                    </div>
                    <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                      {page.html_static?.slice(0, 1000) || 'No HTML content'}
                      {page.html_static && page.html_static.length > 1000 && '\n\n... (truncated)'}
                    </pre>
                  </div>
                  
                  {page.html_rendered && (
                    <div className="mt-4 bg-gray-50 rounded-lg p-4">
                      <div className="mb-4">
                        <span className="text-sm text-gray-600">
                          Rendered HTML (first 1000 characters)
                        </span>
                      </div>
                      <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                        {page.html_rendered.slice(0, 1000)}
                        {page.html_rendered.length > 1000 && '\n\n... (truncated)'}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
