import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE, FETCH_OPTS } from '../config';
import Shell from '../components/Shell';
const Content = () => {
    const { user, project } = useAuth();
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [filters, setFilters] = useState({
        window: '24h',
        q: '',
        type: '',
        aiOnly: false,
        page: 1,
        pageSize: 50
    });
    const [total, setTotal] = useState(0);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newAsset, setNewAsset] = useState({ url: '', type: 'page' });
    const [assetDetails, setAssetDetails] = useState({});
    useEffect(() => {
        if (project?.id) {
            loadAssets();
        }
    }, [project?.id, filters]);
    const loadAssets = async () => {
        if (!project?.id)
            return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                project_id: project.id,
                window: filters.window,
                q: filters.q,
                type: filters.type,
                aiOnly: filters.aiOnly.toString(),
                page: filters.page.toString(),
                pageSize: filters.pageSize.toString()
            });
            const response = await fetch(`${API_BASE}/api/content?${params}`, FETCH_OPTS);
            if (response.ok) {
                const data = await response.json();
                setAssets(data.items || []);
                setTotal(data.total || 0);
            }
            else {
                console.error('Failed to load content assets');
            }
        }
        catch (error) {
            console.error('Error loading content assets:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const loadAssetDetail = async (assetId) => {
        if (assetDetails[assetId])
            return; // Already loaded
        try {
            const response = await fetch(`${API_BASE}/api/content/${assetId}/detail?window=7d`, FETCH_OPTS);
            if (response.ok) {
                const detail = await response.json();
                setAssetDetails(prev => ({ ...prev, [assetId]: detail }));
            }
        }
        catch (error) {
            console.error('Error loading asset detail:', error);
        }
    };
    const toggleRowExpansion = (assetId) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(assetId)) {
            newExpanded.delete(assetId);
        }
        else {
            newExpanded.add(assetId);
            loadAssetDetail(assetId);
        }
        setExpandedRows(newExpanded);
    };
    const handleAddAsset = async () => {
        if (!project?.id || !newAsset.url.trim())
            return;
        try {
            const response = await fetch(`${API_BASE}/api/content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                ...FETCH_OPTS,
                body: JSON.stringify({
                    project_id: project.id,
                    property_id: 1, // TODO: Get from project properties
                    url: newAsset.url,
                    type: newAsset.type
                })
            });
            if (response.ok) {
                setShowAddModal(false);
                setNewAsset({ url: '', type: 'page' });
                loadAssets(); // Refresh the list
            }
        }
        catch (error) {
            console.error('Error creating asset:', error);
        }
    };
    const getCoverageBadge = (score) => {
        if (score < 34)
            return { label: 'Low', color: 'bg-red-100 text-red-800' };
        if (score < 67)
            return { label: 'Med', color: 'bg-yellow-100 text-yellow-800' };
        return { label: 'High', color: 'bg-green-100 text-green-800' };
    };
    const truncateUrl = (url) => {
        if (url.length <= 50)
            return url;
        return url.substring(0, 25) + '...' + url.substring(url.length - 20);
    };
    if (!project?.id) {
        return (_jsx("div", { className: "p-6", children: _jsx(Card, { title: "Content Assets", children: _jsx("div", { className: "p-6 text-center text-gray-500", children: "Please select a project to view content assets." }) }) }));
    }
    return (_jsx(Shell, { children: _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Content Assets" }), _jsx("p", { className: "text-gray-600", children: "Track AI visibility and engagement across your content" })] }), _jsx("button", { onClick: () => setShowAddModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors", children: "Add Content" })] }), _jsx(Card, { title: "Filters", children: _jsx("div", { className: "p-6 space-y-4", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Search" }), _jsx("input", { type: "text", placeholder: "Search URLs...", value: filters.q, onChange: (e) => setFilters(prev => ({ ...prev, q: e.target.value, page: 1 })), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Type" }), _jsxs("select", { value: filters.type, onChange: (e) => setFilters(prev => ({ ...prev, type: e.target.value, page: 1 })), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "", children: "All Types" }), _jsx("option", { value: "page", children: "Page" }), _jsx("option", { value: "article", children: "Article" }), _jsx("option", { value: "product", children: "Product" }), _jsx("option", { value: "other", children: "Other" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Time Window" }), _jsxs("select", { value: filters.window, onChange: (e) => setFilters(prev => ({ ...prev, window: e.target.value, page: 1 })), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "15m", children: "Last 15 minutes" }), _jsx("option", { value: "24h", children: "Last 24 hours" }), _jsx("option", { value: "7d", children: "Last 7 days" })] })] }), _jsx("div", { className: "flex items-end", children: _jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", checked: filters.aiOnly, onChange: (e) => setFilters(prev => ({ ...prev, aiOnly: e.target.checked, page: 1 })), className: "mr-2" }), _jsx("span", { className: "text-sm text-gray-700", children: "AI activity only" })] }) })] }) }) }), _jsxs(Card, { title: `Content Assets (${total} total)`, children: [_jsx("div", { className: "overflow-x-auto", children: loading ? (_jsx("div", { className: "p-6 text-center text-gray-500", children: "Loading..." })) : assets.length === 0 ? (_jsxs("div", { className: "p-6 text-center text-gray-500", children: [_jsx("p", { className: "mb-4", children: "No content assets found." }), _jsx("p", { className: "text-sm", children: "Create your first content asset or check your installation configuration." })] })) : (_jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "URL" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Type" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Last Seen" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "15m" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "24h" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "AI Referrals" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Coverage" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: assets.map((asset) => {
                                            const coverageBadge = getCoverageBadge(asset.coverage_score);
                                            const isExpanded = expandedRows.has(asset.id);
                                            return (_jsxs(React.Fragment, { children: [_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "text-sm font-medium text-gray-900", title: asset.url, children: truncateUrl(asset.url) }), _jsx("button", { onClick: () => navigator.clipboard.writeText(asset.url), className: "text-gray-400 hover:text-gray-600", title: "Copy URL", children: "\uD83D\uDCCB" })] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize", children: asset.type }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: asset.last_seen ? new Date(asset.last_seen).toLocaleString() : 'Never' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: asset.events_15m }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: asset.events_24h }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: asset.ai_referrals_24h }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("span", { className: `inline-flex px-2 py-1 text-xs font-semibold rounded-full ${coverageBadge.color}`, children: [coverageBadge.label, " (", asset.coverage_score, ")"] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium", children: _jsxs("button", { onClick: () => toggleRowExpansion(asset.id), className: "text-blue-600 hover:text-blue-900", children: [isExpanded ? 'Hide' : 'View', " Details"] }) })] }), isExpanded && (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-6 py-4 bg-gray-50", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "By Source (24h)" }), _jsx("div", { className: "flex flex-wrap gap-2", children: asset.by_source_24h.length > 0 ? (asset.by_source_24h.map((source) => (_jsxs("span", { className: "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800", children: [source.slug, ": ", source.events] }, source.slug)))) : (_jsx("span", { className: "text-gray-500", children: "No AI source activity" })) })] }), assetDetails[asset.id] && (_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Recent Events" }), _jsx("div", { className: "space-y-2", children: assetDetails[asset.id].recent_events.length > 0 ? (assetDetails[asset.id].recent_events.map((event, idx) => (_jsxs("div", { className: "flex items-center space-x-4 text-sm text-gray-600", children: [_jsx("span", { children: new Date(event.occurred_at).toLocaleString() }), _jsx("span", { className: "capitalize", children: event.event_type }), _jsxs("span", { children: ["via ", event.source] }), event.path && _jsxs("span", { children: ["at ", event.path] })] }, idx)))) : (_jsx("span", { className: "text-gray-500", children: "No recent events" })) })] }))] }) }) }))] }, asset.id));
                                        }) })] })) }), total > filters.pageSize && (_jsx("div", { className: "px-6 py-4 border-t border-gray-200", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-700", children: ["Showing ", ((filters.page - 1) * filters.pageSize) + 1, " to ", Math.min(filters.page * filters.pageSize, total), " of ", total] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => setFilters(prev => ({ ...prev, page: prev.page - 1 })), disabled: filters.page === 1, className: "px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed", children: "Previous" }), _jsx("button", { onClick: () => setFilters(prev => ({ ...prev, page: prev.page + 1 })), disabled: filters.page * filters.pageSize >= total, className: "px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed", children: "Next" })] })] }) }))] }), showAddModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-md", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Add Content Asset" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "URL" }), _jsx("input", { type: "url", placeholder: "https://example.com/page", value: newAsset.url, onChange: (e) => setNewAsset(prev => ({ ...prev, url: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Type" }), _jsxs("select", { value: newAsset.type, onChange: (e) => setNewAsset(prev => ({ ...prev, type: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "page", children: "Page" }), _jsx("option", { value: "article", children: "Article" }), _jsx("option", { value: "product", children: "Product" }), _jsx("option", { value: "other", children: "Other" })] })] })] }), _jsxs("div", { className: "flex justify-end space-x-3 mt-6", children: [_jsx("button", { onClick: () => setShowAddModal(false), className: "px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50", children: "Cancel" }), _jsx("button", { onClick: handleAddAsset, disabled: !newAsset.url.trim(), className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50", children: "Add Asset" })] })] }) }))] }) }));
};
export default Content;
