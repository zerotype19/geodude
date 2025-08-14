import { jsx as _jsx_1, jsxs as _jsxs_1 } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import Shell from '../components/Shell';
import { Card } from '../components/ui/Card';
const Conversions = () => {
    const [summary, setSummary] = useState(null);
    const [conversions, setConversions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [window, setWindow] = useState('7d');
    const [source, setSource] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [total, setTotal] = useState(0);
    const [projectId] = useState('test_project'); // This should come from auth context
    const fetchSummary = async () => {
        try {
            const response = await fetch(`https://api.optiview.ai/api/conversions/summary?project_id=${projectId}&window=${window}`);
            if (!response.ok)
                throw new Error('Failed to load conversions summary');
            const data = await response.json();
            setSummary(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load conversions summary');
        }
    };
    const fetchConversions = async () => {
        try {
            const params = new URLSearchParams({
                project_id: projectId,
                window,
                page: page.toString(),
                pageSize: pageSize.toString()
            });
            if (source)
                params.append('source', source);
            if (search)
                params.append('q', search);
            const response = await fetch(`https://api.optiview.ai/api/conversions?${params}`);
            if (!response.ok)
                throw new Error('Failed to load conversions');
            const data = await response.json();
            setConversions(data.items || []);
            setTotal(data.total || 0);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load conversions');
        }
    };
    useEffect(() => {
        fetchSummary();
        fetchConversions();
    }, [window, source, search, page]);
    const handleWindowChange = (newWindow) => {
        setWindow(newWindow);
        setPage(1);
    };
    const handleSourceChange = (newSource) => {
        setSource(newSource);
        setPage(1);
    };
    const handleSearchChange = (query) => {
        setSearch(query);
        setPage(1);
    };
    const handlePageChange = (url) => {
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const newPage = parseInt(urlParams.get('page') || '1');
        setPage(newPage);
    };
    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleDateString();
    };
    const formatCurrency = (cents) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(cents / 100);
    };
    const formatSource = (slug) => {
        if (!slug)
            return '—';
        return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, ' ');
    };
    const handleRowClick = (source, contentId) => {
        // This would open a detail drawer
        console.log('Opening detail for:', { source, contentId });
    };
    if (loading) {
        return (_jsx_1(Shell, { children: _jsx_1("div", { className: "flex items-center justify-center h-64", children: _jsx_1("div", { className: "text-lg", children: "Loading conversions..." }) }) }));
    }
    if (error) {
        return (_jsx_1(Shell, { children: _jsx_1("div", { className: "flex items-center justify-center h-64", children: _jsxs_1("div", { className: "text-lg text-red-600", children: ["Error: ", error] }) }) }));
    }
    return (_jsx_1(Shell, { children: _jsxs_1("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: [_jsxs_1("div", { className: "mb-8", children: [_jsx_1("h1", { className: "text-3xl font-bold text-gray-900", children: "Conversions" }), _jsx_1("p", { className: "mt-2 text-gray-600", children: "Track and analyze your conversion performance" })] }), summary && (_jsxs_1("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8", children: [_jsx_1(Card, { children: _jsxs_1("div", { className: "p-6", children: [_jsx_1("h3", { className: "text-sm font-medium text-gray-500", children: "Total Conversions" }), _jsx_1("p", { className: "mt-2 text-3xl font-bold text-gray-900", children: summary.totals.conversions }), _jsxs_1("p", { className: "mt-1 text-sm text-gray-600", children: ["Last ", window] })] }) }), _jsx_1(Card, { children: _jsxs_1("div", { className: "p-6", children: [_jsx_1("h3", { className: "text-sm font-medium text-gray-500", children: "AI-Attributed" }), _jsx_1("p", { className: "mt-2 text-3xl font-bold text-blue-600", children: summary.totals.ai_attributed }), _jsxs_1("p", { className: "mt-1 text-sm text-gray-600", children: [summary.totals.conversions > 0
                                                ? Math.round((summary.totals.ai_attributed / summary.totals.conversions) * 100)
                                                : 0, "%"] })] }) }), _jsx_1(Card, { children: _jsxs_1("div", { className: "p-6", children: [_jsx_1("h3", { className: "text-sm font-medium text-gray-500", children: "Revenue" }), _jsx_1("p", { className: "mt-2 text-3xl font-bold text-green-600", children: formatCurrency(summary.totals.revenue_cents) }), _jsxs_1("p", { className: "mt-1 text-sm text-gray-600", children: ["Last ", window] })] }) }), _jsx_1(Card, { children: _jsxs_1("div", { className: "p-6", children: [_jsx_1("h3", { className: "text-sm font-medium text-gray-500", children: "Top AI Source" }), _jsx_1("p", { className: "mt-2 text-3xl font-bold text-purple-600", children: summary.by_source.length > 0 ? summary.by_source[0].name : '—' }), _jsxs_1("p", { className: "mt-1 text-sm text-gray-600", children: [summary.by_source.length > 0 ? summary.by_source[0].conversions : 0, " conversions"] })] }) })] })), _jsx_1("div", { className: "bg-white rounded-lg shadow p-6 mb-8", children: _jsxs_1("div", { className: "flex flex-wrap gap-4 items-center", children: [_jsxs_1("div", { children: [_jsx_1("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Time Window" }), _jsx_1("div", { className: "flex space-x-2", children: ['24h', '7d', '30d'].map((w) => (_jsx_1("button", { onClick: () => handleWindowChange(w), className: `px-3 py-1 rounded-md text-sm font-medium ${window === w
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: w }, w))) })] }), _jsxs_1("div", { children: [_jsx_1("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "AI Source" }), _jsxs_1("select", { value: source, onChange: (e) => handleSourceChange(e.target.value), className: "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm", children: [_jsx_1("option", { value: "", children: "All Sources" }), summary?.by_source.map((s) => (_jsx_1("option", { value: s.slug, children: s.name }, s.slug)))] })] }), _jsxs_1("div", { className: "flex-1", children: [_jsx_1("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Search URLs" }), _jsx_1("input", { type: "text", value: search, onChange: (e) => handleSearchChange(e.target.value), placeholder: "Search content URLs...", className: "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" })] })] }) }), _jsxs_1("div", { className: "bg-white rounded-lg shadow overflow-hidden", children: [_jsx_1("div", { className: "px-6 py-4 border-b border-gray-200", children: _jsx_1("h3", { className: "text-lg font-medium text-gray-900", children: "Conversions" }) }), conversions.length > 0 ? (_jsx_1("div", { className: "overflow-x-auto", children: _jsxs_1("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx_1("thead", { className: "bg-gray-50", children: _jsxs_1("tr", { children: [_jsx_1("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Source" }), _jsx_1("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "URL" }), _jsx_1("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Last Seen" }), _jsx_1("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Conversions" }), _jsx_1("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Revenue" }), _jsx_1("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Assists" })] }) }), _jsx_1("tbody", { className: "bg-white divide-y divide-gray-200", children: conversions.map((item, idx) => (_jsxs_1("tr", { className: "hover:bg-gray-50 cursor-pointer", onClick: () => handleRowClick(item.source_slug, item.content_id), children: [_jsx_1("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx_1("span", { className: `inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.source_slug
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-gray-100 text-gray-800'}`, children: formatSource(item.source_slug) }) }), _jsx_1("td", { className: "px-6 py-4", children: _jsx_1("div", { className: "text-sm text-gray-900 truncate max-w-xs", children: item.url }) }), _jsx_1("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: formatTimestamp(item.last_seen) }), _jsx_1("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: item.conversions }), _jsx_1("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: formatCurrency(item.revenue_cents) }), _jsx_1("td", { className: "px-6 py-4 whitespace-nowrap", children: item.assists.length > 0 ? (_jsx_1("div", { className: "flex flex-wrap gap-1", children: item.assists.map((assist, idx) => (_jsxs_1("span", { className: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800", children: [assist.slug, " (", assist.count, ")"] }, idx))) })) : (_jsx_1("span", { className: "text-gray-400", children: "\u2014" })) })] }, `${item.content_id}-${item.source_slug || 'non-ai'}`))) })] }) })) : (_jsxs_1("div", { className: "text-center py-12", children: [_jsx_1("div", { className: "text-gray-400 mb-4", children: _jsx_1("svg", { className: "mx-auto h-12 w-12", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx_1("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" }) }) }), _jsx_1("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "No conversions yet" }), _jsx_1("p", { className: "text-gray-500 mb-4", children: summary?.totals.conversions === 0
                                        ? "Start tracking conversions to see data here."
                                        : "No conversions match your current filters." }), _jsx_1("a", { href: "/docs/conversions", className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700", children: "View Documentation" })] }))] }), total > pageSize && (_jsxs_1("div", { className: "mt-8 flex items-center justify-between", children: [_jsxs_1("div", { className: "text-sm text-gray-700", children: ["Showing ", ((page - 1) * pageSize) + 1, " to ", Math.min(page * pageSize, total), " of ", total, " results"] }), _jsxs_1("div", { className: "flex space-x-2", children: [_jsx_1("button", { onClick: () => setPage(Math.max(1, page - 1)), disabled: page === 1, className: "px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed", children: "Previous" }), _jsx_1("button", { onClick: () => setPage(page + 1), disabled: page * pageSize >= total, className: "px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed", children: "Next" })] })] }))] }) }));
};
export default Conversions;
