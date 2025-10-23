import React, { useState, useEffect } from 'react';
import { apiGet } from '../../../../lib/api';
import { useParams, Link } from 'react-router-dom';
import CheckPill from '/src/components/CheckPill';
import { getCheckMeta } from '/src/content/checks';
import PageChecksTable from '/src/components/PageChecksTable';
import { useAuditDiagnostics } from '/src/hooks/useAuditDiagnostics';

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
  has_answer_box: number;
  has_jump_links: number;
  facts_block: number;
  references_block: number;
  tables_count: number;
  outbound_links: number;
  author_json?: string;
  org_json?: string;
  robots_ai_policy?: string;
  parity_pass: number;
  aeo_score?: number;
  geo_score?: number;
  checks_json?: string;
  analyzed_at: string;
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

const API_BASE = 'https://api.optiview.ai';

export default function PageDetail() {
  const { id, pageId } = useParams<{ id: string; pageId: string }>();
  const [page, setPage] = useState<PageDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'checks' | 'schema' | 'html'>('checks');
  
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

  const getCheckScoreText = (score: number) => {
    switch (score) {
      case 3: return 'Exceeds';
      case 2: return 'Meets';
      case 1: return 'Partial';
      case 0: return 'Missing';
      default: return 'Unknown';
    }
  };

  const getCheckDescription = (id: string) => {
    const meta = getCheckMeta(id);
    return meta.description || meta.label || 'Unknown check';
  };

  const parseChecks = (): CheckResult[] => {
    if (!page?.checks_json) return [];
    
    try {
      return JSON.parse(page.checks_json);
    } catch (e) {
      return [];
    }
  };

  const parseRobotsPolicy = () => {
    if (!page?.robots_ai_policy) return {};
    
    try {
      return JSON.parse(page.robots_ai_policy);
    } catch (e) {
      return {};
    }
  };

  const parseAuthor = () => {
    if (!page?.author_json) return null;
    
    try {
      return JSON.parse(page.author_json);
    } catch (e) {
      return null;
    }
  };

  const parseOrg = () => {
    if (!page?.org_json) return null;
    
    try {
      return JSON.parse(page.org_json);
    } catch (e) {
      return null;
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

  const parseSchemaTypes = () => {
    if (!page?.schema_types) return [];
    
    try {
      return JSON.parse(page.schema_types);
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

  const checks = parseChecks();
  const robotsPolicy = parseRobotsPolicy();
  const author = parseAuthor();
  const org = parseOrg();
  const jsonld = parseJsonld();
  const schemaTypes = parseSchemaTypes();

  const aeoChecks = checks.filter(c => c.id.startsWith('A'));
  const geoChecks = checks.filter(c => c.id.startsWith('G'));

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
                <a href={page.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
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

        {/* Score Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Diagnostic Score */}
          {pageId && diagnostics.pageChecks[pageId] && (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-lg">D</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Diagnostic Score</dt>
                      <dd className={`text-3xl font-semibold ${
                        diagnostics.pageChecks[pageId]
                          ? getScoreColor(
                              Math.round(
                                diagnostics.pageChecks[pageId]
                                  .filter((c) => !c.preview)
                                  .reduce((sum, c) => sum + c.score, 0) /
                                  diagnostics.pageChecks[pageId].filter((c) => !c.preview).length
                              )
                            )
                          : 'text-gray-500'
                      }`}>
                        {diagnostics.pageChecks[pageId]
                          ? Math.round(
                              diagnostics.pageChecks[pageId]
                                .filter((c) => !c.preview)
                                .reduce((sum, c) => sum + c.score, 0) /
                                diagnostics.pageChecks[pageId].filter((c) => !c.preview).length
                            )
                          : 'N/A'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AEO Score (Legacy) */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">A</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">AEO Score (Legacy)</dt>
                    <dd className={`text-3xl font-semibold ${getScoreColor(page.aeo_score)}`}>
                      {page.aeo_score ? Math.round(page.aeo_score) : 'N/A'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* GEO Score (Legacy) */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">G</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">GEO Score (Legacy)</dt>
                    <dd className={`text-3xl font-semibold ${getScoreColor(page.geo_score)}`}>
                      {page.geo_score ? Math.round(page.geo_score) : 'N/A'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: 'checks', label: 'Check Results', count: checks.length },
                { id: 'schema', label: 'Schema & Metadata', count: schemaTypes.length },
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
              <div>
                {/* AEO Checks */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">AEO (Answer Engine Optimization)</h3>
                  <div className="overflow-visible">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evidence</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {aeoChecks.map((check) => (
                          <tr key={check.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <CheckPill 
                                code={check.id} 
                                weight={check.weight} 
                                score={check.score}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCheckScoreColor(check.score)}`}>
                                {check.score}/3 - {getCheckScoreText(check.score)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {check.weight}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {getCheckDescription(check.id)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {check.evidence?.details || 'No evidence provided'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* GEO Checks */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">GEO (Generative Engine Optimization)</h3>
                  <div className="overflow-visible">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evidence</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {geoChecks.map((check) => (
                          <tr key={check.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <CheckPill 
                                code={check.id} 
                                weight={check.weight} 
                                score={check.score}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCheckScoreColor(check.score)}`}>
                                {check.score}/3 - {getCheckScoreText(check.score)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {check.weight}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {getCheckDescription(check.id)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {check.evidence?.details || 'No evidence provided'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Schema & Metadata Tab */}
            {activeTab === 'schema' && (
              <div>
                {/* Basic Metadata */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Metadata</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Title</dt>
                        <dd className="text-sm text-gray-900">{page.title || 'Not found'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">H1</dt>
                        <dd className="text-sm text-gray-900">{page.h1 || 'Not found'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Canonical</dt>
                        <dd className="text-sm text-gray-900">{page.canonical || 'Not found'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Content Type</dt>
                        <dd className="text-sm text-gray-900">{page.content_type || 'Not found'}</dd>
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

                {/* Author & Organization */}
                {(author || org) && (
                  <div className="mb-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Author & Organization</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      {author && (
                        <div className="mb-4">
                          <h4 className="font-medium text-gray-900">Author</h4>
                          <pre className="text-xs text-gray-600 mt-2 overflow-x-auto">
                            {JSON.stringify(author, null, 2)}
                          </pre>
                        </div>
                      )}
                      {org && (
                        <div>
                          <h4 className="font-medium text-gray-900">Organization</h4>
                          <pre className="text-xs text-gray-600 mt-2 overflow-x-auto">
                            {JSON.stringify(org, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Robots Policy */}
                {Object.keys(robotsPolicy).length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">AI Crawler Policy</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <pre className="text-xs text-gray-600 overflow-x-auto">
                        {JSON.stringify(robotsPolicy, null, 2)}
                      </pre>
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
                {/* Content Analysis */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Content Analysis</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Answer Box</dt>
                        <dd className="text-sm text-gray-900">{page.has_answer_box ? '✓ Found' : '✗ Missing'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Jump Links</dt>
                        <dd className="text-sm text-gray-900">{page.has_jump_links ? '✓ Found' : '✗ Missing'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Facts Block</dt>
                        <dd className="text-sm text-gray-900">{page.facts_block ? '✓ Found' : '✗ Missing'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">References Block</dt>
                        <dd className="text-sm text-gray-900">{page.references_block ? '✓ Found' : '✗ Missing'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Tables Count</dt>
                        <dd className="text-sm text-gray-900">{page.tables_count}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Outbound Links</dt>
                        <dd className="text-sm text-gray-900">{page.outbound_links}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Parity Pass</dt>
                        <dd className="text-sm text-gray-900">{page.parity_pass ? '✓ Passed' : '✗ Failed'}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

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
