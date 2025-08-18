import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
export default function AdminHealth() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshCountdown, setRefreshCountdown] = useState(120); // 2 minutes
    const [autoRefresh, setAutoRefresh] = useState(true);
    // Check if user is admin
    useEffect(() => {
        if (user && !user.is_admin) {
            navigate('/');
            return;
        }
        if (user?.is_admin) {
            loadHealth();
        }
    }, [user, navigate]);
    useEffect(() => {
        if (!autoRefresh || !user?.is_admin)
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
    }, [autoRefresh, user]);
    useEffect(() => {
        if (autoRefresh && user?.is_admin) {
            const interval = setInterval(() => {
                loadHealth();
            }, 10000); // Refresh every 10 seconds
            return () => clearInterval(interval);
        }
    }, [autoRefresh, user]);
    async function loadHealth() {
        if (!user?.is_admin)
            return;
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
        if (!user?.is_admin)
            return;
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
    // Show loading while checking admin status
    if (!user) {
        return (_jsx(Shell, { children: _jsx("div", { className: "flex items-center justify-center min-h-64", children: _jsx("div", { className: "text-lg", children: "Loading user data..." }) }) }));
    }
    // Show access denied for non-admin users
    if (!user.is_admin) {
        return (_jsx(Shell, { children: _jsx("div", { className: "flex items-center justify-center min-h-64", children: _jsxs("div", { className: "text-center max-w-md", children: [_jsx("div", { className: "text-red-600 text-lg mb-4", children: "Access Denied" }), _jsx("div", { className: "text-gray-600 mb-4", children: "Admin privileges required to view this page." }), _jsxs("div", { className: "bg-gray-50 p-4 rounded-md text-left", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Debug Information:" }), _jsxs("div", { className: "text-sm text-gray-600 space-y-1", children: [_jsxs("div", { children: ["User ID: ", user.id] }), _jsxs("div", { children: ["Email: ", user.email] }), _jsxs("div", { children: ["Admin Status: ", user.is_admin ? 'true' : 'false'] }), _jsxs("div", { children: ["Created: ", user.created_ts ? new Date(user.created_ts * 1000).toLocaleString() : 'Unknown'] })] })] }), _jsx("div", { className: "mt-4 text-xs text-gray-500", children: "To grant admin access, update the user record in the database to set is_admin = 1" })] }) }) }));
    }
    if (loading && !health) {
        return (_jsx(Shell, { children: _jsx("div", { className: "flex items-center justify-center min-h-64", children: _jsx("div", { className: "text-lg", children: "Loading health data..." }) }) }));
    }
    if (error) {
        return (_jsx(Shell, { children: _jsx("div", { className: "flex items-center justify-center min-h-64", children: _jsx("div", { className: "text-red-600 text-lg", children: error }) }) }));
    }
    return (_jsx(Shell, { children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "System Health Dashboard" }), _jsx("p", { className: "mt-2 text-gray-600", children: "Real-time system health and ingestion metrics" }), _jsx("div", { className: "mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "text-blue-600", children: _jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }) }), _jsxs("div", { children: [_jsxs("p", { className: "text-sm font-medium text-blue-900", children: ["Admin User: ", user.email] }), _jsxs("p", { className: "text-xs text-blue-700", children: ["User ID: ", user.id] })] })] }), _jsx("div", { className: "text-right", children: _jsxs("p", { className: "text-xs text-blue-700", children: ["Last Login: ", user.last_login_ts ? new Date(user.last_login_ts * 1000).toLocaleString() : 'Unknown'] }) })] }) }), _jsxs("div", { className: "mt-4 flex items-center space-x-4", children: [autoRefresh ? (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-2 h-2 bg-green-500 rounded-full animate-pulse" }), _jsxs("span", { className: "text-sm text-gray-600", children: ["Auto-refreshing... ", refreshCountdown, "s remaining"] })] })) : (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-2 h-2 bg-gray-400 rounded-full" }), _jsx("span", { className: "text-sm text-gray-600", children: "Auto-refresh stopped" })] })), _jsx("button", { onClick: handleManualRefresh, className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors", children: "Recheck" })] })] }), health && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6", children: [_jsx(Card, { title: "KV Storage", children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: `text-2xl ${getStatusColor(health.kv_ok)}`, children: getStatusIcon(health.kv_ok) }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "KV Storage" }), _jsx("p", { className: `text-lg font-semibold ${getStatusColor(health.kv_ok)}`, children: health.kv_ok ? "Connected" : "Error" })] })] }) }) }), _jsx(Card, { title: "Database", children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: `text-2xl ${getStatusColor(health.d1_ok)}`, children: getStatusIcon(health.d1_ok) }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Database" }), _jsx("p", { className: `text-lg font-semibold ${getStatusColor(health.d1_ok)}`, children: health.d1_ok ? "Connected" : "Error" })] })] }) }) }), _jsx(Card, { title: "Last Cron", children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "text-2xl text-blue-600", children: "\u23F0" }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Last Cron" }), _jsx("p", { className: "text-lg font-semibold text-gray-900", children: formatTimestamp(health.last_cron_ts) })] })] }) }) }), _jsx(Card, { title: "Total Requests", children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "text-2xl text-purple-600", children: "\uD83D\uDCCA" }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Total (5m)" }), _jsx("p", { className: "text-lg font-semibold text-gray-900", children: health.ingest.total_5m.toLocaleString() })] })] }) }) })] }), _jsx(Card, { title: "Sessions (last 5m)", children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Sessions (last 5m)" }), _jsx("div", { className: `px-3 py-1 rounded-full text-sm font-medium ${health.sessions.status === 'healthy'
                                                    ? 'bg-green-100 text-green-800'
                                                    : health.sessions.status === 'watch'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-red-100 text-red-800'}`, children: health.sessions.status })] }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-green-600", children: health.sessions.opened_5m }), _jsx("div", { className: "text-sm text-gray-600", children: "Opened" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-blue-600", children: health.sessions.closed_5m }), _jsx("div", { className: "text-sm text-gray-600", children: "Closed" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-purple-600", children: health.sessions.attach_5m }), _jsx("div", { className: "text-sm text-gray-600", children: "Events attached" })] })] }), _jsx("p", { className: "text-xs text-gray-500 mt-3", children: "Opened = new sessions started; Attached = events linked to sessions." })] }) }), _jsx(Card, { title: "Projects (last 5m)", children: _jsxs("div", { className: "p-6", children: [_jsx("div", { className: "flex items-center justify-between mb-4", children: _jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Projects (last 5m)" }) }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-blue-600", children: health.projects.created_5m }), _jsx("div", { className: "text-sm text-gray-600", children: "Created" })] }), _jsx("p", { className: "text-xs text-gray-500 mt-3", children: "Number of projects created in the last 5 minutes." })] }) }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsx(Card, { title: "Error Rate (5m)", children: _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Error Rate (5m)" }), _jsx("div", { className: "text-3xl font-bold text-red-600", children: formatErrorRate(health.ingest.error_rate_5m) }), _jsxs("p", { className: "text-sm text-gray-500 mt-1", children: [Object.values(health.ingest.by_error_5m).reduce((sum, count) => sum + count, 0), " errors"] })] }) }), _jsx(Card, { title: "Latency P50 (5m)", children: _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Latency P50 (5m)" }), _jsxs("div", { className: "text-3xl font-bold text-blue-600", children: [health.ingest.p50_ms_5m, "ms"] }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: "Median response time" })] }) }), _jsx(Card, { title: "Latency P95 (5m)", children: _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Latency P95 (5m)" }), _jsxs("div", { className: "text-3xl font-bold text-orange-600", children: [health.ingest.p95_ms_5m, "ms"] }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: "95th percentile" })] }) })] }), _jsx(Card, { title: "Error Breakdown (5m)", children: _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Error Breakdown (5m)" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: Object.entries(health.ingest.by_error_5m).map(([errorCode, count]) => (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-red-600", children: count }), _jsx("div", { className: "text-sm text-gray-600 capitalize", children: errorCode.replace(/_/g, ' ') })] }, errorCode))) })] }) }), health.ingest.top_error_keys_5m.length > 0 && (_jsx(Card, { title: "Top Error Keys (5m)", children: _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Top Error Keys (5m)" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Key ID" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Error Count" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: health.ingest.top_error_keys_5m.map((item) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900", children: item.key_id }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: item.count })] }, item.key_id))) })] }) })] }) })), health.ingest.top_error_projects_5m.length > 0 && (_jsx(Card, { title: "Top Error Projects (5m)", children: _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Top Error Projects (5m)" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Project ID" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Error Count" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: health.ingest.top_error_projects_5m.map((item) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900", children: item.project_id }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: item.count })] }, item.project_id))) })] }) })] }) }))] }))] }) }));
}
