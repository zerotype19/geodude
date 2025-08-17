import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, RefreshCw, ExternalLink, Search, Bot, User, Zap, MoreVertical, Copy, AlertCircle } from "lucide-react";
// Simple SVG chart component instead of recharts
function SimpleLineChart({ data, formatTime }) {
    if (!data || data.length === 0)
        return null;
    const maxValue = Math.max(...data.map(d => d.count));
    const minValue = Math.min(...data.map(d => d.count));
    const range = Math.max(1, maxValue - minValue);
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 300;
        const y = 100 - ((d.count - minValue) / range) * 80;
        return `${x},${y}`;
    }).join(' ');
    return (_jsxs("div", { className: "relative h-64 w-full", children: [_jsxs("svg", { viewBox: "0 0 300 120", className: "w-full h-full", children: [_jsx("polyline", { fill: "none", stroke: "#3B82F6", strokeWidth: "2", points: points }), data.map((d, i) => (_jsx("circle", { cx: (i / (data.length - 1)) * 300, cy: 100 - ((d.count - minValue) / range) * 80, r: "3", fill: "#3B82F6" }, i)))] }), _jsx("div", { className: "absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 px-2", children: data.length > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { children: formatTime(data[0].ts) }), data.length > 1 && _jsx("span", { children: formatTime(data[data.length - 1].ts) })] })) })] }));
}
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";
export default function Events() {
    const { project } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    // State
    const [summary, setSummary] = useState(null);
    const [recent, setRecent] = useState(null);
    const [hasAny, setHasAny] = useState(null);
    const [loading, setLoading] = useState(true);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [recentLoading, setRecentLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [autoRefreshCount, setAutoRefreshCount] = useState(0);
    const [metadataPopover, setMetadataPopover] = useState(null);
    // URL params and filters
    const window = searchParams.get("window") || getStoredWindow() || "24h";
    const classFilter = searchParams.get("class") || "";
    const sourceFilter = searchParams.get("source") || "";
    const searchQuery = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    // Refs for auto-refresh
    const refreshInterval = useRef(null);
    const refreshCount = useRef(0);
    // Local storage for window preference
    function getStoredWindow() {
        if (!project?.id)
            return null;
        return localStorage.getItem(`ov:events:${project.id}`);
    }
    function setStoredWindow(win) {
        if (!project?.id)
            return;
        localStorage.setItem(`ov:events:${project.id}`, win);
    }
    // Update URL params
    function updateParams(updates) {
        const newParams = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === "") {
                newParams.delete(key);
            }
            else {
                newParams.set(key, value);
            }
        });
        setSearchParams(newParams);
    }
    // API calls
    async function fetchSummary() {
        if (!project?.id)
            return;
        setSummaryLoading(true);
        try {
            const params = new URLSearchParams({ project_id: project.id, window });
            const response = await fetch(`https://api.optiview.ai/api/events/summary?${params}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setSummary(data);
                setError(null);
            }
            else {
                throw new Error(`Summary API failed: ${response.status}`);
            }
        }
        catch (err) {
            console.error('Failed to fetch summary:', err);
            setError('Failed to load summary data');
        }
        finally {
            setSummaryLoading(false);
        }
    }
    async function fetchRecent() {
        if (!project?.id)
            return;
        setRecentLoading(true);
        try {
            const params = new URLSearchParams({
                project_id: project.id,
                window,
                page: page.toString(),
                pageSize: "50"
            });
            if (classFilter)
                params.append("class", classFilter);
            if (sourceFilter)
                params.append("source", sourceFilter);
            if (searchQuery)
                params.append("q", searchQuery);
            const response = await fetch(`https://api.optiview.ai/api/events/recent?${params}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setRecent(data);
            }
            else {
                throw new Error(`Recent API failed: ${response.status}`);
            }
        }
        catch (err) {
            console.error('Failed to fetch recent events:', err);
        }
        finally {
            setRecentLoading(false);
        }
    }
    async function fetchHasAny() {
        if (!project?.id)
            return;
        try {
            const params = new URLSearchParams({ project_id: project.id, window });
            const response = await fetch(`https://api.optiview.ai/api/events/has-any?${params}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setHasAny(data.has_any);
            }
        }
        catch (err) {
            console.error('Failed to fetch has-any:', err);
        }
    }
    async function refreshData() {
        setLastUpdated(new Date());
        await Promise.all([fetchSummary(), fetchRecent()]);
    }
    // Auto-refresh logic
    function startAutoRefresh() {
        if (refreshInterval.current)
            clearInterval(refreshInterval.current);
        refreshCount.current = 0;
        refreshInterval.current = setInterval(() => {
            refreshCount.current++;
            setAutoRefreshCount(refreshCount.current);
            if (refreshCount.current >= 12) { // 12 * 10s = 2 minutes
                clearInterval(refreshInterval.current);
                refreshInterval.current = null;
                return;
            }
            if (document.visibilityState === 'visible') {
                refreshData();
            }
        }, 10000); // 10 seconds
    }
    function stopAutoRefresh() {
        if (refreshInterval.current) {
            clearInterval(refreshInterval.current);
            refreshInterval.current = null;
        }
    }
    // Effects
    useEffect(() => {
        if (project?.id) {
            setLoading(true);
            Promise.all([fetchHasAny(), fetchSummary(), fetchRecent()])
                .finally(() => {
                setLoading(false);
                setLastUpdated(new Date());
                startAutoRefresh();
            });
        }
        return stopAutoRefresh;
    }, [project?.id, window, classFilter, sourceFilter, searchQuery, page]);
    useEffect(() => {
        if (window && window !== getStoredWindow()) {
            setStoredWindow(window);
        }
    }, [window, project?.id]);
    // Handlers
    function handleWindowChange(newWindow) {
        updateParams({ window: newWindow, page: null });
    }
    function handleClassFilter(className) {
        updateParams({ class: className === classFilter ? null : className, page: null });
    }
    function handleSourceFilter(slug) {
        updateParams({ source: slug === sourceFilter ? null : slug, page: null });
    }
    function handleSearch(query) {
        updateParams({ q: query || null, page: null });
    }
    function handlePageChange(newPage) {
        updateParams({ page: newPage > 1 ? newPage.toString() : null });
    }
    // Utility functions
    function getTrafficClassColor(className) {
        switch (className) {
            case "direct_human": return "bg-gray-100 text-gray-800";
            case "human_via_ai": return "bg-blue-100 text-blue-800";
            case "ai_agent_crawl": return "bg-orange-100 text-orange-800";
            case "unknown_ai_like": return "bg-slate-100 text-slate-800";
            default: return "bg-gray-100 text-gray-800";
        }
    }
    function getEventTypeColor(eventType) {
        switch (eventType) {
            case "pageview": return "bg-blue-100 text-blue-800";
            case "click": return "bg-green-100 text-green-800";
            case "custom": return "bg-purple-100 text-purple-800";
            default: return "bg-gray-100 text-gray-800";
        }
    }
    function formatNumber(num) {
        return num.toLocaleString();
    }
    function formatPercentage(value, total) {
        if (total === 0)
            return "0.0%";
        return ((value / total) * 100).toFixed(1) + "%";
    }
    function formatRelativeTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 60000)
            return "just now";
        if (diff < 3600000)
            return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000)
            return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    }
    function formatChartTime(isoString) {
        const date = new Date(isoString);
        if (window === "15m")
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        if (window === "24h")
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    function truncateUrl(url, maxLength = 40) {
        if (url.length <= maxLength)
            return url;
        const start = Math.floor((maxLength - 3) / 2);
        const end = Math.ceil((maxLength - 3) / 2);
        return url.slice(0, start) + "..." + url.slice(-end);
    }
    // Render helpers
    function renderMetadataPopover(item) {
        if (!metadataPopover || metadataPopover.id !== item.id)
            return null;
        const metadata = item.metadata_snippet || {};
        const jsonString = JSON.stringify(metadata, null, 2);
        return (_jsxs("div", { className: "absolute top-8 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-md", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx("h4", { className: "text-sm font-medium", children: "Event Metadata" }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { onClick: () => navigator.clipboard.writeText(jsonString), className: "text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1", children: [_jsx(Copy, { className: "h-3 w-3" }), "Copy"] }), _jsx("button", { onClick: () => setMetadataPopover(null), className: "text-xs text-gray-600 hover:text-gray-800", children: "\u00D7" })] })] }), _jsx("pre", { className: "text-xs bg-gray-50 p-2 rounded border max-h-32 overflow-auto", children: jsonString })] }));
    }
    // Smart empty state check
    if (!project) {
        return (_jsx(Shell, { children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "text-center py-8", children: [_jsx("h2", { className: "text-lg font-medium text-gray-900", children: "No project selected" }), _jsx("p", { className: "text-gray-500", children: "Please select a project to view events." })] }) }) }));
    }
    if (loading) {
        return (_jsx(Shell, { children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "text-center py-8", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" }), _jsx("p", { className: "text-gray-500 mt-2", children: "Loading events..." })] }) }) }));
    }
    // Show install CTA if no events at all
    if (hasAny === false) {
        return (_jsx(Shell, { children: _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Events" }), _jsx("p", { className: "text-gray-600", children: "Monitor AI traffic and user interactions" })] }), _jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx(Activity, { className: "h-8 w-8 text-blue-400" }) }), _jsxs("div", { className: "ml-4", children: [_jsx("h3", { className: "text-lg font-medium text-blue-800", children: "No events yet" }), _jsx("p", { className: "text-blue-700 mt-1", children: "Install the tracking tag to start monitoring AI traffic and user interactions." })] })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("a", { href: `/install?project_id=${project.id}`, className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500", children: "Install Tag" }), _jsx("a", { href: "/sources", className: "inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500", children: "View Sources" })] })] }) })] }) }));
    }
    return (_jsx(Shell, { children: _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Events" }), _jsx("p", { className: "text-gray-600", children: "Monitor AI traffic and user interactions" })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "flex rounded-lg border border-gray-300", children: ["15m", "24h", "7d"].map((w) => (_jsx("button", { onClick: () => handleWindowChange(w), className: `px-3 py-1 text-sm font-medium ${window === w
                                            ? "bg-blue-600 text-white"
                                            : "bg-white text-gray-700 hover:bg-gray-50"} ${w === "15m" ? "rounded-l-md" : w === "7d" ? "rounded-r-md" : ""}`, children: w }, w))) }), _jsxs("button", { onClick: () => {
                                        refreshData();
                                        setAutoRefreshCount(0);
                                        startAutoRefresh();
                                    }, disabled: summaryLoading || recentLoading, className: "flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50", children: [_jsx(RefreshCw, { className: `h-4 w-4 ${(summaryLoading || recentLoading) ? 'animate-spin' : ''}` }), "Refresh"] }), lastUpdated && (_jsxs("span", { className: "text-xs text-gray-500", children: ["Last updated: ", lastUpdated.toLocaleTimeString()] }))] })] }), error && (_jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2", children: [_jsx(AlertCircle, { className: "h-5 w-5 text-red-400" }), _jsx("span", { className: "text-red-700", children: error }), _jsx("button", { onClick: () => setError(null), className: "ml-auto text-red-600 hover:text-red-800", children: "\u00D7" })] })), summary && (_jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [_jsx(Card, { children: _jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-center", children: [_jsx(Activity, { className: "h-5 w-5 text-gray-400" }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Total Events" }), _jsx("p", { className: "text-2xl font-semibold text-gray-900", children: formatNumber(summary.totals.events) })] })] }) }) }), _jsx(Card, { children: _jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-center", children: [_jsx(Bot, { className: "h-5 w-5 text-blue-400" }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "AI-Influenced" }), _jsx("p", { className: "text-2xl font-semibold text-gray-900", children: formatNumber(summary.totals.ai_influenced) })] })] }) }) }), _jsx(Card, { children: _jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-center", children: [_jsx(Zap, { className: "h-5 w-5 text-green-400" }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "% AI-Influenced" }), _jsx("p", { className: "text-2xl font-semibold text-gray-900", children: formatPercentage(summary.totals.ai_influenced, summary.totals.events) })] })] }) }) }), _jsx(Card, { children: _jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-center", children: [_jsx(User, { className: "h-5 w-5 text-purple-400" }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Active Sources" }), _jsx("p", { className: "text-2xl font-semibold text-gray-900", children: summary.by_source.filter(s => s.ai_source_id).length })] })] }) }) })] })), summary && (_jsx(Card, { children: _jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Events Over Time" }), summary.timeseries.length > 0 ? (_jsx(SimpleLineChart, { data: summary.timeseries, formatTime: formatChartTime })) : (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No data in this time window" }))] }) })), summary && (_jsxs("div", { className: "space-y-4", children: [summary.by_class.length > 0 && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-700 mb-2", children: "Traffic Classes" }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("button", { onClick: () => handleClassFilter(""), className: `px-3 py-1 rounded-full text-sm border ${!classFilter
                                                ? "bg-blue-100 text-blue-800 border-blue-200"
                                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`, children: ["All (", formatNumber(summary.totals.events), ")"] }), summary.by_class.map((cls) => (_jsxs("button", { onClick: () => handleClassFilter(cls.class), className: `px-3 py-1 rounded-full text-sm border ${classFilter === cls.class
                                                ? "bg-blue-100 text-blue-800 border-blue-200"
                                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`, children: [cls.class, " (", formatNumber(cls.count), ")"] }, cls.class)))] })] })), summary.by_source.length > 0 && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-700 mb-2", children: "AI Sources" }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("button", { onClick: () => handleSourceFilter(""), className: `px-3 py-1 rounded-full text-sm border ${!sourceFilter
                                                ? "bg-blue-100 text-blue-800 border-blue-200"
                                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`, children: "All sources" }), summary.by_source.slice(0, 6).map((source) => (_jsxs("button", { onClick: () => handleSourceFilter(source.slug), className: `px-3 py-1 rounded-full text-sm border ${sourceFilter === source.slug
                                                ? "bg-blue-100 text-blue-800 border-blue-200"
                                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`, children: [source.name, " (", formatNumber(source.count), ")"] }, source.slug)))] })] })), _jsx("div", { className: "flex items-center gap-4", children: _jsxs("div", { className: "relative flex-1 max-w-md", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" }), _jsx("input", { type: "text", placeholder: "Search URLs and event types...", value: searchQuery, onChange: (e) => handleSearch(e.target.value), className: "pl-9 pr-3 py-2 border border-gray-300 rounded-md w-full text-sm" })] }) })] })), _jsx(Card, { children: _jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Recent Events" }), recentLoading ? (_jsx("div", { className: "space-y-3", children: [...Array(5)].map((_, i) => (_jsxs("div", { className: "animate-pulse flex space-x-4", children: [_jsx("div", { className: "rounded bg-gray-200 h-4 w-16" }), _jsx("div", { className: "rounded bg-gray-200 h-4 w-20" }), _jsx("div", { className: "rounded bg-gray-200 h-4 w-24" }), _jsx("div", { className: "rounded bg-gray-200 h-4 w-32" }), _jsx("div", { className: "rounded bg-gray-200 h-4 w-48" })] }, i))) })) : !recent || recent.items.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No events in this window" })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-gray-500 border-b", children: [_jsx("th", { className: "py-3 pr-4", children: "Time" }), _jsx("th", { className: "py-3 pr-4", children: "Event" }), _jsx("th", { className: "py-3 pr-4", children: "Class" }), _jsx("th", { className: "py-3 pr-4", children: "Source" }), _jsx("th", { className: "py-3 pr-4", children: "URL" }), _jsx("th", { className: "py-3 pr-4", children: "Metadata" })] }) }), _jsx("tbody", { children: recent.items.map((item) => (_jsxs("tr", { className: "border-b hover:bg-gray-50", children: [_jsx("td", { className: "py-3 pr-4", children: _jsx("span", { className: "text-gray-600 cursor-help", title: new Date(item.occurred_at).toLocaleString(), children: formatRelativeTime(item.occurred_at) }) }), _jsx("td", { className: "py-3 pr-4", children: _jsx("span", { className: `px-2 py-1 text-xs rounded-full ${getEventTypeColor(item.event_type)}`, children: item.event_type }) }), _jsx("td", { className: "py-3 pr-4", children: _jsx("span", { className: `px-2 py-1 text-xs rounded-full ${getTrafficClassColor(item.traffic_class)}`, children: item.traffic_class }) }), _jsx("td", { className: "py-3 pr-4", children: item.ai_source ? (_jsx("span", { className: "px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full", children: item.ai_source.name })) : (_jsx("span", { className: "text-gray-400", children: "\u2014" })) }), _jsx("td", { className: "py-3 pr-4", children: item.content?.url ? (_jsxs("a", { href: item.content.url, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 max-w-xs", children: [_jsx("span", { className: "truncate", children: truncateUrl(item.content.url) }), _jsx(ExternalLink, { className: "h-3 w-3 flex-shrink-0" })] })) : (_jsx("span", { className: "text-gray-400", children: "\u2014" })) }), _jsxs("td", { className: "py-3 pr-4 relative", children: [item.metadata_snippet && Object.keys(item.metadata_snippet).length > 0 ? (_jsx("button", { onClick: () => setMetadataPopover({ id: item.id, metadata: item.metadata_snippet }), className: "text-gray-400 hover:text-gray-600", children: _jsx(MoreVertical, { className: "h-4 w-4" }) })) : (_jsx("span", { className: "text-gray-400", children: "\u2014" })), renderMetadataPopover(item)] })] }, item.id))) })] }) }), recent.total > recent.pageSize && (_jsxs("div", { className: "mt-4 flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-700", children: ["Showing ", ((page - 1) * recent.pageSize) + 1, " to ", Math.min(page * recent.pageSize, recent.total), " of ", formatNumber(recent.total), " events"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => handlePageChange(page - 1), disabled: page === 1, className: "px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50", children: "Previous" }), _jsx("button", { onClick: () => handlePageChange(page + 1), disabled: page * recent.pageSize >= recent.total, className: "px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50", children: "Next" })] })] }))] }))] }) }), autoRefreshCount > 0 && autoRefreshCount < 12 && (_jsxs("div", { className: "text-center", children: [_jsxs("span", { className: "text-xs text-gray-500", children: ["Auto-refreshing... (", autoRefreshCount, "/12)"] }), _jsx("button", { onClick: stopAutoRefresh, className: "ml-2 text-xs text-blue-600 hover:text-blue-800", children: "Stop" })] })), autoRefreshCount >= 12 && (_jsx("div", { className: "text-center", children: _jsx("button", { onClick: () => {
                            refreshData();
                            setAutoRefreshCount(0);
                            startAutoRefresh();
                        }, className: "px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700", children: "Recheck" }) }))] }) }));
}
