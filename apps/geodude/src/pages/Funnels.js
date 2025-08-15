import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import Shell from '../components/Shell';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
const API_BASE = 'https://api.optiview.ai';
export default function Funnels() {
    const { user, project } = useAuth();
    const [summary, setSummary] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Filters and pagination
    const [window, setWindow] = useState('7d');
    const [source, setSource] = useState('');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('conv_rate_desc');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [total, setTotal] = useState(0);
    // Detail drawer
    const [selectedItem, setSelectedItem] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    // Get project ID from project context
    const projectId = project?.id || 'prj_cTSh3LZ8qMVZ'; // fallback to known project ID
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
            if (!response.ok)
                throw new Error('Failed to fetch summary');
            const data = await response.json();
            setSummary(data);
        }
        catch (err) {
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
            if (!response.ok)
                throw new Error('Failed to fetch items');
            const data = await response.json();
            setItems(data.items || []);
            setTotal(data.total || 0);
        }
        catch (err) {
            console.error('Error fetching items:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch items');
        }
        finally {
            setLoading(false);
        }
    };
    const fetchDetail = async (item) => {
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
            if (!response.ok)
                throw new Error('Failed to fetch detail');
            const data = await response.json();
            setDetail(data);
        }
        catch (err) {
            console.error('Error fetching detail:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch detail');
        }
        finally {
            setDetailLoading(false);
        }
    };
    const handleRowClick = (item) => {
        setSelectedItem(item);
        fetchDetail(item);
    };
    const closeDetail = () => {
        setSelectedItem(null);
        setDetail(null);
    };
    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };
    const formatTTC = (minutes) => {
        if (minutes === null)
            return 'N/A';
        if (minutes < 60)
            return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };
    const formatCurrency = (cents, currency) => {
        if (cents === null)
            return 'N/A';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD'
        }).format(cents / 100);
    };
    if (error) {
        return (_jsx(Shell, { children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: _jsx("div", { className: "bg-red-50 border border-red-200 rounded-md p-4", children: _jsx("div", { className: "flex", children: _jsxs("div", { className: "ml-3", children: [_jsx("h3", { className: "text-sm font-medium text-red-800", children: "Error" }), _jsx("div", { className: "mt-2 text-sm text-red-700", children: error })] }) }) }) }) }));
    }
    return (_jsx(Shell, { children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: [_jsx("div", { className: "mb-8", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "Funnels (AI \u2192 Page \u2192 Conversion)" }), _jsx("p", { className: "mt-2 text-sm text-gray-600", children: "Track conversion funnels from AI referrals to page conversions" })] }), _jsx("a", { href: "/docs", className: "inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50", children: "Docs \u2192" })] }) }), _jsx("div", { className: "mb-6 space-y-4", children: _jsxs("div", { className: "flex flex-wrap gap-4 items-center", children: [_jsx("div", { className: "flex rounded-md shadow-sm", children: ['15m', '24h', '7d'].map((w) => (_jsx("button", { onClick: () => setWindow(w), className: `px-4 py-2 text-sm font-medium ${window === w
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-700 hover:text-gray-500 border border-gray-300'} ${w === '15m' ? 'rounded-l-md' : ''} ${w === '7d' ? 'rounded-r-md' : ''} ${w !== '15m' && w !== '7d' ? 'border-l-0' : ''}`, children: w }, w))) }), _jsxs("select", { value: source, onChange: (e) => setSource(e.target.value), className: "px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "", children: "All Sources" }), summary?.by_source.map((s) => (_jsx("option", { value: s.slug, children: s.name }, s.slug)))] }), _jsx("input", { type: "text", placeholder: "Search URLs...", value: search, onChange: (e) => setSearch(e.target.value), className: "px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" }), _jsxs("select", { value: sort, onChange: (e) => setSort(e.target.value), className: "px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "conv_rate_desc", children: "Conv Rate (High to Low)" }), _jsx("option", { value: "conversions_desc", children: "Conversions (High to Low)" }), _jsx("option", { value: "referrals_desc", children: "Referrals (High to Low)" }), _jsx("option", { value: "last_conversion_desc", children: "Last Conversion (Recent)" })] })] }) }), summary && (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6 mb-8", children: [_jsx(Card, { children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: summary.totals.referrals.toLocaleString() }), _jsxs("div", { className: "text-sm text-gray-500", children: ["Referrals (", window, ")"] })] }) }), _jsx(Card, { children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: summary.totals.conversions.toLocaleString() }), _jsxs("div", { className: "text-sm text-gray-500", children: ["Conversions (", window, ")"] })] }) }), _jsx(Card, { children: _jsxs("div", { className: "text-center", children: [_jsxs("div", { className: "text-2xl font-bold text-gray-900", children: [(summary.totals.conv_rate * 100).toFixed(1), "%"] }), _jsxs("div", { className: "text-sm text-gray-500", children: ["Conv Rate (", window, ")"] })] }) }), _jsx(Card, { children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: summary.by_source.length > 0 && summary.by_source[0].p50_ttc_min
                                            ? formatTTC(summary.by_source[0].p50_ttc_min)
                                            : 'N/A' }), _jsx("div", { className: "text-sm text-gray-500", children: "Fastest TTC p50" })] }) })] })), _jsxs(Card, { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Source" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "URL" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Referrals" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Conversions" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Conv Rate" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "p50 TTC" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "p90 TTC" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Last Conv" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: loading ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-6 py-4 text-center text-gray-500", children: "Loading..." }) })) : items.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-6 py-4 text-center text-gray-500", children: "No funnels yet in this window. Try a longer window or generate test referrals/conversions." }) })) : (items.map((item) => (_jsxs("tr", { onClick: () => handleRowClick(item), className: "hover:bg-gray-50 cursor-pointer", children: [_jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: item.source_name }), _jsx("div", { className: "text-sm text-gray-500", children: item.source_slug })] }), _jsx("td", { className: "px-6 py-4", children: _jsx("div", { className: "text-sm text-gray-900 truncate max-w-xs", children: item.url }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: item.referrals.toLocaleString() }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: item.conversions.toLocaleString() }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: [(item.conv_rate * 100).toFixed(1), "%"] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: formatTTC(item.p50_ttc_min) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: formatTTC(item.p90_ttc_min) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: item.last_conversion ? formatTime(item.last_conversion) : 'N/A' })] }, `${item.content_id}-${item.source_slug}`)))) })] }) }), total > pageSize && (_jsxs("div", { className: "px-6 py-3 border-t border-gray-200 flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-700", children: ["Showing ", ((page - 1) * pageSize) + 1, " to ", Math.min(page * pageSize, total), " of ", total, " results"] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => setPage(Math.max(1, page - 1)), disabled: page === 1, className: "px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed", children: "Previous" }), _jsx("button", { onClick: () => setPage(page + 1), disabled: page * pageSize >= total, className: "px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed", children: "Next" })] })] }))] }), selectedItem && (_jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50", children: _jsx("div", { className: "relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white", children: _jsxs("div", { className: "mt-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("h3", { className: "text-lg font-medium text-gray-900", children: [selectedItem.source_name, " \u2192 ", selectedItem.url] }), _jsxs("button", { onClick: closeDetail, className: "text-gray-400 hover:text-gray-600", children: [_jsx("span", { className: "sr-only", children: "Close" }), _jsx("svg", { className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })] })] }), detailLoading ? (_jsx("div", { className: "text-center py-8", children: "Loading..." })) : detail ? (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: detail.summary.referrals }), _jsx("div", { className: "text-sm text-gray-500", children: "Referrals" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: detail.summary.conversions }), _jsx("div", { className: "text-sm text-gray-500", children: "Conversions" })] }), _jsxs("div", { className: "text-center", children: [_jsxs("div", { className: "text-2xl font-bold text-gray-900", children: [(detail.summary.conv_rate * 100).toFixed(1), "%"] }), _jsx("div", { className: "text-sm text-gray-500", children: "Conv Rate" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: formatTTC(detail.summary.p50_ttc_min) }), _jsx("div", { className: "text-sm text-gray-500", children: "p50 TTC" })] })] }), detail.timeseries.length > 0 && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-900 mb-2", children: "Performance Over Time" }), _jsx("div", { className: "space-y-2", children: detail.timeseries.map((ts, idx) => (_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-600", children: ts.ts }), _jsxs("span", { className: "text-gray-900", children: [ts.referrals, " refs, ", ts.conversions, " convs"] })] }, idx))) })] })), detail.recent.length > 0 && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-900 mb-2", children: "Recent Referral \u2192 Conversion Pairs" }), _jsx("div", { className: "space-y-2", children: detail.recent.map((pair, idx) => (_jsxs("div", { className: "flex justify-between items-center text-sm p-2 bg-gray-50 rounded", children: [_jsxs("div", { children: [_jsxs("div", { className: "text-gray-600", children: [formatTime(pair.ref_detected_at), " \u2192 ", formatTime(pair.conversion_at)] }), _jsxs("div", { className: "text-xs text-gray-500", children: ["TTC: ", formatTTC(pair.ttc_min)] })] }), pair.amount_cents && (_jsx("div", { className: "text-right", children: _jsx("div", { className: "font-medium text-gray-900", children: formatCurrency(pair.amount_cents, pair.currency) }) }))] }, idx))) })] })), _jsxs("div", { className: "flex space-x-4 pt-4 border-t", children: [_jsx("a", { href: `/referrals?content_id=${detail.content.id}&source=${detail.source.slug}`, className: "text-blue-600 hover:text-blue-800 text-sm", children: "View Referrals \u2192" }), _jsx("a", { href: `/conversions?content_id=${detail.content.id}&source=${detail.source.slug}`, className: "text-blue-600 hover:text-blue-800 text-sm", children: "View Conversions \u2192" })] })] })) : (_jsx("div", { className: "text-center py-8 text-gray-500", children: "Failed to load details" }))] }) }) }))] }) }));
}
