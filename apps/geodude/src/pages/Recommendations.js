import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import Shell from '../components/Shell';
import { useAuth } from '../contexts/AuthContext';
const API_BASE = 'https://api.optiview.ai';
const Recommendations = () => {
    const { user, project } = useAuth();
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        status: 'all',
        severity: '',
        type: '',
        q: '',
        window: '7d',
        sort: 'impact_desc'
    });
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 50,
        total: 0
    });
    const [selectedRec, setSelectedRec] = useState(null);
    const [showDrawer, setShowDrawer] = useState(false);
    const fetchRecommendations = async () => {
        if (!project?.id)
            return;
        try {
            setLoading(true);
            const params = new URLSearchParams({
                project_id: project.id,
                window: filters.window,
                status: filters.status,
                sort: filters.sort,
                page: pagination.page.toString(),
                pageSize: pagination.pageSize.toString()
            });
            if (filters.severity)
                params.append('severity', filters.severity);
            if (filters.type)
                params.append('type', filters.type);
            if (filters.q)
                params.append('q', filters.q);
            const response = await fetch(`${API_BASE}/api/recommendations?${params}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch recommendations: ${response.statusText}`);
            }
            const data = await response.json();
            setRecommendations(data.items);
            setPagination(prev => ({
                ...prev,
                total: data.total
            }));
            setError(null);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
        }
        finally {
            setLoading(false);
        }
    };
    const updateRecommendationStatus = async (recId, status, note) => {
        if (!project?.id)
            return;
        try {
            const response = await fetch(`${API_BASE}/api/recommendations/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    project_id: project.id,
                    rec_id: recId,
                    status,
                    note
                })
            });
            if (!response.ok) {
                throw new Error(`Failed to update status: ${response.statusText}`);
            }
            // Refresh recommendations
            await fetchRecommendations();
            setShowDrawer(false);
            setSelectedRec(null);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update status');
        }
    };
    const resetRecommendationStatus = async (recId) => {
        if (!project?.id)
            return;
        try {
            const response = await fetch(`${API_BASE}/api/recommendations/reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    project_id: project.id,
                    rec_id: recId
                })
            });
            if (!response.ok) {
                throw new Error(`Failed to reset status: ${response.statusText}`);
            }
            // Refresh recommendations
            await fetchRecommendations();
            setShowDrawer(false);
            setSelectedRec(null);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reset status');
        }
    };
    useEffect(() => {
        fetchRecommendations();
    }, [project?.id, filters, pagination.page]);
    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'high': return 'bg-red-100 text-red-800';
            case 'medium': return 'bg-yellow-100 text-yellow-800';
            case 'low': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'open': return 'bg-blue-100 text-blue-800';
            case 'dismissed': return 'bg-gray-100 text-gray-800';
            case 'resolved': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    const getTypeLabel = (type) => {
        switch (type) {
            case 'R1': return 'No Visibility';
            case 'R2': return 'Weak Conversions';
            case 'R3': return 'Missing AI';
            case 'R4': return 'Slow TTC';
            case 'R5': return 'Pending Rules';
            default: return type;
        }
    };
    if (!user || !project) {
        return _jsx("div", { children: "Please log in to view recommendations." });
    }
    return (_jsxs(Shell, { children: [_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Recommendations" }), _jsx("p", { className: "text-gray-600", children: "AI-driven insights to optimize your funnel performance" })] }), _jsx("a", { href: "/docs#recommendations", className: "text-blue-600 hover:text-blue-800 text-sm font-medium", children: "View Documentation \u2192" })] }), _jsx("div", { className: "bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Status" }), _jsxs("select", { value: filters.status, onChange: (e) => setFilters({ ...filters, status: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "all", children: "All Status" }), _jsx("option", { value: "open", children: "Open" }), _jsx("option", { value: "dismissed", children: "Dismissed" }), _jsx("option", { value: "resolved", children: "Resolved" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Severity" }), _jsxs("select", { value: filters.severity, onChange: (e) => setFilters({ ...filters, severity: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "", children: "All Severity" }), _jsx("option", { value: "high", children: "High" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "low", children: "Low" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Type" }), _jsxs("select", { value: filters.type, onChange: (e) => setFilters({ ...filters, type: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "", children: "All Types" }), _jsx("option", { value: "R1", children: "No Visibility" }), _jsx("option", { value: "R2", children: "Weak Conversions" }), _jsx("option", { value: "R3", children: "Missing AI" }), _jsx("option", { value: "R4", children: "Slow TTC" }), _jsx("option", { value: "R5", children: "Pending Rules" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Window" }), _jsxs("select", { value: filters.window, onChange: (e) => setFilters({ ...filters, window: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "7d", children: "7 days" }), _jsx("option", { value: "24h", children: "24 hours" }), _jsx("option", { value: "15m", children: "15 minutes" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Sort" }), _jsxs("select", { value: filters.sort, onChange: (e) => setFilters({ ...filters, sort: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "impact_desc", children: "Impact (High to Low)" }), _jsx("option", { value: "severity_desc", children: "Severity (High to Low)" }), _jsx("option", { value: "type_asc", children: "Type (A to Z)" }), _jsx("option", { value: "url_asc", children: "URL (A to Z)" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Search" }), _jsx("input", { type: "text", value: filters.q, onChange: (e) => setFilters({ ...filters, q: e.target.value }), placeholder: "Search URLs, sources...", className: "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" })] })] }) }), error && (_jsx("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4 mb-6", children: _jsx("div", { className: "text-red-800", children: error }) })), loading && (_jsx("div", { className: "bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center", children: _jsx("div", { className: "text-gray-600", children: "Loading recommendations..." }) })), !loading && recommendations.length === 0 && (_jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center", children: [_jsx("div", { className: "text-gray-600 mb-4", children: "No recommendations found." }), _jsx("p", { className: "text-gray-500 text-sm", children: "This is great! Your funnel performance looks optimized. Recommendations will appear here when optimization opportunities are detected." }), _jsx("a", { href: "/docs#recommendations", className: "inline-block mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium", children: "Learn more about recommendations \u2192" })] })), !loading && recommendations.length > 0 && (_jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Type" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Severity" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Title" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Impact" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: recommendations.map((rec) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: "text-sm font-medium text-gray-900", children: getTypeLabel(rec.type) }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(rec.severity)}`, children: rec.severity }) }), _jsxs("td", { className: "px-6 py-4", children: [_jsx("div", { className: "text-sm text-gray-900", children: rec.title }), _jsx("div", { className: "text-sm text-gray-500 mt-1", children: rec.description })] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm font-medium text-gray-900", children: rec.impact_score }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(rec.status)}`, children: rec.status }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: _jsx("button", { onClick: () => {
                                                                setSelectedRec(rec);
                                                                setShowDrawer(true);
                                                            }, className: "text-blue-600 hover:text-blue-800 font-medium", children: "View Details" }) })] }, rec.rec_id))) })] }) }), _jsx("div", { className: "bg-white px-4 py-3 border-t border-gray-200 sm:px-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-700", children: ["Showing ", Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total), " to", ' ', Math.min(pagination.page * pagination.pageSize, pagination.total), " of ", pagination.total, " results"] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) })), disabled: pagination.page === 1, className: "px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed", children: "Previous" }), _jsx("button", { onClick: () => setPagination(prev => ({ ...prev, page: prev.page + 1 })), disabled: pagination.page * pagination.pageSize >= pagination.total, className: "px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed", children: "Next" })] })] }) })] }))] }), showDrawer && selectedRec && (_jsxs("div", { className: "fixed inset-0 z-50 overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 bg-black bg-opacity-50", onClick: () => setShowDrawer(false) }), _jsx("div", { className: "absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl", children: _jsxs("div", { className: "flex flex-col h-full", children: [_jsx("div", { className: "px-6 py-4 border-b border-gray-200", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-medium text-gray-900", children: "Recommendation Details" }), _jsx("button", { onClick: () => setShowDrawer(false), className: "text-gray-400 hover:text-gray-600", children: "\u2715" })] }) }), _jsx("div", { className: "flex-1 overflow-y-auto px-6 py-4", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900", children: "Type & Severity" }), _jsxs("div", { className: "mt-1 flex space-x-2", children: [_jsx("span", { className: "text-sm text-gray-600", children: getTypeLabel(selectedRec.type) }), _jsx("span", { className: `inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(selectedRec.severity)}`, children: selectedRec.severity })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900", children: "Title" }), _jsx("p", { className: "mt-1 text-sm text-gray-600", children: selectedRec.title })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900", children: "Description" }), _jsx("p", { className: "mt-1 text-sm text-gray-600", children: selectedRec.description })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900", children: "Impact Score" }), _jsxs("p", { className: "mt-1 text-sm text-gray-600", children: [selectedRec.impact_score, "/100"] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900", children: "Evidence" }), _jsx("pre", { className: "mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded", children: JSON.stringify(selectedRec.evidence, null, 2) })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900", children: "Quick Links" }), _jsx("div", { className: "mt-1 space-y-1", children: selectedRec.links.map((link, index) => (_jsxs("a", { href: link.href, className: "block text-sm text-blue-600 hover:text-blue-800", children: [link.label, " \u2192"] }, index))) })] }), selectedRec.note && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900", children: "Note" }), _jsx("p", { className: "mt-1 text-sm text-gray-600", children: selectedRec.note })] }))] }) }), _jsxs("div", { className: "px-6 py-4 border-t border-gray-200 space-y-2", children: [selectedRec.status === 'open' && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => updateRecommendationStatus(selectedRec.rec_id, 'resolved'), className: "w-full bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700", children: "Mark as Resolved" }), _jsx("button", { onClick: () => updateRecommendationStatus(selectedRec.rec_id, 'dismissed'), className: "w-full bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700", children: "Dismiss" })] })), selectedRec.status !== 'open' && (_jsx("button", { onClick: () => resetRecommendationStatus(selectedRec.rec_id), className: "w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700", children: "Reset to Open" }))] })] }) })] }))] }));
};
export default Recommendations;
