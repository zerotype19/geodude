import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import Shell from '../components/Shell';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
const Referrals = () => {
    const { project } = useAuth();
    const [summary, setSummary] = useState(null);
    const [referrals, setReferrals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Filters
    const [window, setWindow] = useState('24h');
    const [source, setSource] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [total, setTotal] = useState(0);
    // Load window preference from localStorage
    useEffect(() => {
        if (project?.id) {
            const storageKey = `referrals_window_${project.id}`;
            const savedWindow = localStorage.getItem(storageKey);
            if (savedWindow && savedWindow !== window) {
                setWindow(savedWindow);
            }
        }
    }, [project?.id]);
    // Save window preference to localStorage
    useEffect(() => {
        if (project?.id) {
            const storageKey = `referrals_window_${project.id}`;
            localStorage.setItem(storageKey, window);
        }
    }, [project?.id, window]);
    const fetchSummary = async () => {
        if (!project?.id)
            return;
        try {
            const response = await fetch(`/api/referrals/summary?project_id=${project.id}&window=${window}`);
            if (!response.ok)
                throw new Error('Failed to fetch summary');
            const data = await response.json();
            setSummary(data);
        }
        catch (err) {
            console.error('Error fetching summary:', err);
            setError('Failed to load referrals summary');
        }
    };
    const fetchReferrals = async () => {
        if (!project?.id)
            return;
        try {
            setLoading(true);
            const params = new URLSearchParams({
                project_id: project.id,
                window,
                page: page.toString(),
                pageSize: pageSize.toString()
            });
            if (source)
                params.append('source', source);
            if (searchQuery)
                params.append('q', searchQuery);
            const response = await fetch(`/api/referrals?${params}`);
            if (!response.ok)
                throw new Error('Failed to fetch referrals');
            const data = await response.json();
            setReferrals(data.items);
            setTotal(data.total);
        }
        catch (err) {
            console.error('Error fetching referrals:', err);
            setError('Failed to load referrals');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchSummary();
    }, [window]);
    useEffect(() => {
        fetchReferrals();
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
        }
        catch {
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
        if (diffMins < 60)
            return `${diffMins}m ago`;
        if (diffHours < 24)
            return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };
    const getSourceBadgeColor = (slug) => {
        switch (slug) {
            case 'openai_chatgpt': return 'bg-green-100 text-green-800';
            case 'anthropic_claude': return 'bg-orange-100 text-orange-800';
            case 'perplexity': return 'bg-blue-100 text-blue-800';
            case 'google_gemini': return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    if (error) {
        return (_jsx(Shell, { children: _jsx("div", { className: "p-6", children: _jsx("div", { className: "text-red-600 text-center py-8", children: error }) }) }));
    }
    return (_jsx(Shell, { children: _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "AI Referrals" }), _jsx("p", { className: "text-gray-600", children: "Track how AI platforms refer traffic to your content" })] }), _jsx("a", { href: "/docs", className: "text-blue-600 hover:text-blue-800 text-sm font-medium", children: "View Docs \u2192" })] }), summary && (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsx(Card, { children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: summary.totals.referrals }), _jsx("div", { className: "text-sm text-gray-600", children: "Total Referrals" }), _jsx("div", { className: "text-xs text-gray-500 mt-1", children: window })] }) }), _jsx(Card, { children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: summary.totals.contents }), _jsx("div", { className: "text-sm text-gray-600", children: "Active Pages" }), _jsx("div", { className: "text-xs text-gray-500 mt-1", children: "with \u22651 referral" })] }) }), _jsx(Card, { children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: summary.totals.sources }), _jsx("div", { className: "text-sm text-gray-600", children: "AI Sources" }), _jsx("div", { className: "text-xs text-gray-500 mt-1", children: "referring traffic" })] }) }), _jsx(Card, { children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: summary.by_source[0]?.name || 'None' }), _jsx("div", { className: "text-sm text-gray-600", children: "Top Source" }), _jsxs("div", { className: "text-xs text-gray-500 mt-1", children: [summary.by_source[0]?.count || 0, " referrals"] })] }) })] })), _jsxs("div", { className: "flex flex-col sm:flex-row gap-4", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "text-sm font-medium text-gray-700", children: "Window:" }), _jsx("div", { className: "flex bg-gray-100 rounded-lg p-1", children: ['15m', '24h', '7d'].map((w) => (_jsx("button", { onClick: () => handleWindowChange(w), className: `px-3 py-1 text-sm rounded-md transition-colors ${window === w
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'}`, children: w }, w))) })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "text-sm font-medium text-gray-700", children: "Source:" }), _jsxs("select", { value: source, onChange: (e) => handleSourceChange(e.target.value), className: "border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "", children: "All Sources" }), summary?.by_source.map((s) => (_jsx("option", { value: s.slug, children: s.name }, s.slug)))] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "text-sm font-medium text-gray-700", children: "Search:" }), _jsx("input", { type: "text", placeholder: "Search URLs...", value: searchQuery, onChange: (e) => handleSearch(e.target.value), className: "border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] })] }), _jsxs(Card, { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Source" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "URL" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Last Seen" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "15m" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "24h" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Share of AI" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: loading ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "Loading..." }) })) : referrals.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "No AI referrals found in the selected window." }) })) : (referrals.map((referral) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSourceBadgeColor(referral.source_slug)}`, children: referral.source_name }) }), _jsx("td", { className: "px-6 py-4", children: _jsx("div", { className: "max-w-xs truncate", title: referral.url, children: formatUrl(referral.url) }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: formatLastSeen(referral.last_seen) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: referral.referrals_15m }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: referral.referrals_24h }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: [(referral.share_of_ai * 100).toFixed(1), "%"] })] }, `${referral.content_id}-${referral.source_slug}`)))) })] }) }), total > pageSize && (_jsxs("div", { className: "px-6 py-3 border-t border-gray-200 flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-700", children: ["Showing ", ((page - 1) * pageSize) + 1, " to ", Math.min(page * pageSize, total), " of ", total, " results"] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => setPage(page - 1), disabled: page === 1, className: "px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50", children: "Previous" }), _jsx("button", { onClick: () => setPage(page + 1), disabled: page * pageSize >= total, className: "px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50", children: "Next" })] })] }))] }), !loading && referrals.length === 0 && summary?.totals.referrals === 0 && (_jsx("div", { className: "text-center py-12", children: _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto", children: [_jsx("div", { className: "flex items-center justify-center mb-4", children: _jsx("svg", { className: "h-12 w-12 text-blue-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }) }), _jsx("h3", { className: "text-lg font-medium text-blue-800 mb-2", children: "No AI referrals yet" }), _jsx("p", { className: "text-blue-700 mb-4", children: "Start tracking AI referrals by installing the tracking tag and configuring your sources." }), _jsxs("div", { className: "flex justify-center gap-3", children: [_jsx("a", { href: `/install?project_id=${project?.id}`, className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500", children: "Install" }), _jsx("a", { href: "/api-keys", className: "inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500", children: "API Keys" })] })] }) }))] }) }));
};
export default Referrals;
