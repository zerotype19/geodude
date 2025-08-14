import React, { useState, useEffect } from 'react';
import Shell from '../components/Shell';
import { Card } from '../components/ui/Card';

interface ReferralSummary {
  totals: {
    referrals: number;
    contents: number;
    sources: number;
  };
  by_source: Array<{
    slug: string;
    name: string;
    count: number;
  }>;
  top_content: Array<{
    content_id: number;
    url: string;
    count: number;
  }>;
  timeseries: Array<{
    ts: string;
    count: number;
  }>;
}

interface ReferralItem {
  content_id: number;
  url: string;
  source_slug: string;
  source_name: string;
  last_seen: string;
  referrals_15m: number;
  referrals_24h: number;
  share_of_ai: number;
}

const Referrals: React.FC = () => {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [window, setWindow] = useState<'15m' | '24h' | '7d'>('24h');
  const [source, setSource] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);

  // Mock project ID for now - in real app this would come from context/auth
  const projectId = 'prj_test';

  const fetchSummary = async () => {
    try {
      const response = await fetch(`/api/referrals/summary?project_id=${projectId}&window=${window}`);
      if (!response.ok) throw new Error('Failed to fetch summary');
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error('Error fetching summary:', err);
      setError('Failed to load referrals summary');
    }
  };

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        project_id: projectId,
        window,
        page: page.toString(),
        pageSize: pageSize.toString()
      });

      if (source) params.append('source', source);
      if (searchQuery) params.append('q', searchQuery);

      const response = await fetch(`/api/referrals?${params}`);
      if (!response.ok) throw new Error('Failed to fetch referrals');
      const data = await response.json();
      setReferrals(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error('Error fetching referrals:', err);
      setError('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [window]);

  useEffect(() => {
    fetchReferrals();
  }, [window, source, searchQuery, page]);

  const handleWindowChange = (newWindow: '15m' | '24h' | '7d') => {
    setWindow(newWindow);
    setPage(1);
  };

  const handleSourceChange = (newSource: string) => {
    setSource(newSource);
    setPage(1);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname || urlObj.hostname;
    } catch {
      return url;
    }
  };

  const formatLastSeen = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getSourceBadgeColor = (slug: string) => {
    switch (slug) {
      case 'openai_chatgpt': return 'bg-green-100 text-green-800';
      case 'anthropic_claude': return 'bg-orange-100 text-orange-800';
      case 'perplexity': return 'bg-blue-100 text-blue-800';
      case 'google_gemini': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (error) {
    return (
      <Shell>
        <div className="p-6">
          <div className="text-red-600 text-center py-8">{error}</div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Referrals</h1>
            <p className="text-gray-600">Track how AI platforms refer traffic to your content</p>
          </div>
          <a
            href="/docs"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View Docs →
          </a>
        </div>

        {/* KPI Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{summary.totals.referrals}</div>
                <div className="text-sm text-gray-600">Total Referrals</div>
                <div className="text-xs text-gray-500 mt-1">{window}</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{summary.totals.contents}</div>
                <div className="text-sm text-gray-600">Active Pages</div>
                <div className="text-xs text-gray-500 mt-1">with ≥1 referral</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{summary.totals.sources}</div>
                <div className="text-sm text-gray-600">AI Sources</div>
                <div className="text-xs text-gray-500 mt-1">referring traffic</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {summary.by_source[0]?.name || 'None'}
                </div>
                <div className="text-sm text-gray-600">Top Source</div>
                <div className="text-xs text-gray-500 mt-1">
                  {summary.by_source[0]?.count || 0} referrals
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Window Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Window:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['15m', '24h', '7d'] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => handleWindowChange(w)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${window === w
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Source Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Source:</span>
            <select
              value={source}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sources</option>
              {summary?.by_source.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Search:</span>
            <input
              type="text"
              placeholder="Search URLs..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Seen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    15m
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    24h
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Share of AI
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : referrals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No AI referrals found in the selected window.
                    </td>
                  </tr>
                ) : (
                  referrals.map((referral) => (
                    <tr key={`${referral.content_id}-${referral.source_slug}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSourceBadgeColor(referral.source_slug)}`}>
                          {referral.source_name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs truncate" title={referral.url}>
                          {formatUrl(referral.url)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatLastSeen(referral.last_seen)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {referral.referrals_15m}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {referral.referrals_24h}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(referral.share_of_ai * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page * pageSize >= total}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Empty State */}
        {!loading && referrals.length === 0 && summary?.totals.referrals === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🤖</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No AI referrals yet</h3>
            <p className="text-gray-600 mb-4">
              AI referrals will appear here when AI platforms start sending traffic to your content.
            </p>
            <a
              href="/sources"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Check your AI Sources →
            </a>
          </div>
        )}
      </div>
    </Shell>
  );
};

export default Referrals;
