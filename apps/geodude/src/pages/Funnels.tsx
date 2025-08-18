import React, { useState, useEffect } from 'react';
import Shell from '../components/Shell';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';

interface FunnelSummary {
  totals: {
    referrals: number;
    conversions: number;
    conv_rate: number;
  };
  by_source: Array<{
    slug: string;
    name: string;
    referrals: number;
    conversions: number;
    conv_rate: number;
    p50_ttc_min: number | null;
    p90_ttc_min: number | null;
  }>;
  timeseries: Array<{
    ts: string;
    referrals: number;
  }>;
}

interface FunnelItem {
  content_id: number;
  url: string;
  source_slug: string;
  source_name: string;
  referrals: number;
  conversions: number;
  conv_rate: number;
  p50_ttc_min: number | null;
  p90_ttc_min: number | null;
  last_referral: string;
  last_conversion: string;
}

interface FunnelDetail {
  content: {
    id: number;
    url: string;
  };
  source: {
    slug: string;
    name: string;
  };
  summary: {
    referrals: number;
    conversions: number;
    conv_rate: number;
    p50_ttc_min: number | null;
    p90_ttc_min: number | null;
  };
  timeseries: Array<{
    ts: string;
    referrals: number;
    conversions: number;
  }>;
  recent: Array<{
    ref_detected_at: string;
    conversion_at: string;
    ttc_min: number;
    amount_cents: number | null;
    currency: string;
  }>;
}

const API_BASE = 'https://api.optiview.ai';

