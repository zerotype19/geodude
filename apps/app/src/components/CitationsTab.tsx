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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Run Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Citations Analytics</h2>
          <p className="text-sm text-gray-600">
            Visibility across AI sources • Last run: {summary?.bySource[0]?.last_run || 'Never'}
            {' '}
            <a 
              href="/help/citations" 
              className="text-blue-600 hover:text-blue-800 underline"
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
          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            running
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {running ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
            <div key={source.ai_source} className="bg-white p-4 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 capitalize">{source.ai_source}</p>
                  <p className="text-2xl font-bold text-gray-900">{source.cited_percentage.toFixed(1)}%</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">
                    {source.ai_source.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {source.cited_queries}/{source.total_queries} queries cited
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Query Type Breakdown (Branded vs Non-Branded) */}
      {summary?.byType && summary.byType.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Query Type Performance</h3>
          <p className="text-sm text-gray-600 mb-4">
            Compare how well you're cited in branded searches (mentioning your name) vs non-branded topic searches
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {summary.byType.map((type) => (
              <div key={type.query_type} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-semibold text-gray-800 capitalize">
                    {type.query_type.replace('-', ' ')} Queries
                  </h4>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    type.query_type === 'branded' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {type.query_type === 'branded' ? '🏷️ Brand' : '🌐 Topic'}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Citation Rate:</span>
                    <span className="text-2xl font-bold text-gray-900">{type.cited_percentage.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Queries Cited:</span>
                    <span className="text-sm font-medium text-gray-700">{type.cited_queries}/{type.total_queries}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Citations:</span>
                    <span className="text-sm font-medium text-gray-700">{type.total_citations}</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        type.query_type === 'branded' ? 'bg-purple-600' : 'bg-green-600'
                      }`}
                      style={{ width: `${type.cited_percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Cited URLs */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Top Cited URLs</h3>
          <p className="text-sm text-gray-600">Your pages that are being cited</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  URL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Citations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Seen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {summary?.topCitedUrls.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                    No cited URLs found. Run citations to discover visibility.
                  </td>
                </tr>
              ) : (
                summary?.topCitedUrls.map((url, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a
                        href={url.first_match_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm truncate max-w-xs block"
                      >
                        {url.first_match_url}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {url.citation_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">✅ Queries Citing Your Domain</h3>
              <p className="text-sm text-gray-600">Where you're already appearing</p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              {summary?.topCitingQueries.length || 0} queries
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Query
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sources
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {summary?.topCitingQueries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                    No citing queries found. Run citations to discover results.
                  </td>
                </tr>
              ) : (
                summary?.topCitingQueries.map((query, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-md truncate">
                        {query.query}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {query.ai_sources.split(', ').map((source, idx) => (
                          <span key={idx} className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {source}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => viewAnswer(query)}
                        className="text-blue-600 hover:text-blue-800 underline"
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
        <div className="bg-white shadow rounded-lg border-2 border-orange-200">
          <div className="px-6 py-4 border-b border-orange-200 bg-orange-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">⚠️ Missing Opportunities</h3>
                <p className="text-sm text-gray-600">Queries where you're NOT appearing (but should be)</p>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                {summary.missingQueries.length} queries
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Query
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tested On
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {summary.missingQueries.map((query, index) => (
                  <tr key={index} className="hover:bg-orange-50">
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-md">
                        {query.query}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        query.query_type === 'branded' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {query.query_type || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {query.ai_sources.split(', ').map((source, idx) => (
                          <span key={idx} className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                            {source}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
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
                        className="text-orange-600 hover:text-orange-800 underline"
                      >
                        Why Not?
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-orange-50 border-t border-orange-200">
            <p className="text-sm text-gray-600">
              💡 <strong>These are high-priority content gaps.</strong> Create or optimize content targeting these queries to improve your AI visibility.
            </p>
          </div>
        </div>
      )}

      {/* Answer Modal */}
      {showDrawer && selectedQuery && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowDrawer(false)}></div>
          <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Query Details</h3>
                <button
                  onClick={() => setShowDrawer(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Query</label>
                  <p className="text-base text-gray-900 p-3 bg-gray-50 rounded-md">{selectedQuery.query}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sources</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedQuery.ai_sources.split(', ').map((source: string, idx: number) => (
                      <span key={idx} className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Total Citations</label>
                  <p className="text-base text-gray-900">{selectedQuery.total_citations} matches found across all sources</p>
                </div>
                {selectedQuery.source_answers && selectedQuery.source_answers.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Answers by Source</label>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {selectedQuery.source_answers.map((sourceAnswer: any, idx: number) => (
                        <div key={idx} className="p-4 bg-gray-50 rounded-md border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              From {sourceAnswer.ai_source}
                            </span>
                            <span className="text-xs text-gray-600">
                              {sourceAnswer.cited_match_count} citation{sourceAnswer.cited_match_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                            {sourceAnswer.answer_excerpt}
                          </p>
                          {sourceAnswer.cited_urls && JSON.parse(sourceAnswer.cited_urls).length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-300">
                              <p className="text-xs font-semibold text-gray-700 mb-2">Cited URLs:</p>
                              <ul className="space-y-1">
                                {JSON.parse(sourceAnswer.cited_urls).slice(0, 5).map((url: string, urlIdx: number) => (
                                  <li key={urlIdx}>
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:text-blue-800 break-all"
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
                    <p className="mt-2 text-xs text-gray-500">
                      Scroll to see all source responses. Citations extracted from AI source responses.
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Last Tested</label>
                  <p className="text-sm text-gray-600">{new Date(selectedQuery.last_occurred).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
