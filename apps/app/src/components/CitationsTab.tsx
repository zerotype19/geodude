import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../lib/api';

interface CitationSummary {
  bySource: Array<{
    ai_source: string;
    total_queries: number;
    cited_queries: number;
    cited_percentage: number;
    last_run: string;
  }>;
  byType?: Array<{
    query_type: string;
    total_queries: number;
    cited_queries: number;
    cited_percentage: number;
    total_citations: number;
  }>;
  topCitedUrls: Array<{
    first_match_url: string;
    citation_count: number;
    last_seen: string;
  }>;
  topCitingQueries: Array<{
    query: string;
    ai_sources: string;
    total_citations: number;
    last_occurred: string;
    sample_answer: string;
  }>;
  missingQueries?: Array<{
    query: string;
    query_type: string;
    ai_sources: string;
    source_count: number;
    last_occurred: string;
    sample_answer: string;
    source_answers: Array<{
      ai_source: string;
      answer_excerpt: string;
      cited_urls: string;
    }>;
  }>;
}

interface CitationRun {
  status: string;
  runId: string;
  totalsBySource: Record<string, { total: number; cited: number }>;
  citedPctBySource: Record<string, number>;
  results: Array<{
    source: string;
    query: string;
    cited: boolean;
    cited_count: number;
  }>;
  errors: string[];
}

const API_BASE = 'https://api.optiview.ai';

interface CitationsTabProps {
  auditId: string;
}

