import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import Shell from '../components/Shell';
import { Card } from '../components/ui/Card';

const Conversions = () => {
    const [summary, setSummary] = useState(null);
    const [conversions, setConversions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Filters
    const [window, setWindow] = useState('7d');
    const [source, setSource] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [total, setTotal] = useState(0);
    
    // Mock project ID for now - in real app this would come from context/auth
    const projectId = 'prj_test';

    const fetchSummary = async () => {
        try {
            const response = await fetch(`/api/conversions/summary?project_id=${projectId}&window=${window}`);
            if (!response.ok) throw new Error('Failed to fetch summary');
            const data = await response.json();
            setSummary(data);
        } catch (err) {
            console.error('Error fetching summary:', err);
            setError('Failed to load conversions summary');
        }
    };

    const fetchConversions = async () => {
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
            
            const response = await fetch(`/api/conversions?${params}`);
            if (!response.ok) throw new Error('Failed to fetch conversions');
            const data = await response.json();
            setConversions(data.items);
            setTotal(data.total);
        } catch (err) {
            console.error('Error fetching conversions:', err);
            setError('Failed to load conversions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, [window]);

    useEffect(() => {
        fetchConversions();
    }, [window, source, searchQuery, page]);

    const handleWindowChange = (newWindow) => {
        setWindow(newWindow);
        setPage(1);
    };

    const handleSourceChange = (newSource) => {
        setSource(newSource);
        setPage(1);
    };

    const handleSearch = (query) => {
        setSearchQuery(query);
        setPage(1);
    };

    const formatUrl = (url) => {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname || urlObj.hostname;
        } catch {
            return url;
        }
    };

    const formatLastSeen = (timestamp) => {
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

    const formatRevenue = (cents) => {
        if (!cents) return '—';
        return `$${(cents / 100).toFixed(2)}`;
    };

    const getSourceBadgeColor = (slug) => {
        if (!slug) return 'bg-gray-100 text-gray-800';
        switch (slug) {
            case 'openai_chatgpt': return 'bg-green-100 text-green-800';
            case 'anthropic_claude': return 'bg-orange-100 text-orange-800';
            case 'perplexity': return 'bg-blue-100 text-blue-800';
            case 'google_gemini': return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getSourceDisplay = (source) => {
        if (!source || source === 'non_ai') return { name: '—', slug: null };
        return { name: source, slug: source };
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
                        <h1 className="text-2xl font-bold text-gray-900">Conversions</h1>
                        <p className="text-gray-600">Track conversions and AI attribution</p>
                    </div>
                    <a href="/docs/conversions" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View Docs →
                    </a>
                </div>

                {/* KPI Cards */}
                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-900">
                                    {summary.totals.conversions}
                                </div>
                                <div className="text-sm text-gray-600">Conversions</div>
                                <div className="text-xs text-gray-500 mt-1">{window}</div>
                            </div>
                        </Card>
                        
                        <Card>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-900">
                                    {summary.totals.ai_attributed}
                                </div>
                                <div className="text-sm text-gray-600">AI-Attributed</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {summary.totals.conversions > 0 
                                        ? `${((summary.totals.ai_attributed / summary.totals.conversions) * 100).toFixed(1)}%`
                                        : '0%'
                                    }
                                </div>
                            </div>
                        </Card>
                        
                        <Card>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-900">
                                    {formatRevenue(summary.totals.revenue_cents)}
                                </div>
                                <div className="text-sm text-gray-600">Revenue</div>
                                <div className="text-xs text-gray-500 mt-1">{window}</div>
                            </div>
                        </Card>
                        
                        <Card>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-900">
                                    {summary.by_source[0]?.name || 'None'}
                                </div>
                                <div className="text-sm text-gray-600">Top AI Source</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {summary.by_source[0]?.conversions || 0} conversions
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700">Window:</span>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            {['24h', '7d', '30d'].map((w) => (
                                <button
                                    key={w}
                                    onClick={() => handleWindowChange(w)}
                                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                        window === w
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    {w}
                                </button>
                            ))}
                        </div>
                    </div>
                    
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

                {/* Conversions Table */}
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
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : conversions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                            No conversions found in the selected window.
                                        </td>
                                    </tr>
                                ) : (
                                    conversions.map((conversion) => {
                                        const sourceDisplay = getSourceDisplay(conversion.source_slug);
                                        return (
                                            <tr key={`${conversion.content_id}-${conversion.source_slug || 'non_ai'}`} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {sourceDisplay.slug ? (
                                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSourceBadgeColor(sourceDisplay.slug)}`}>
                                                            {sourceDisplay.name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="max-w-xs truncate" title={conversion.url}>
                                                        {formatUrl(conversion.url)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatLastSeen(conversion.last_seen)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {conversion.conversions}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {formatRevenue(conversion.revenue_cents)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {conversion.assists && conversion.assists.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {conversion.assists.map((assist, idx) => (
                                                                <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                    {assist.slug} ({assist.count})
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
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
                {!loading && conversions.length === 0 && summary?.totals.conversions === 0 && (
                    <div className="text-center py-12">
                        <div className="text-gray-400 text-6xl mb-4">💰</div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No conversions yet</h3>
                        <p className="text-gray-600 mb-4">
                            Conversions will appear here when you start tracking them. Add conversion tracking to your checkout or lead forms.
                        </p>
                        <a href="/docs/conversions" className="text-blue-600 hover:text-blue-800 font-medium">
                            Learn how to add conversion tracking →
                        </a>
                    </div>
                )}
            </div>
        </Shell>
    );
};

export default Conversions;
