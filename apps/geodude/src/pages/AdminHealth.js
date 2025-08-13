import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
export default function AdminHealth() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshCountdown, setRefreshCountdown] = useState(120); // 2 minutes
    const [autoRefresh, setAutoRefresh] = useState(true);
    useEffect(() => {
        loadHealth();
    }, []);
    useEffect(() => {
        if (!autoRefresh)
            return;
        const interval = setInterval(() => {
            setRefreshCountdown(prev => {
                if (prev <= 1) {
                    setAutoRefresh(false);
                    return 0;
                }
                return prev - 10;
            });
        }, 10000); // Update every 10 seconds
        return () => clearInterval(interval);
    }, [autoRefresh]);
    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(() => {
                loadHealth();
            }, 10000); // Refresh every 10 seconds
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);
    async function loadHealth() {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${API_BASE}/admin/health`, FETCH_OPTS);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            setHealth(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load health data");
        }
        finally {
            setLoading(false);
        }
    }
    function handleManualRefresh() {
        setRefreshCountdown(120);
        setAutoRefresh(true);
        loadHealth();
    }
    function getStatusColor(status) {
        return status ? "text-green-600" : "text-red-600";
    }
    function getStatusIcon(status) {
        return status ? "✓" : "✗";
    }
    function formatErrorRate(rate) {
        return `${(rate * 100).toFixed(2)}%`;
    }
    function formatTimestamp(timestamp) {
        if (!timestamp)
            return "Never";
        try {
            const date = new Date(timestamp);
            return date.toLocaleString();
        }
        catch {
            return "Invalid";
        }
    }
    if (loading && !health) {
        return (_jsx(Shell, { children: _jsx("div", { className: "flex items-center justify-center min-h-64", children: _jsx("div", { className: "text-lg", children: "Loading health data..." }) }) }));
    }
    if (error) {
        return (_jsx(Shell, { children: _jsx("div", { className: "flex items-center justify-center min-h-64", children: _jsx("div", { className: "text-red-600 text-lg", children: error }) }) }));
    }
    return (_jsx(Shell, { children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "System Health Dashboard" }), _jsx("p", { className: "mt-2 text-gray-600", children: "Real-time system health and ingestion metrics" }), _jsxs("div", { className: "mt-4 flex items-center space-x-4", children: [autoRefresh ? (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-2 h-2 bg-green-500 rounded-full animate-pulse" }), _jsxs("span", { className: "text-sm text-gray-600", children: ["Auto-refreshing... ", refreshCountdown, "s remaining"] })] })) : (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-2 h-2 bg-gray-400 rounded-full" }), _jsx("span", { className: "text-sm text-gray-600", children: "Auto-refresh stopped" })] })), _jsx("button", { onClick: handleManualRefresh, className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors", children: "Recheck" })] })] }), health && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6", children: [_jsx(Card, { title: "KV Storage", children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: `text-2xl ${getStatusColor(health.kv_ok)}`, children: getStatusIcon(health.kv_ok) }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "KV Storage" }), _jsx("p", { className: `text-lg font-semibold ${getStatusColor(health.kv_ok)}`, children: health.kv_ok ? "Connected" : "Error" })] })] }) }) }), _jsx(Card, { title: "Database", children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: `text-2xl ${getStatusColor(health.d1_ok)}`, children: getStatusIcon(health.d1_ok) }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Database" }), _jsx("p", { className: `text-lg font-semibold ${getStatusColor(health.d1_ok)}`, children: health.d1_ok ? "Connected" : "Error" })] })] }) }) }), _jsx(Card, { title: "Last Cron", children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "text-2xl text-blue-600", children: "\u23F0" }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Last Cron" }), _jsx("p", { className: "text-lg font-semibold text-gray-900", children: formatTimestamp(health.last_cron_ts) })] })] }) }) }), _jsx(Card, { title: "Total Requests", children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "text-2xl text-purple-600", children: "\uD83D\uDCCA" }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Total (5m)" }), _jsx("p", { className: "text-lg font-semibold text-gray-900", children: health.ingest.total_5m.toLocaleString() })] })] }) }) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsx(Card, { title: "Error Rate (5m)", children: _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Error Rate (5m)" }), _jsx("div", { className: "text-3xl font-bold text-red-600", children: formatErrorRate(health.ingest.error_rate_5m) }), _jsxs("p", { className: "text-sm text-gray-500 mt-1", children: [Object.values(health.ingest.by_error_5m).reduce((sum, count) => sum + count, 0), " errors"] })] }) }), _jsx(Card, { title: "Latency P50 (5m)", children: _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Latency P50 (5m)" }), _jsxs("div", { className: "text-3xl font-bold text-blue-600", children: [health.ingest.p50_ms_5m, "ms"] }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: "Median response time" })] }) }), _jsx(Card, { title: "Latency P95 (5m)", children: _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Latency P95 (5m)" }), _jsxs("div", { className: "text-3xl font-bold text-orange-600", children: [health.ingest.p95_ms_5m, "ms"] }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: "95th percentile" })] }) })] }), _jsx(Card, { title: "Error Breakdown (5m)", children: _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Error Breakdown (5m)" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: Object.entries(health.ingest.by_error_5m).map(([errorCode, count]) => (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-red-600", children: count }), _jsx("div", { className: "text-sm text-gray-600 capitalize", children: errorCode.replace(/_/g, ' ') })] }, errorCode))) })] }) }), health.ingest.top_error_keys_5m.length > 0 && (_jsx(Card, { title: "Top Error Keys (5m)", children: _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Top Error Keys (5m)" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Key ID" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Error Count" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: health.ingest.top_error_keys_5m.map((item) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900", children: item.key_id }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: item.count })] }, item.key_id))) })] }) })] }) })), health.ingest.top_error_projects_5m.length > 0 && (_jsx(Card, { title: "Top Error Projects (5m)", children: _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Top Error Projects (5m)" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Project ID" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Error Count" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: health.ingest.top_error_projects_5m.map((item) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900", children: item.project_id }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: item.count })] }, item.project_id))) })] }) })] }) }))] }))] }) }));
}