export default function Funnels() {
  const { user, project } = useAuth();
  const [summary, setSummary] = useState<FunnelSummary | null>(null);
  const [items, setItems] = useState<FunnelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination
  const [window, setWindow] = useState<'15m' | '24h' | '7d'>('7d');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'conv_rate_desc' | 'conversions_desc' | 'referrals_desc' | 'last_conversion_desc'>('conv_rate_desc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);

  // Detail drawer
  const [selectedItem, setSelectedItem] = useState<FunnelItem | null>(null);
  const [detail, setDetail] = useState<FunnelDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Get project ID from project context
  const projectId = project?.id || 'prj_cTSh3LZ8qMVZ'; // fallback to known project ID

  // Load window preference from localStorage
  useEffect(() => {
    if (project?.id) {
      const storageKey = `funnels_window_${project.id}`;
      const savedWindow = localStorage.getItem(storageKey) as '15m' | '24h' | '7d';
      if (savedWindow && savedWindow !== window) {
        setWindow(savedWindow);
      }
    }
  }, [project?.id]);

  // Save window preference to localStorage
  useEffect(() => {
    if (project?.id) {
      const storageKey = `funnels_window_${project.id}`;
      localStorage.setItem(storageKey, window);
    }
  }, [project?.id, window]);

  useEffect(() => {
    fetchSummary();
    fetchItems();
  }, [window, source, search, sort, page]);

  const fetchSummary = async () => {
    try {
      const params = new URLSearchParams({
        project_id: projectId,
        window
      });

      const response = await fetch(`${API_BASE}/api/funnels/summary?${params}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch summary');

      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error('Error fetching summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch summary');
    }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        project_id: projectId,
        window,
        source,
        q: search,
        sort,
        page: page.toString(),
        pageSize: pageSize.toString()
      });

      const response = await fetch(`${API_BASE}/api/funnels?${params}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch items');

      const data = await response.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error fetching items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (item: FunnelItem) => {
    try {
      setDetailLoading(true);
      const params = new URLSearchParams({
        project_id: projectId,
        content_id: item.content_id.toString(),
        source: item.source_slug,
        window
      });

      const response = await fetch(`${API_BASE}/api/funnels/detail?${params}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch detail');

      const data = await response.json();
      setDetail(data);
    } catch (err) {
      console.error('Error fetching detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRowClick = (item: FunnelItem) => {
    setSelectedItem(item);
    fetchDetail(item);
  };

  const closeDetail = () => {
    setSelectedItem(null);
    setDetail(null);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatTTC = (minutes: number | null) => {
    if (minutes === null) return 'N/A';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (cents: number | null, currency: string) => {
    if (cents === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(cents / 100);
  };

  if (error) {
    return (
      <Shell>
        <div>
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Funnels (AI → Page → Conversion)</h1>
              <p className="mt-2 text-sm text-gray-600">
                Track conversion funnels from AI referrals to page conversions
              </p>
            </div>
            <a
              href="/docs"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Docs →
            </a>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Window selector */}
            <div className="flex rounded-md shadow-sm">
              {(['15m', '24h', '7d'] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setWindow(w)}
                  className={`px-4 py-2 text-sm font-medium ${window === w
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:text-gray-500 border border-gray-300'
                    } ${w === '15m' ? 'rounded-l-md' : ''} ${w === '7d' ? 'rounded-r-md' : ''} ${w !== '15m' && w !== '7d' ? 'border-l-0' : ''
                    }`}
                >
                  {w}
                </button>
              ))}
            </div>

            {/* Source filter */}
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Sources</option>
              {summary?.by_source.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Search */}
            <input
              type="text"
              placeholder="Search URLs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="conv_rate_desc">Conv Rate (High to Low)</option>
              <option value="conversions_desc">Conversions (High to Low)</option>
              <option value="referrals_desc">Referrals (High to Low)</option>
              <option value="last_conversion_desc">Last Conversion (Recent)</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{summary.totals.referrals.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Referrals ({window})</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{summary.totals.conversions.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Conversions ({window})</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {(summary.totals.conv_rate * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500">Conv Rate ({window})</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {summary.by_source.length > 0 && summary.by_source[0].p50_ttc_min
                    ? formatTTC(summary.by_source[0].p50_ttc_min)
                    : 'N/A'}
                </div>
                <div className="text-sm text-gray-500">Fastest TTC p50</div>
              </div>
            </Card>
          </div>
        )}

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
                    Referrals
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Conversions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Conv Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    p50 TTC
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    p90 TTC
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Conv
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                      No funnels yet in this window. Try a longer window or generate test referrals/conversions.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={`${item.content_id}-${item.source_slug}`}
                      onClick={() => handleRowClick(item)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.source_name}</div>
                        <div className="text-sm text-gray-500">{item.source_slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 truncate max-w-xs">{item.url}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.referrals.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.conversions.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(item.conv_rate * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTTC(item.p50_ttc_min)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTTC(item.p90_ttc_min)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.last_conversion ? formatTime(item.last_conversion) : 'N/A'}
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
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page * pageSize >= total}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Detail Drawer */}
        {selectedItem && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedItem.source_name} → {selectedItem.url}
                  </h3>
                  <button
                    onClick={closeDetail}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {detailLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : detail ? (
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{detail.summary.referrals}</div>
                        <div className="text-sm text-gray-500">Referrals</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{detail.summary.conversions}</div>
                        <div className="text-sm text-gray-500">Conversions</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {(detail.summary.conv_rate * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-500">Conv Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {formatTTC(detail.summary.p50_ttc_min)}
                        </div>
                        <div className="text-sm text-gray-500">p50 TTC</div>
                      </div>
                    </div>

                    {/* Timeseries */}
                    {detail.timeseries.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Performance Over Time</h4>
                        <div className="space-y-2">
                          {detail.timeseries.map((ts, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-600">{ts.ts}</span>
                              <span className="text-gray-900">
                                {ts.referrals} refs, {ts.conversions} convs
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Pairs */}
                    {detail.recent.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Referral → Conversion Pairs</h4>
                        <div className="space-y-2">
                          {detail.recent.map((pair, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                              <div>
                                <div className="text-gray-600">
                                  {formatTime(pair.ref_detected_at)} → {formatTime(pair.conversion_at)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  TTC: {formatTTC(pair.ttc_min)}
                                </div>
                              </div>
                              {pair.amount_cents && (
                                <div className="text-right">
                                  <div className="font-medium text-gray-900">
                                    {formatCurrency(pair.amount_cents, pair.currency)}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Links */}
                    <div className="flex space-x-4 pt-4 border-t">
                      <a
                        href={`/referrals?content_id=${detail.content.id}&source=${detail.source.slug}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View Referrals →
                      </a>
                      <a
                        href={`/conversions?content_id=${detail.content.id}&source=${detail.source.slug}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View Conversions →
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">Failed to load details</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
