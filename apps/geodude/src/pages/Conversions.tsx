import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import Shell from '../components/Shell';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE, FETCH_OPTS } from '../config';

// Type definitions
interface ConversionSummary {
  totals: {
    conversions: number;
    ai_attributed: number;
    non_ai: number;
    revenue_cents: number;
  };
  by_source: Array<{
    slug: string;
    name: string;
    conversions: number;
    revenue_cents: number;
  }>;
  top_content: Array<{
    content_id: number;
    url: string;
    conversions: number;
    revenue_cents: number;
  }>;
  timeseries: Array<{
    ts: string;
    conversions: number;
    ai_attributed: number;
    revenue_cents: number;
  }>;
}

interface ConversionItem {
  content_id: number;
  url: string;
  source_slug: string | null;
  source_name: string | null;
  last_seen: string;
  conversions: number;
  revenue_cents: number;
  assists: Array<{
    slug: string;
    count: number;
  }>;
}

const Conversions = () => {
    const { project } = useAuth();
    const [summary, setSummary] = useState<ConversionSummary | null>(null);
    const [conversions, setConversions] = useState<ConversionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [window, setWindow] = useState('7d');
    const [source, setSource] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [total, setTotal] = useState(0);

    // Load window preference from localStorage
    useEffect(() => {
      if (project?.id) {
        const storageKey = `conversions_window_${project.id}`;
        const savedWindow = localStorage.getItem(storageKey);
        if (savedWindow && savedWindow !== window) {
          setWindow(savedWindow);
        }
      }
    }, [project?.id]);

    // Save window preference to localStorage
    useEffect(() => {
      if (project?.id) {
        const storageKey = `conversions_window_${project.id}`;
        localStorage.setItem(storageKey, window);
      }
    }, [project?.id, window]);

    const fetchSummary = async () => {
        if (!project?.id) return;
        try {
            const response = await fetch(`${API_BASE}/api/conversions/summary?project_id=${project.id}&window=${window}`, FETCH_OPTS);
            if (!response.ok) throw new Error('Failed to load conversions summary');
            const data = await response.json();
            setSummary(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load conversions summary');
        }
    };

    const fetchConversions = async () => {
        if (!project?.id) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                project_id: project.id,
                window,
                page: page.toString(),
                pageSize: pageSize.toString()
            });
            if (source) params.append('source', source);
            if (search) params.append('q', search);

            const response = await fetch(`${API_BASE}/api/conversions?${params}`, FETCH_OPTS);
            if (!response.ok) throw new Error('Failed to load conversions');
            const data = await response.json();
            setConversions(data.items || []);
            setTotal(data.total || 0);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load conversions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
        fetchConversions();
    }, [window, source, search, page]);

    const handleWindowChange = (newWindow: string) => {
        setWindow(newWindow);
        setPage(1);
    };

    const handleSourceChange = (newSource: string) => {
        setSource(newSource);
        setPage(1);
    };

    const handleSearchChange = (query: string) => {
        setSearch(query);
        setPage(1);
    };

    const handlePageChange = (url: string) => {
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const newPage = parseInt(urlParams.get('page') || '1');
        setPage(newPage);
    };

    const formatTimestamp = (timestamp: string) => {
        return new Date(timestamp).toLocaleDateString();
    };

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(cents / 100);
    };

    const formatSource = (slug: string | null) => {
        if (!slug) return '—';
        return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, ' ');
    };

    const handleRowClick = (source: string | null, contentId: number) => {
        // This would open a detail drawer
        console.log('Opening detail for:', { source, contentId });
    };

    if (loading) {
        return (
            <Shell>
                <div className="flex items-center justify-center h-64">
                    <div className="text-lg">Loading conversions...</div>
                </div>
            </Shell>
        );
    }

    if (error) {
        return (
            <Shell>
                <div className="flex items-center justify-center h-64">
                    <div className="text-lg text-red-600">Error: {error}</div>
                </div>
            </Shell>
        );
    }

    return (
        <Shell>
            <div>
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Conversions</h1>
                    <p className="mt-2 text-gray-600">Track and analyze your conversion performance</p>
                </div>

                {/* KPI Cards */}
                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <Card>
                            <div className="p-6">
                                <h3 className="text-sm font-medium text-gray-500">Total Conversions</h3>
                                <p className="mt-2 text-3xl font-bold text-gray-900">{summary.totals.conversions}</p>
                                <p className="mt-1 text-sm text-gray-600">Last {window}</p>
                            </div>
                        </Card>
                        <Card>
                            <div className="p-6">
                                <h3 className="text-sm font-medium text-gray-500">AI-Attributed</h3>
                                <p className="mt-2 text-3xl font-bold text-blue-600">{summary.totals.ai_attributed}</p>
                                <p className="mt-1 text-sm text-gray-600">
                                    {summary.totals.conversions > 0 
                                        ? Math.round((summary.totals.ai_attributed / summary.totals.conversions) * 100)
                                        : 0}%
                                </p>
                            </div>
                        </Card>
                        <Card>
                            <div className="p-6">
                                <h3 className="text-sm font-medium text-gray-500">Revenue</h3>
                                <p className="mt-2 text-3xl font-bold text-green-600">
                                    {formatCurrency(summary.totals.revenue_cents)}
                                </p>
                                <p className="mt-1 text-sm text-gray-600">Last {window}</p>
                            </div>
                        </Card>
                        <Card>
                            <div className="p-6">
                                <h3 className="text-sm font-medium text-gray-500">Top AI Source</h3>
                                <p className="mt-2 text-3xl font-bold text-purple-600">
                                    {summary.by_source.length > 0 ? summary.by_source[0].name : '—'}
                                </p>
                                <p className="mt-1 text-sm text-gray-600">
                                    {summary.by_source.length > 0 ? summary.by_source[0].conversions : 0} conversions
                                </p>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-6 mb-8">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Time Window</label>
                            <div className="flex space-x-2">
                                {['24h', '7d', '30d'].map((w) => (
                                    <button
                                        key={w}
                                        onClick={() => handleWindowChange(w)}
                                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                                            window === w
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {w}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">AI Source</label>
                            <select
                                value={source}
                                onChange={(e) => handleSourceChange(e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                                <option value="">All Sources</option>
                                {summary?.by_source.map((s) => (
                                    <option key={s.slug} value={s.slug}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Search URLs</label>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                placeholder="Search content URLs..."
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Conversions Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900">Conversions</h3>
                    </div>
                    {conversions.length > 0 ? (
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
                                            Conversions
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Revenue
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Assists
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {conversions.map((item, idx) => (
                                        <tr 
                                            key={`${item.content_id}-${item.source_slug || 'non-ai'}`}
                                            className="hover:bg-gray-50 cursor-pointer"
                                            onClick={() => handleRowClick(item.source_slug, item.content_id)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                    item.source_slug 
                                                        ? 'bg-blue-100 text-blue-800' 
                                                        : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {formatSource(item.source_slug)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900 truncate max-w-xs">
                                                    {item.url}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatTimestamp(item.last_seen)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {item.conversions}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {formatCurrency(item.revenue_cents)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {item.assists.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.assists.map((assist, idx) => (
                                                            <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                {assist.slug} ({assist.count})
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-6 text-center">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
                                <div className="flex items-center justify-center mb-4">
                                    <svg className="h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-medium text-blue-800 mb-2">
                                    {summary?.totals.conversions === 0 ? "No conversion data yet" : "No conversions found"}
                                </h3>
                                <p className="text-blue-700 mb-4">
                                    {summary?.totals.conversions === 0 
                                        ? "No conversions have been tracked yet. Conversions are events that indicate business value, such as purchases, sign-ups, or form submissions."
                                        : "No conversions match your current filters."
                                    }
                                </p>

                            </div>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {total > pageSize && (
                    <div className="mt-8 flex items-center justify-between">
                        <div className="text-sm text-gray-700">
                            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} results
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page === 1}
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(page + 1)}
                                disabled={page * pageSize >= total}
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Shell>
    );
};

export default Conversions;