export default function CitationsTab({ auditId }: CitationsTabProps) {
  const [summary, setSummary] = useState<CitationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState<any>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [auditId]);

  const fetchSummary = async () => {
    try {
      const data = await apiGet<CitationSummary>(`/api/citations/summary?audit_id=${auditId}`);
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch citations summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const runCitations = async () => {
    setRunning(true);
    try {
      const result = await apiPost<CitationRun>(`/api/citations/run`, {
        audit_id: auditId,
        project_id: 'default', // Legacy field, can be removed later
        domain: 'placeholder', // Legacy field, can be removed later
        sources: ['perplexity', 'chatgpt', 'claude', 'brave']
      });
      
      console.log('Citations run result:', result);
      // Refresh summary after run
      await fetchSummary();
    } catch (error) {
      console.error('Failed to run citations:', error);
    } finally {
      setRunning(false);
    }
  };

  const viewAnswer = (query: any) => {
    setSelectedQuery(query);
    setShowDrawer(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Run Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Citations Analytics</h2>
          <p className="text-sm muted">
            Visibility across AI sources • Last run: {summary?.bySource[0]?.last_run || 'Never'}
            {' '}
            <a 
              href="/help/citations" 
              className="text-brand hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              How we measure this
            </a>
          </p>
        </div>
        <button
          data-tour="run-citations-button"
          onClick={runCitations}
          disabled={running}
          className={running ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'}
        >
          {running ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              Running...
            </>
          ) : (
            'Run Citations'
          )}
        </button>
      </div>

      {/* Summary Cards by Source */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {summary.bySource.map((source) => (
            <div key={source.ai_source} className="card card-body">
              <div>
                <p className="text-sm font-medium muted capitalize mb-2">{source.ai_source}</p>
                <p className="text-3xl font-bold mb-1">{source.cited_percentage.toFixed(1)}%</p>
                <p className="text-xs subtle">
                  {source.cited_queries}/{source.total_queries} queries cited
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Query Type Breakdown (Branded vs Non-Branded) */}
      {summary?.byType && summary.byType.length > 0 && (
        <div className="card card-body">
          <h3 className="section-title mb-4">Query Type Performance</h3>
          <p className="text-sm muted mb-4">
            Compare how well you're cited in branded searches (mentioning your name) vs non-branded topic searches
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {summary.byType.map((type) => (
              <div key={type.query_type} className="card-muted rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-semibold capitalize">
                    {type.query_type.replace('-', ' ')} Queries
                  </h4>
                  <span className={type.query_type === 'branded' ? 'pill pill-brand' : 'pill pill-success'}>
                    {type.query_type === 'branded' ? 'Brand' : 'Topic'}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm muted">Citation Rate:</span>
                    <span className="text-2xl font-bold">{type.cited_percentage.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm muted">Queries Cited:</span>
                    <span className="text-sm font-medium">{type.cited_queries}/{type.total_queries}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm muted">Total Citations:</span>
                    <span className="text-sm font-medium">{type.total_citations}</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 bar">
                  <span 
                    className={type.query_type === 'branded' ? 'bg-brand' : 'bg-success'}
                    style={{ width: `${type.cited_percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Cited URLs */}
      <div className="card">
        <div className="card-header">
          <h3 className="section-title">Top Cited URLs</h3>
          <p className="text-sm muted">Your pages that are being cited</p>
        </div>
        <div className="table-wrap">
          <table className="ui">
            <thead>
              <tr>
                <th>URL</th>
                <th>Citations</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {summary?.topCitedUrls.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center subtle">
                    No cited URLs found. Run citations to discover visibility.
                  </td>
                </tr>
              ) : (
                summary?.topCitedUrls.map((url, index) => (
                  <tr key={index}>
                    <td>
                      <a
                        href={url.first_match_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:underline text-sm truncate max-w-xs block"
                      >
                        {url.first_match_url}
                      </a>
                    </td>
                    <td className="text-sm">
                      {url.citation_count}
                    </td>
                    <td className="text-sm subtle">
                      {new Date(url.last_seen).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Queries That CITED Your Domain */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="section-title">Queries Citing Your Domain</h3>
              <p className="text-sm muted">Where you're already appearing</p>
            </div>
            <span className="pill pill-success">
              {summary?.topCitingQueries.length || 0} queries
            </span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="ui">
            <thead>
              <tr>
                <th>Query</th>
                <th>Sources</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {summary?.topCitingQueries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center subtle">
                    No citing queries found. Run citations to discover results.
                  </td>
                </tr>
              ) : (
                summary?.topCitingQueries.map((query, index) => (
                  <tr key={index}>
                    <td>
                      <div className="text-sm max-w-md truncate">
                        {query.query}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {query.ai_sources.split(', ').map((source, idx) => (
                          <span key={idx} className="pill pill-success">
                            {source}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-sm">
                      <button
                        onClick={() => viewAnswer(query)}
                        className="text-brand hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Queries That DID NOT Cite Your Domain (Missing Opportunities) */}
      {summary?.missingQueries && summary.missingQueries.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="section-title">Missing Opportunities</h3>
                <p className="text-sm muted">Queries where you're NOT appearing (but should be)</p>
              </div>
              <span className="pill pill-warn">
                {summary.missingQueries.length} queries
              </span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="ui">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Type</th>
                  <th>Tested On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {summary.missingQueries.map((query, index) => (
                  <tr key={index}>
                    <td>
                      <div className="text-sm max-w-md">
                        {query.query}
                      </div>
                    </td>
                    <td>
                      <span className={query.query_type === 'branded' ? 'pill pill-brand' : 'pill pill-brand'}>
                        {query.query_type || 'unknown'}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {query.ai_sources.split(', ').map((source, idx) => (
                          <span key={idx} className="tag">
                            {source}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-sm">
                      <button
                        onClick={() => {
                          // Reuse viewAnswer with missing query data
                          setSelectedQuery({
                            query: query.query,
                            ai_sources: query.ai_sources,
                            total_citations: 0,
                            last_occurred: query.last_occurred,
                            sample_answer: query.sample_answer,
                            source_answers: query.source_answers.map(sa => ({
                              ...sa,
                              cited_match_count: 0
                            }))
                          });
                          setShowDrawer(true);
                        }}
                        className="text-warn hover:underline"
                      >
                        Why Not?
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Answer Modal */}
      {showDrawer && selectedQuery && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDrawer(false)}></div>
          <div className="relative card shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Query Details</h3>
                <button
                  onClick={() => setShowDrawer(false)}
                  className="subtle hover:text-ink transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="field-label">Query</label>
                  <p className="text-base card-muted rounded-xl p-3">{selectedQuery.query}</p>
                </div>
                <div>
                  <label className="field-label">Sources</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedQuery.ai_sources.split(', ').map((source: string, idx: number) => (
                      <span key={idx} className="pill pill-brand">
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label">Total Citations</label>
                  <p className="text-base">{selectedQuery.total_citations} matches found across all sources</p>
                </div>
                {selectedQuery.source_answers && selectedQuery.source_answers.length > 0 && (
                  <div>
                    <label className="field-label">Answers by Source</label>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {selectedQuery.source_answers.map((sourceAnswer: any, idx: number) => (
                        <div key={idx} className="card-muted rounded-xl p-4 border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="pill pill-brand">
                              From {sourceAnswer.ai_source}
                            </span>
                            <span className="text-xs muted">
                              {sourceAnswer.cited_match_count} citation{sourceAnswer.cited_match_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {sourceAnswer.answer_excerpt}
                          </p>
                          {sourceAnswer.cited_urls && JSON.parse(sourceAnswer.cited_urls).length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <p className="text-xs font-semibold muted mb-2">Cited URLs:</p>
                              <ul className="space-y-1">
                                {JSON.parse(sourceAnswer.cited_urls).slice(0, 5).map((url: string, urlIdx: number) => (
                                  <li key={urlIdx}>
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-brand hover:underline break-all"
                                    >
                                      {url}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs subtle">
                      Scroll to see all source responses. Citations extracted from AI source responses.
                    </p>
                  </div>
                )}
                <div>
                  <label className="field-label">Last Tested</label>
                  <p className="text-sm muted">{new Date(selectedQuery.last_occurred).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
