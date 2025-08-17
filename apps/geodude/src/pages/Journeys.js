import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock, RefreshCw, ExternalLink, Search, Activity, Bot, User, X, AlertCircle } from "lucide-react";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";
// Simple SVG chart component
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
export default function Journeys() {
    const { project } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    // State
    const [summary, setSummary] = useState(null);
    const [recent, setRecent] = useState(null);
    const [hasAnySessions, setHasAnySessions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [recentLoading, setRecentLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [autoRefreshCount, setAutoRefreshCount] = useState(0);
    const [selectedJourney, setSelectedJourney] = useState(null);
    const [journeyLoading, setJourneyLoading] = useState(false);
    // URL params and filters
    const window = searchParams.get("window") || getStoredWindow() || "24h";
    const aiFilter = searchParams.get("ai") || "all";
    const searchQuery = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    // Refs for auto-refresh
    const refreshInterval = useRef(null);
    const refreshCount = useRef(0);
    // Local storage for window preference
    function getStoredWindow() {
        if (!project?.id)
            return null;
        return localStorage.getItem(`ov:journeys:${project.id}`);
    }
    function setStoredWindow(win) {
        if (!project?.id)
            return;
        localStorage.setItem(`ov:journeys:${project.id}`, win);
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
            const response = await fetch(`https://api.optiview.ai/api/sessions/summary?${params}`, {
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
                pageSize: "50",
                ai: aiFilter
            });
            if (searchQuery)
                params.append("q", searchQuery);
            const response = await fetch(`https://api.optiview.ai/api/sessions/recent?${params}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setRecent(data);
                // Set hasAnySessions based on whether we have any sessions at all
                if (data.total > 0) {
                    setHasAnySessions(true);
                }
                else if (hasAnySessions === null) {
                    // Only check events if we haven't determined this yet
                    checkHasAnyEvents();
                }
            }
            else {
                throw new Error(`Recent API failed: ${response.status}`);
            }
        }
        catch (err) {
            console.error('Failed to fetch recent sessions:', err);
        }
        finally {
            setRecentLoading(false);
        }
    }
    async function checkHasAnyEvents() {
        if (!project?.id)
            return;
        try {
            const params = new URLSearchParams({ project_id: project.id, window: "15m" });
            const response = await fetch(`https://api.optiview.ai/api/events/has-any?${params}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setHasAnySessions(data.has_any);
            }
        }
        catch (err) {
            console.error('Failed to check has any events:', err);
        }
    }
    async function fetchJourney(sessionId) {
        if (!project?.id)
            return;
        setJourneyLoading(true);
        try {
            const params = new URLSearchParams({ project_id: project.id, session_id: sessionId.toString() });
            const response = await fetch(`https://api.optiview.ai/api/sessions/journey?${params}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setSelectedJourney(data);
            }
            else {
                throw new Error(`Journey API failed: ${response.status}`);
            }
        }
        catch (err) {
            console.error('Failed to fetch journey:', err);
        }
        finally {
            setJourneyLoading(false);
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
            Promise.all([fetchSummary(), fetchRecent()])
                .finally(() => {
                setLoading(false);
                setLastUpdated(new Date());
                startAutoRefresh();
            });
        }
        return stopAutoRefresh;
    }, [project?.id, window, aiFilter, searchQuery, page]);
    useEffect(() => {
        if (window && window !== getStoredWindow()) {
            setStoredWindow(window);
        }
    }, [window, project?.id]);
    // Handlers
    function handleWindowChange(newWindow) {
        updateParams({ window: newWindow, page: null });
    }
    function handleAIFilter(newAIFilter) {
        updateParams({ ai: newAIFilter === "all" ? null : newAIFilter, page: null });
    }
    function handleSearch(query) {
        updateParams({ q: query || null, page: null });
    }
    function handlePageChange(newPage) {
        updateParams({ page: newPage > 1 ? newPage.toString() : null });
    }
    function handleViewJourney(sessionId) {
        fetchJourney(sessionId);
    }
    // Utility functions
    function formatNumber(num) {
        return num.toLocaleString();
    }
    function formatPercentage(value, total) {
        if (total === 0)
            return "0.0%";
        return ((value / total) * 100).toFixed(1) + "%";
    }
    function formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        if (!url || url.length <= maxLength)
            return url || "";
        const start = Math.floor((maxLength - 3) / 2);
        const end = Math.ceil((maxLength - 3) / 2);
        return url.slice(0, start) + "..." + url.slice(-end);
    }
    function getEventIcon(eventType) {
        switch (eventType) {
            case 'pageview':
                return _jsx(Activity, { className: "h-4 w-4" });
            case 'click':
                return _jsx(User, { className: "h-4 w-4" });
            default:
                return _jsx(Clock, { className: "h-4 w-4" });
        }
    }
    // Smart empty state check
    if (!project) {
        return (_jsx(Shell, { children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "text-center py-8", children: [_jsx("h2", { className: "text-lg font-medium text-gray-900", children: "No project selected" }), _jsx("p", { className: "text-gray-500", children: "Please select a project to view journeys." })] }) }) }));
    }
    if (loading) {
        return (_jsx(Shell, { children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "text-center py-8", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" }), _jsx("p", { className: "text-gray-500 mt-2", children: "Loading journeys..." })] }) }) }));
    }
    // Show install CTA if no sessions and no events at all
    if (hasAnySessions === false) {
        return (_jsx(Shell, { children: _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Journeys" }), _jsx("p", { className: "text-gray-600", children: "Monitor visitor sessions and user journeys" })] }), _jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx(Activity, { className: "h-8 w-8 text-blue-400" }) }), _jsxs("div", { className: "ml-4", children: [_jsx("h3", { className: "text-lg font-medium text-blue-800", children: "No sessions yet" }), _jsx("p", { className: "text-blue-700 mt-1", children: "Install the tracking tag to start monitoring visitor journeys and sessions." })] })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("a", { href: `/install?project_id=${project.id}`, className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500", children: "Install Tag" }), _jsx("a", { href: "/sources", className: "inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500", children: "View Sources" })] })] }) })] }) }));
    }
    return (_jsxs(Shell, { children: [_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Journeys" }), _jsx("p", { className: "text-gray-600", children: "Monitor visitor sessions and user journeys" })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "flex rounded-lg border border-gray-300", children: ["15m", "24h", "7d"].map((w) => (_jsx("button", { onClick: () => handleWindowChange(w), className: `px-3 py-1 text-sm font-medium ${window === w
                                                ? "bg-blue-600 text-white"
                                                : "bg-white text-gray-700 hover:bg-gray-50"} ${w === "15m" ? "rounded-l-md" : w === "7d" ? "rounded-r-md" : ""}`, children: w }, w))) }), _jsxs("button", { onClick: () => {
                                            refreshData();
                                            setAutoRefreshCount(0);
                                            startAutoRefresh();
                                        }, disabled: summaryLoading || recentLoading, className: "flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50", children: [_jsx(RefreshCw, { className: `h-4 w-4 ${(summaryLoading || recentLoading) ? 'animate-spin' : ''}` }), "Refresh"] }), lastUpdated && (_jsxs("span", { className: "text-xs text-gray-500", children: ["Last updated: ", lastUpdated.toLocaleTimeString()] }))] })] }), error && (_jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2", children: [_jsx(AlertCircle, { className: "h-5 w-5 text-red-400" }), _jsx("span", { className: "text-red-700", children: error }), _jsx("button", { onClick: () => setError(null), className: "ml-auto text-red-600 hover:text-red-800", children: "\u00D7" })] })), summary && (_jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [_jsx(Card, { children: _jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-center", children: [_jsx(Activity, { className: "h-5 w-5 text-gray-400" }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Total Sessions" }), _jsx("p", { className: "text-2xl font-semibold text-gray-900", children: formatNumber(summary.totals.sessions) })] })] }) }) }), _jsx(Card, { children: _jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-center", children: [_jsx(Bot, { className: "h-5 w-5 text-blue-400" }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "AI-Influenced" }), _jsx("p", { className: "text-2xl font-semibold text-gray-900", children: formatNumber(summary.totals.ai_influenced) })] })] }) }) }), _jsx(Card, { children: _jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-center", children: [_jsx(User, { className: "h-5 w-5 text-green-400" }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "% AI Sessions" }), _jsx("p", { className: "text-2xl font-semibold text-gray-900", children: formatPercentage(summary.totals.ai_influenced, summary.totals.sessions) })] })] }) }) }), _jsx(Card, { children: _jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-center", children: [_jsx(Clock, { className: "h-5 w-5 text-purple-400" }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Avg Events/Session" }), _jsx("p", { className: "text-2xl font-semibold text-gray-900", children: summary.totals.avg_events_per_session.toFixed(1) })] })] }) }) })] })), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-4 gap-6", children: [_jsxs("div", { className: "lg:col-span-3 space-y-6", children: [summary && (_jsx(Card, { children: _jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Sessions Over Time" }), summary.timeseries.length > 0 ? (_jsx(SimpleLineChart, { data: summary.timeseries, formatTime: formatChartTime })) : (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No data in this time window" }))] }) })), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-700 mb-2", children: "AI Traffic" }), _jsx("div", { className: "flex flex-wrap gap-2", children: ["all", "only", "none"].map((filter) => (_jsx("button", { onClick: () => handleAIFilter(filter), className: `px-3 py-1 rounded-full text-sm border ${aiFilter === filter || (aiFilter === "all" && filter === "all")
                                                                ? "bg-blue-100 text-blue-800 border-blue-200"
                                                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`, children: filter === "all" ? "All" : filter === "only" ? "AI only" : "Non-AI" }, filter))) })] }), _jsx("div", { className: "flex items-center gap-4", children: _jsxs("div", { className: "relative flex-1 max-w-md", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" }), _jsx("input", { type: "text", placeholder: "Search by URL...", value: searchQuery, onChange: (e) => handleSearch(e.target.value), className: "pl-9 pr-3 py-2 border border-gray-300 rounded-md w-full text-sm" })] }) })] }), _jsx(Card, { children: _jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Recent Sessions" }), recentLoading ? (_jsx("div", { className: "space-y-3", children: [...Array(5)].map((_, i) => (_jsxs("div", { className: "animate-pulse flex space-x-4", children: [_jsx("div", { className: "rounded bg-gray-200 h-4 w-16" }), _jsx("div", { className: "rounded bg-gray-200 h-4 w-20" }), _jsx("div", { className: "rounded bg-gray-200 h-4 w-24" }), _jsx("div", { className: "rounded bg-gray-200 h-4 w-32" }), _jsx("div", { className: "rounded bg-gray-200 h-4 w-48" })] }, i))) })) : !recent || recent.items.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No sessions in this window" })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-gray-500 border-b", children: [_jsx("th", { className: "py-3 pr-4", children: "Started" }), _jsx("th", { className: "py-3 pr-4", children: "Duration" }), _jsx("th", { className: "py-3 pr-4", children: "Events" }), _jsx("th", { className: "py-3 pr-4", children: "AI" }), _jsx("th", { className: "py-3 pr-4", children: "Entry URL" }), _jsx("th", { className: "py-3 pr-4", children: "Exit URL" }), _jsx("th", { className: "py-3 pr-4", children: "Actions" })] }) }), _jsx("tbody", { children: recent.items.map((item) => (_jsxs("tr", { className: "border-b hover:bg-gray-50", children: [_jsx("td", { className: "py-3 pr-4", children: _jsx("span", { className: "text-gray-600 cursor-help", title: new Date(item.started_at).toLocaleString(), children: formatRelativeTime(item.started_at) }) }), _jsx("td", { className: "py-3 pr-4", children: _jsx("span", { className: "text-gray-900", children: formatDuration(item.duration_sec) }) }), _jsx("td", { className: "py-3 pr-4", children: _jsx("span", { className: "text-gray-900", children: item.events_count }) }), _jsx("td", { className: "py-3 pr-4", children: item.ai_influenced ? (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full", children: "AI" }), item.primary_ai_source && (_jsx("span", { className: "px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full", children: item.primary_ai_source.name }))] })) : (_jsx("span", { className: "text-gray-400", children: "\u2014" })) }), _jsx("td", { className: "py-3 pr-4", children: item.entry?.url ? (_jsxs("a", { href: item.entry.url, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 max-w-xs", children: [_jsx("span", { className: "truncate", children: truncateUrl(item.entry.url) }), _jsx(ExternalLink, { className: "h-3 w-3 flex-shrink-0" })] })) : (_jsx("span", { className: "text-gray-400", children: "\u2014" })) }), _jsx("td", { className: "py-3 pr-4", children: item.exit?.url ? (_jsxs("a", { href: item.exit.url, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 max-w-xs", children: [_jsx("span", { className: "truncate", children: truncateUrl(item.exit.url) }), _jsx(ExternalLink, { className: "h-3 w-3 flex-shrink-0" })] })) : (_jsx("span", { className: "text-gray-400", children: "\u2014" })) }), _jsx("td", { className: "py-3 pr-4", children: _jsx("button", { onClick: () => handleViewJourney(item.id), className: "text-blue-600 hover:text-blue-800 text-sm font-medium", children: "View Journey" }) })] }, item.id))) })] }) }), recent.total > recent.pageSize && (_jsxs("div", { className: "mt-4 flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-700", children: ["Showing ", ((page - 1) * recent.pageSize) + 1, " to ", Math.min(page * recent.pageSize, recent.total), " of ", formatNumber(recent.total), " sessions"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => handlePageChange(page - 1), disabled: page === 1, className: "px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50", children: "Previous" }), _jsx("button", { onClick: () => handlePageChange(page + 1), disabled: page * recent.pageSize >= recent.total, className: "px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50", children: "Next" })] })] }))] }))] }) })] }), _jsx("div", { className: "space-y-6", children: summary && summary.entry_pages.length > 0 && (_jsx(Card, { children: _jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Top Entry Pages" }), _jsx("div", { className: "space-y-3", children: summary.entry_pages.slice(0, 8).map((page, index) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "flex-1 min-w-0", children: page.content_id ? (_jsx("a", { href: `/content?content_id=${page.content_id}`, className: "text-blue-600 hover:text-blue-800 text-sm truncate block", children: truncateUrl(page.url, 30) })) : (_jsx("span", { className: "text-gray-900 text-sm truncate block", children: truncateUrl(page.url, 30) })) }), _jsx("span", { className: "text-gray-500 text-xs ml-2", children: formatNumber(page.count) })] }, index))) })] }) })) })] }), autoRefreshCount > 0 && autoRefreshCount < 12 && (_jsxs("div", { className: "text-center", children: [_jsxs("span", { className: "text-xs text-gray-500", children: ["Auto-refreshing... (", autoRefreshCount, "/12)"] }), _jsx("button", { onClick: stopAutoRefresh, className: "ml-2 text-xs text-blue-600 hover:text-blue-800", children: "Stop" })] })), autoRefreshCount >= 12 && (_jsx("div", { className: "text-center", children: _jsx("button", { onClick: () => {
                                refreshData();
                                setAutoRefreshCount(0);
                                startAutoRefresh();
                            }, className: "px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700", children: "Recheck" }) }))] }), selectedJourney && (_jsxs("div", { className: "fixed inset-0 z-50 overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 bg-black bg-opacity-50", onClick: () => setSelectedJourney(null) }), _jsx("div", { className: "absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl", children: _jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-medium text-gray-900", children: "Journey Details" }), _jsxs("p", { className: "text-sm text-gray-500", children: ["Session #", selectedJourney.session.id] })] }), _jsx("button", { onClick: () => setSelectedJourney(null), className: "text-gray-400 hover:text-gray-600", children: _jsx(X, { className: "h-6 w-6" }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-6", children: journeyLoading ? (_jsxs("div", { className: "text-center py-8", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" }), _jsx("p", { className: "text-gray-500 mt-2", children: "Loading journey..." })] })) : (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-md font-medium text-gray-900 mb-3", children: "Session Summary" }), _jsxs("div", { className: "bg-gray-50 rounded-lg p-4 space-y-2", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Duration:" }), _jsx("span", { className: "text-sm text-gray-900", children: formatDuration(selectedJourney.session.duration_sec) })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Events:" }), _jsx("span", { className: "text-sm text-gray-900", children: selectedJourney.session.events_count })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-gray-600", children: "AI Influenced:" }), _jsx("span", { className: "text-sm text-gray-900", children: selectedJourney.session.ai_influenced ? "Yes" : "No" })] }), selectedJourney.session.primary_ai_source && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Primary Source:" }), _jsx("span", { className: "px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full", children: selectedJourney.session.primary_ai_source.name })] }))] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-md font-medium text-gray-900 mb-3", children: "Actions" }), _jsxs("div", { className: "flex gap-2", children: [selectedJourney.session.entry?.content_id && (_jsx("a", { href: `/content?content_id=${selectedJourney.session.entry.content_id}`, className: "px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200", children: "Open in Content" })), selectedJourney.session.entry?.url && (_jsx("a", { href: `/events?window=24h&q=${encodeURIComponent(selectedJourney.session.entry.url)}`, className: "px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200", children: "Open in Events" }))] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-md font-medium text-gray-900 mb-3", children: "Event Timeline" }), _jsx("div", { className: "space-y-3", children: selectedJourney.events.map((event, index) => (_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center", children: getEventIcon(event.event_type) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: "text-sm font-medium text-gray-900", children: event.event_type }), event.ai_source && (_jsx("span", { className: "px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full", children: event.ai_source.name }))] }), event.content?.url && (_jsxs("a", { href: event.content.url, target: "_blank", rel: "noopener noreferrer", className: "text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1", children: [_jsx("span", { className: "truncate max-w-xs", children: event.content.url }), _jsx(ExternalLink, { className: "h-3 w-3 flex-shrink-0" })] })), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: formatRelativeTime(event.occurred_at) })] }), index < selectedJourney.events.length - 1 && (_jsx("div", { className: "absolute left-4 mt-8 w-0.5 h-6 bg-gray-200", style: { marginLeft: '15px' } }))] }, event.id))) })] })] })) })] }) })] }))] }));
}
