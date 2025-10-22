import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../lib/api';

interface CitationSummary {
  bySource: Array<{
    ai_source: string;
    total_queries: number;
    cited_queries: number;
    cited_percentage: number;
    last_run: string;
  }>;
}

interface CitationSummaryCardProps {
  auditId: string;
}

const SOURCE_ICONS: Record<string, string> = {
  perplexity: '🔍',
  chatgpt: '🤖',
  claude: '🧠',
  brave: '🦁'
};

const SOURCE_NAMES: Record<string, string> = {
  perplexity: 'Perplexity',
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  brave: 'Brave AI'
};

export default function CitationSummaryCard({ auditId }: CitationSummaryCardProps) {
  const [summary, setSummary] = useState<CitationSummary | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!summary || !summary.bySource || summary.bySource.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">📊</span>
          <h3 className="text-lg font-semibold text-gray-900">AI Citation Testing</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Test how often AI assistants cite your site when answering relevant queries.
        </p>
        <Link
          to={`/audits/${auditId}?tab=citations`}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
        >
          Run Citation Test →
        </Link>
      </div>
    );
  }

  // Calculate overall stats
  const totalQueries = summary.bySource.reduce((sum, s) => sum + s.total_queries, 0);
  const totalCited = summary.bySource.reduce((sum, s) => sum + s.cited_queries, 0);
  const overallPercentage = totalQueries > 0 ? Math.round((totalCited / totalQueries) * 100) : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <h3 className="text-lg font-semibold text-gray-900">Citation Performance</h3>
        </div>
        <Link
          to={`/audits/${auditId}?tab=citations`}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          View Details →
        </Link>
      </div>

      {/* Overall Stats */}
      <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Overall Citation Rate</p>
            <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
              {overallPercentage}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Cited</p>
            <p className="text-2xl font-semibold text-gray-900">
              {totalCited}/{totalQueries}
            </p>
          </div>
        </div>
      </div>

      {/* By Source */}
      <div className="space-y-2">
        {summary.bySource.map((source) => {
          const icon = SOURCE_ICONS[source.ai_source] || '🤖';
          const name = SOURCE_NAMES[source.ai_source] || source.ai_source;
          const percentage = Math.round(source.cited_percentage);
          
          return (
            <div key={source.ai_source} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">{icon}</span>
                <span className="text-sm font-medium text-gray-700">{name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {source.cited_queries}/{source.total_queries}
                </span>
                <span className={`text-sm font-semibold ${
                  percentage >= 70 ? 'text-green-600' :
                  percentage >= 40 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

