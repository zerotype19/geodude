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
      <div className="card card-body">
        <div className="animate-pulse">
          <div className="h-4 bg-surface-3 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            <div className="h-8 bg-surface-3 rounded"></div>
            <div className="h-8 bg-surface-3 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!summary || !summary.bySource || summary.bySource.length === 0) {
    return (
      <div className="card card-body">
        <h3 className="section-title mb-2">AI Citation Testing</h3>
        <p className="text-sm muted mb-4">
          Test how often AI assistants cite your site when answering relevant queries.
        </p>
        <Link
          to={`/audits/${auditId}?tab=citations`}
          className="btn-primary"
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

  const getScoreColor = (percentage: number) => {
    if (percentage >= 70) return 'text-success';
    if (percentage >= 40) return 'text-warn';
    return 'text-danger';
  };

  return (
    <div className="card card-body">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">Citation Performance</h3>
        <Link
          to={`/audits/${auditId}?tab=citations`}
          className="text-sm text-brand hover:underline font-medium"
        >
          View Details →
        </Link>
      </div>

      {/* Overall Stats */}
      <div className="mb-6 card-muted rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium subtle uppercase tracking-wide mb-1">Overall Citation Rate</p>
            <p className={`text-4xl font-bold ${getScoreColor(overallPercentage)}`}>
              {overallPercentage}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium subtle uppercase tracking-wide mb-1">Cited Queries</p>
            <p className="text-2xl font-bold">
              {totalCited}<span className="text-lg subtle">/{totalQueries}</span>
            </p>
          </div>
        </div>
      </div>

      {/* By Source */}
      <div className="space-y-3">
        {summary.bySource.map((source) => {
          const name = SOURCE_NAMES[source.ai_source] || source.ai_source;
          const percentage = Math.round(source.cited_percentage);
          
          return (
            <div key={source.ai_source} className="flex items-center justify-between py-3 px-4 card-muted rounded-lg">
              <div className="flex items-center gap-3">
                <span className="font-medium">{name}</span>
                <span className="text-xs subtle">
                  {source.cited_queries}/{source.total_queries} queries
                </span>
              </div>
              <span className={`text-lg font-bold ${getScoreColor(percentage)}`}>
                {percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

