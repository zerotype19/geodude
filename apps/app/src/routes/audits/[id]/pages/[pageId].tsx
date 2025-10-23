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
  ok: 'bg-success-soft text-success border-success',
  warn: 'bg-warn-soft text-warn border-warn',
  fail: 'bg-danger-soft text-danger border-danger',
  error: 'bg-surface-2 text-gray-800 border-border',
  not_applicable: 'bg-surface-2 muted border-border'
};

const STATUS_ICONS = {
  ok: '',
  warn: '',
  fail: '',
  error: '',
  not_applicable: ''
};

const IMPACT_COLORS = {
  High: 'bg-danger-soft text-danger',
  Medium: 'bg-warn-soft text-warn',
  Low: 'bg-brand-soft text-brand'
};

export default function PageDetail() {
  const { id, pageId } = useParams<{ id: string; pageId: string }>();
  const [page, setPage] = useState<PageDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'checks' | 'metadata' | 'html'>('checks');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set() // Start with all categories collapsed
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
      <div className="min-h-screen bg-surface-2 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 muted">Loading page details...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center">
        <div className="text-center">
          <div className="text-danger mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium  mb-2">Error Loading Page</h3>
          <p className="muted mb-4">{error || 'Page not found'}</p>
          <Link
            to={`/audits/${id}/pages`}
            className="bg-brand hover:bg-brand text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Back to Pages
          </Link>
        </div>
      </div>
    );
  }

  const pageChecks: CheckResult[] = pageId && diagnostics.pageChecks[pageId] ? diagnostics.pageChecks[pageId] : [];
  const productionChecks = pageChecks.filter(c => !c.preview);
  
  // Filter checks by what they're analyzing
  const schemaMetadataCheckIds = [
    'A2_schema_present', 'A3_semantic_sections', 'A12_entity_graph',
    'C1_title_quality', 'C2_h1_present', 'C3_page_title', 'C5_semantic_richness',
    'A1_answer_first', 'B1_title_h1_alignment'
  ];
  
  const htmlStructureCheckIds = [
    'A3_semantic_sections', 'A5_nav_structure', 'A6_footer_present',
    'C4_faq_present', 'C6_q_and_a_scaffold', 'C7_related_questions',
    'E1_crawlable', 'E2_render_parity', 'F1_meta_viewport', 'F2_images_alt_text'
  ];
  
  const schemaMetadataChecks = productionChecks.filter(c => schemaMetadataCheckIds.includes(c.id));
  const htmlStructureChecks = productionChecks.filter(c => htmlStructureCheckIds.includes(c.id));
  const otherChecks = productionChecks.filter(c => 
    !schemaMetadataCheckIds.includes(c.id) && !htmlStructureCheckIds.includes(c.id)
  );
  
  // Group checks by category for each tab
  const groupChecksByCategory = (checks: CheckResult[]) => {
    return checks.reduce((acc, check) => {
      const criteria = CRITERIA_BY_ID.get(check.id);
      const category = criteria?.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({ ...check, criteria });
      return acc;
    }, {} as Record<string, Array<CheckResult & { criteria?: any }>>);
  };
  
  const checksByCategory = groupChecksByCategory(productionChecks);
  const schemaMetadataByCategory = groupChecksByCategory(schemaMetadataChecks);
  const htmlStructureByCategory = groupChecksByCategory(htmlStructureChecks);

  // Calculate average scores for each tab
  const calculateAvgScore = (checks: CheckResult[]) => {
    return checks.length > 0
      ? Math.round(checks.reduce((sum, c) => sum + c.score, 0) / checks.length)
      : 0;
  };
  
  const avgScore = calculateAvgScore(productionChecks);
  const schemaMetadataScore = calculateAvgScore(schemaMetadataChecks);
  const htmlStructureScore = calculateAvgScore(htmlStructureChecks);

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-success';
    if (score >= 60) return 'text-warn';
    return 'text-danger';
  };

  const schemaTypes = parseSchemaTypes();
  const jsonld = parseJsonld();

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <Link to={`/audits/${id}/pages`} className="text-brand hover:text-brand mb-2 inline-block">
                ← Back to Pages
              </Link>
              <h1 className="text-3xl font-bold ">Page Analysis</h1>
              <p className="mt-2 muted">
                <a href={page.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand break-all">
                  {page.url}
                </a>
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                page.status_code >= 200 && page.status_code < 300 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
              }`}>
                HTTP {page.status_code}
              </span>
            </div>
          </div>
        </div>

        {/* Page Score Card */}
        <div className="bg-surface-1 rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium  mb-1">Page Diagnostic Score</h2>
              <p className="text-sm muted">{productionChecks.length} checks analyzed</p>
            </div>
            <div className={`text-5xl font-bold ${getScoreColor(avgScore)}`}>
              {avgScore}
            </div>
          </div>
          
          {/* Quick status summary */}
          <div className="mt-4 pt-4 border-t border-border flex gap-4 text-sm">
            <div className="muted">
              <span className="font-semibold text-success">{productionChecks.filter(c => c.status === 'ok').length}</span> passing
            </div>
            <div className="muted">
              <span className="font-semibold text-warn">{productionChecks.filter(c => c.status === 'warn').length}</span> warnings
            </div>
            <div className="muted">
              <span className="font-semibold text-danger">{productionChecks.filter(c => c.status === 'fail').length}</span> failing
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-surface-1 shadow rounded-lg">
          <div className="border-b border-border">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: 'checks', label: 'All Diagnostic Checks', count: productionChecks.length, score: avgScore },
                { id: 'metadata', label: 'Schema & Metadata', count: schemaMetadataChecks.length, score: schemaMetadataScore },
                { id: 'html', label: 'HTML Analysis', count: htmlStructureChecks.length, score: htmlStructureScore }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-brand text-brand'
                      : 'border-transparent subtle hover:muted hover:border-border'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <>
                      <span className="ml-2 pill pill-brand">
                        {tab.count}
                      </span>
                      {tab.count > 0 && (
                        <span className={`ml-2 text-xs font-bold ${getScoreColor(tab.score)}`}>
                          {tab.score}
                        </span>
                      )}
                    </>
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
                    <div key={category} className="border border-border rounded-lg overflow-hidden">
                      {/* Category Header */}
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full px-6 py-4 bg-surface-2 hover:bg-surface-2 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-base font-medium ">{category}</span>
                          <span className={`text-2xl font-bold ${getScoreColor(categoryAvg)}`}>
                            {categoryAvg}
                          </span>
                          <div className="flex gap-2 text-xs">
                            {okCount > 0 && (
                              <span className="bg-success-soft text-success px-2 py-0.5 rounded-full text-xs font-semibold">
                                {okCount} passing
                              </span>
                            )}
                            {warnCount > 0 && (
                              <span className="bg-warn-soft text-warn px-2 py-0.5 rounded-full text-xs font-semibold">
                                {warnCount} warnings
                              </span>
                            )}
                            {failCount > 0 && (
                              <span className="bg-danger-soft text-danger px-2 py-0.5 rounded-full text-xs font-semibold">
                                {failCount} failing
                              </span>
                            )}
                          </div>
                        </div>
                        <svg
                          className={`w-5 h-5 subtle transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Category Checks */}
                      {isExpanded && (
                        <div className="p-6 space-y-4 bg-surface-1">
                          {categoryChecks.map((check) => (
                            <div
                              key={check.id}
                              className="border border-border rounded-lg p-4 hover:shadow-md transition-all"
                            >
                              {/* Check header */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  {/* Title first - user-friendly */}
                                  <h4 className="text-lg font-bold  mb-2 leading-tight">
                                    {check.criteria?.title || check.id}
                                  </h4>
                                  {check.criteria?.description && (
                                    <p className="text-base muted mb-3 leading-relaxed">
                                      {check.criteria.description}
                                    </p>
                                  )}
                                  {/* Status and impact badges below description */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border-2 ${STATUS_COLORS[check.status]}`}>
                                      {STATUS_ICONS[check.status]} {check.status === 'ok' ? 'Passing' : check.status === 'warn' ? 'Warning' : 'Needs Attention'}
                                    </span>
                                    {check.impact && (
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${IMPACT_COLORS[check.impact]}`}>
                                        {check.impact} Priority
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right ml-4 flex-shrink-0">
                                  <div className={`text-4xl font-bold ${getScoreColor(check.score)}`}>
                                    {check.score}
                                  </div>
                                  <div className="text-xs subtle">
                                    out of 100
                                  </div>
                                </div>
                              </div>

                              {/* Check details */}
                              {check.details && Object.keys(check.details).length > 0 && (
                                <div className="bg-surface-2 rounded p-3 mb-3">
                                  <div className="text-xs font-medium muted mb-1">Details:</div>
                                  <div className="text-xs muted space-y-1">
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
                                <div className="bg-brand-soft rounded p-3">
                                  <div className="text-xs font-medium text-brand mb-1">Evidence:</div>
                                  <div className="text-xs text-brand space-y-1">
                                    {check.evidence.map((ev, idx) => (
                                      <div key={idx} className="break-all">{ev}</div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Why it matters & how to fix */}
                              {(check.criteria?.why_it_matters || check.criteria?.how_to_fix) && (
                                <div className="mt-3 pt-3 border-t border-border">
                                  {check.criteria.why_it_matters && (
                                    <div className="mb-2">
                                      <span className="text-xs font-medium muted">Why it matters:</span>
                                      <p className="text-xs muted mt-1">{check.criteria.why_it_matters}</p>
                                    </div>
                                  )}
                                  {check.criteria.how_to_fix && check.status !== 'ok' && (
                                    <div>
                                      <span className="text-xs font-medium muted">How to fix:</span>
                                      <p className="text-xs muted mt-1">{check.criteria.how_to_fix}</p>
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
                  <div className="text-center py-12 subtle">
                    <p>No diagnostic checks available for this page.</p>
                    <p className="text-sm mt-2">Checks may still be processing.</p>
                  </div>
                )}
              </div>
            )}

            {/* Metadata Tab */}
            {activeTab === 'metadata' && (
              <div>
                {/* Metadata Diagnostic Checks */}
                <div className="space-y-4">
                  {CATEGORY_ORDER.filter(cat => schemaMetadataByCategory[cat] && schemaMetadataByCategory[cat].length > 0).map((category) => {
                    const categoryChecks = schemaMetadataByCategory[category] || [];
                    const isExpanded = expandedCategories.has(category);
                    const categoryAvg = Math.round(
                      categoryChecks.reduce((sum, c) => sum + c.score, 0) / categoryChecks.length
                    );
                    const failCount = categoryChecks.filter(c => c.status === 'fail').length;
                    const warnCount = categoryChecks.filter(c => c.status === 'warn').length;
                    const okCount = categoryChecks.filter(c => c.status === 'ok').length;

                    return (
                      <div key={category} className="border border-border rounded-lg">
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full px-4 py-3 bg-surface-2 hover:bg-surface-3 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{category}</span>
                            <span className="text-sm muted">{categoryChecks.length} checks</span>
                            <span className={`text-sm font-bold ${getScoreColor(categoryAvg)}`}>{categoryAvg}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex gap-2 text-xs">
                              {okCount > 0 && <span className="text-success">{okCount} ok</span>}
                              {warnCount > 0 && <span className="text-warn">{warnCount} warn</span>}
                              {failCount > 0 && <span className="text-danger">{failCount} fail</span>}
                            </div>
                            <svg
                              className={`w-5 h-5 muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-4 space-y-3">
                            {categoryChecks.map((check: any) => (
                              <div key={check.id} className={`p-4 rounded-lg border ${STATUS_COLORS[check.status]}`}>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-sm mb-1">
                                      {check.criteria?.label || check.id}
                                    </h4>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="tag">{check.criteria?.category || 'Uncategorized'}</span>
                                      {check.criteria?.impact_level && (
                                        <span className={`pill ${IMPACT_COLORS[check.criteria.impact_level]}`}>
                                          {check.criteria.impact_level}
                                        </span>
                                      )}
                                      <span className="text-xs muted">Score: {Math.round(check.score)}</span>
                                    </div>
                                    {check.details && Object.keys(check.details).length > 0 && (
                                      <div className="text-xs muted mb-2">
                                        {Object.entries(check.details).map(([key, value]: [string, any]) => (
                                          <div key={key}>
                                            <span className="font-medium">{key}:</span> {JSON.stringify(value)}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className={`text-2xl font-bold ${getScoreColor(check.score)}`}>
                                      {Math.round(check.score)}
                                    </div>
                                  </div>
                                </div>

                                {check.evidence && check.evidence.length > 0 && (
                                  <div className="mt-2">
                                    <span className="text-xs font-medium muted">Evidence:</span>
                                    <div className="text-xs text-brand space-y-1">
                                      {check.evidence.map((ev, idx) => (
                                        <div key={idx} className="break-all">{ev}</div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {(check.criteria?.why_it_matters || check.criteria?.how_to_fix) && (
                                  <div className="mt-3 pt-3 border-t border-border">
                                    {check.criteria.why_it_matters && (
                                      <div className="mb-2">
                                        <span className="text-xs font-medium muted">Why it matters:</span>
                                        <p className="text-xs muted mt-1">{check.criteria.why_it_matters}</p>
                                      </div>
                                    )}
                                    {check.criteria.how_to_fix && check.status !== 'ok' && (
                                      <div>
                                        <span className="text-xs font-medium muted">How to fix:</span>
                                        <p className="text-xs muted mt-1">{check.criteria.how_to_fix}</p>
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
                  
                  {schemaMetadataChecks.length === 0 && (
                    <div className="text-center py-12 subtle">
                      <p>No schema & metadata checks available for this page.</p>
                    </div>
                  )}
                </div>

                {/* Current Values */}
                <div className="mt-8 card card-body">
                  <h3 className="section-title mb-4">Current Values</h3>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium subtle">Title</dt>
                      <dd className="text-sm mt-1">{page.title || 'Not found'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium subtle">H1</dt>
                      <dd className="text-sm mt-1">{page.h1 || 'Not found'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium subtle">Canonical</dt>
                      <dd className="text-sm mt-1 break-all">{page.canonical || 'Not found'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium subtle">Schema Types</dt>
                      <dd className="text-sm mt-1">
                        {schemaTypes.length > 0 ? schemaTypes.join(', ') : 'None found'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}

            {/* HTML Analysis Tab */}
            {activeTab === 'html' && (
              <div>
                {/* HTML Structure Diagnostic Checks */}
                <div className="space-y-4 mb-8">
                  {CATEGORY_ORDER.filter(cat => htmlStructureByCategory[cat] && htmlStructureByCategory[cat].length > 0).map((category) => {
                    const categoryChecks = htmlStructureByCategory[category] || [];
                    const isExpanded = expandedCategories.has(category);
                    const categoryAvg = Math.round(
                      categoryChecks.reduce((sum, c) => sum + c.score, 0) / categoryChecks.length
                    );
                    const failCount = categoryChecks.filter(c => c.status === 'fail').length;
                    const warnCount = categoryChecks.filter(c => c.status === 'warn').length;
                    const okCount = categoryChecks.filter(c => c.status === 'ok').length;

                    return (
                      <div key={category} className="border border-border rounded-lg">
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full px-4 py-3 bg-surface-2 hover:bg-surface-3 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{category}</span>
                            <span className="text-sm muted">{categoryChecks.length} checks</span>
                            <span className={`text-sm font-bold ${getScoreColor(categoryAvg)}`}>{categoryAvg}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex gap-2 text-xs">
                              {okCount > 0 && <span className="text-success">{okCount} ok</span>}
                              {warnCount > 0 && <span className="text-warn">{warnCount} warn</span>}
                              {failCount > 0 && <span className="text-danger">{failCount} fail</span>}
                            </div>
                            <svg
                              className={`w-5 h-5 muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-4 space-y-3">
                            {categoryChecks.map((check: any) => (
                              <div key={check.id} className={`p-4 rounded-lg border ${STATUS_COLORS[check.status]}`}>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-sm mb-1">
                                      {check.criteria?.label || check.id}
                                    </h4>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="tag">{check.criteria?.category || 'Uncategorized'}</span>
                                      {check.criteria?.impact_level && (
                                        <span className={`pill ${IMPACT_COLORS[check.criteria.impact_level]}`}>
                                          {check.criteria.impact_level}
                                        </span>
                                      )}
                                      <span className="text-xs muted">Score: {Math.round(check.score)}</span>
                                    </div>
                                    {check.details && Object.keys(check.details).length > 0 && (
                                      <div className="text-xs muted mb-2">
                                        {Object.entries(check.details).map(([key, value]: [string, any]) => (
                                          <div key={key}>
                                            <span className="font-medium">{key}:</span> {JSON.stringify(value)}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className={`text-2xl font-bold ${getScoreColor(check.score)}`}>
                                      {Math.round(check.score)}
                                    </div>
                                  </div>
                                </div>

                                {check.evidence && check.evidence.length > 0 && (
                                  <div className="mt-2">
                                    <span className="text-xs font-medium muted">Evidence:</span>
                                    <div className="text-xs text-brand space-y-1">
                                      {check.evidence.map((ev, idx) => (
                                        <div key={idx} className="break-all">{ev}</div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {(check.criteria?.why_it_matters || check.criteria?.how_to_fix) && (
                                  <div className="mt-3 pt-3 border-t border-border">
                                    {check.criteria.why_it_matters && (
                                      <div className="mb-2">
                                        <span className="text-xs font-medium muted">Why it matters:</span>
                                        <p className="text-xs muted mt-1">{check.criteria.why_it_matters}</p>
                                      </div>
                                    )}
                                    {check.criteria.how_to_fix && check.status !== 'ok' && (
                                      <div>
                                        <span className="text-xs font-medium muted">How to fix:</span>
                                        <p className="text-xs muted mt-1">{check.criteria.how_to_fix}</p>
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
                  
                  {htmlStructureChecks.length === 0 && (
                    <div className="text-center py-12 subtle">
                      <p>No HTML analysis checks available for this page.</p>
                    </div>
                  )}
                </div>

                {/* HTML Preview */}
                <div className="card card-body">
                  <h3 className="section-title mb-4">HTML Preview</h3>
                  <div className="card-muted rounded-xl p-4">
                    <div className="mb-4">
                      <span className="text-sm muted">
                        Static HTML (first 1000 characters)
                      </span>
                    </div>
                    <pre className="text-xs muted overflow-x-auto whitespace-pre-wrap">
                      {page.html_static?.slice(0, 1000) || 'No HTML content'}
                      {page.html_static && page.html_static.length > 1000 && '\n\n... (truncated)'}
                    </pre>
                  </div>
                  
                  {page.html_rendered && (
                    <div className="mt-4 bg-surface-2 rounded-lg p-4">
                      <div className="mb-4">
                        <span className="text-sm muted">
                          Rendered HTML (first 1000 characters)
                        </span>
                      </div>
                      <pre className="text-xs muted overflow-x-auto whitespace-pre-wrap">
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
