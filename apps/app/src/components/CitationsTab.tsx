import React, { useState, useEffect } from 'react';

interface CitationSummary {
  bySource: Array<{
    ai_source: string;
    total_queries: number;
    cited_queries: number;
    cited_percentage: number;
    last_run: string;
  }>;
  topCitedUrls: Array<{
    first_match_url: string;
    citation_count: number;
    last_seen: string;
  }>;
  topCitingQueries: Array<{
    query: string;
    ai_source: string;
    cited_match_count: number;
    occurred_at: string;
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
  projectId: string;
  domain: string;
}

export default function CitationsTab({ projectId, domain }: CitationsTabProps) {
  const [summary, setSummary] = useState<CitationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState<any>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [projectId, domain]);

  const fetchSummary = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/citations/summary?project_id=${projectId}&domain=${domain}`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch citations summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const runCitations = async () => {
    setRunning(true);
    try {
      const response = await fetch(`${API_BASE}/api/citations/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          domain: domain,
          sources: ['perplexity', 'chatgpt', 'claude', 'brave']
        })
      });

      if (response.ok) {
        const result: CitationRun = await response.json();
        console.log('Citations run result:', result);
        // Refresh summary after run
        await fetchSummary();
      }
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

      {/* Summary Cards */}
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

      {/* Queries Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Query Results</h3>
          <p className="text-sm text-gray-600">Which queries cited your domain</p>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {query.ai_source}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => viewAnswer(query)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View Answer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Answer Drawer */}
      {showDrawer && selectedQuery && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowDrawer(false)}></div>
          <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Answer Details</h3>
                <button
                  onClick={() => setShowDrawer(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Query</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedQuery.query}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Source</label>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {selectedQuery.ai_source}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Citations</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedQuery.cited_match_count} matches found</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
