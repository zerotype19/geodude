import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";
const CATEGORY_OPTIONS = [
    { value: "chat_assistant", label: "Chat Assistant", description: "AI chat tools like ChatGPT, Claude" },
    { value: "search_engine", label: "Search Engine", description: "AI-powered search like Perplexity" },
    { value: "crawler", label: "Crawler", description: "AI web crawlers and scrapers" },
    { value: "browser_ai", label: "Browser AI", description: "Browser-based AI assistants" },
    { value: "model_api", label: "Model API", description: "Direct AI model API calls" },
    { value: "other", label: "Other", description: "Other AI platforms and tools" }
];
export default function Sources() {
    const { project, user } = useAuth();
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [sortBy, setSortBy] = useState("last_seen");
    const [sortOrder, setSortOrder] = useState("desc");
    const [filter, setFilter] = useState("all");
    // Add Source modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSuggestModal, setShowSuggestModal] = useState(false);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [selectedSource, setSelectedSource] = useState(null);
    // Form state
    const [newSource, setNewSource] = useState({
        name: "",
        slug: "",
        category: "chat_assistant",
        is_active: true
    });
    const [suggestPattern, setSuggestPattern] = useState({
        ai_source_id: 0,
        pattern: ""
    });
    useEffect(() => {
        if (project?.id) {
            loadSources();
        }
    }, [project]);
    async function loadSources() {
        if (!project?.id)
            return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/api/sources?project_id=${project.id}&includeTop=false`, FETCH_OPTS);
            if (response.ok) {
                const data = await response.json();
                setSources(data || []);
            }
            else {
                setError(`Failed to load sources: ${response.status}`);
            }
        }
        catch (error) {
            setError("Error loading sources");
            console.error("Error loading sources:", error);
        }
        finally {
            setLoading(false);
        }
    }
    async function loadTopContent(sourceId) {
        if (!project?.id)
            return;
        try {
            const response = await fetch(`${API_BASE}/api/sources?project_id=${project.id}&includeTop=true`, FETCH_OPTS);
            if (response.ok) {
                const data = await response.json();
                const sourceWithTopContent = data.find((s) => s.id === sourceId);
                if (sourceWithTopContent?.top_content) {
                    setSources(prev => prev.map(s => s.id === sourceId ? { ...s, top_content: sourceWithTopContent.top_content } : s));
                }
            }
        }
        catch (error) {
            console.error("Error loading top content:", error);
        }
    }
    async function toggleSource(source, enabled) {
        if (!project?.id)
            return;
        // Optimistic update
        const originalSources = [...sources];
        setSources(prev => prev.map(s => s.id === source.id ? { ...s, enabled } : s));
        try {
            if (enabled) {
                // Enable source
                const response = await fetch(`${API_BASE}/api/sources/enable`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        project_id: project.id,
                        ai_source_id: source.id,
                        enabled: true
                    })
                });
                if (!response.ok) {
                    throw new Error("Failed to enable source");
                }
            }
            else {
                // Disable source
                const response = await fetch(`${API_BASE}/api/sources/enable`, {
                    method: "DELETE",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        project_id: project.id,
                        ai_source_id: source.id
                    })
                });
                if (!response.ok) {
                    throw new Error("Failed to disable source");
                }
            }
            // TODO: Track metrics events
            // sources_enable_clicked or sources_disable_clicked
        }
        catch (error) {
            // Revert on error
            setSources(originalSources);
            setError(`Failed to ${enabled ? 'enable' : 'disable'} source`);
            console.error(`Error ${enabled ? 'enabling' : 'disabling'} source:`, error);
        }
    }
    async function createGlobalSource() {
        if (!project?.id)
            return;
        try {
            const response = await fetch(`${API_BASE}/admin/sources`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSource)
            });
            if (response.ok) {
                setShowAdminModal(false);
                setNewSource({ name: "", slug: "", category: "chat_assistant", is_active: true });
                await loadSources();
            }
            else {
                throw new Error("Failed to create global source");
            }
        }
        catch (error) {
            setError("Failed to create global source");
            console.error("Error creating global source:", error);
        }
    }
    async function submitPatternSuggestion() {
        if (!project?.id || !suggestPattern.pattern)
            return;
        try {
            const patternJson = JSON.parse(suggestPattern.pattern);
            if (JSON.stringify(patternJson).length > 2048) {
                setError("Pattern too large (max 2KB)");
                return;
            }
            const response = await fetch(`${API_BASE}/api/sources/enable`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: project.id,
                    ai_source_id: suggestPattern.ai_source_id,
                    enabled: true,
                    suggested_pattern_json: patternJson
                })
            });
            if (response.ok) {
                setShowSuggestModal(false);
                setSuggestPattern({ ai_source_id: 0, pattern: "" });
                await loadSources();
                // TODO: Success toast: "Suggestion submitted. We'll review it soon."
            }
            else {
                throw new Error("Failed to submit suggestion");
            }
        }
        catch (error) {
            if (error instanceof SyntaxError) {
                setError("Invalid JSON pattern");
            }
            else {
                setError("Failed to submit suggestion");
            }
            console.error("Error submitting suggestion:", error);
        }
    }
    function toggleRowExpansion(sourceId) {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(sourceId)) {
            newExpanded.delete(sourceId);
        }
        else {
            newExpanded.add(sourceId);
            // Load top content when expanding
            loadTopContent(sourceId);
        }
        setExpandedRows(newExpanded);
    }
    function getSortedAndFilteredSources() {
        let filtered = [...sources];
        // Apply filters
        switch (filter) {
            case "enabled":
                filtered = filtered.filter(s => s.enabled);
                break;
            case "has_activity":
                filtered = filtered.filter(s => s.events_24h > 0);
                break;
            case "no_activity":
                filtered = filtered.filter(s => s.events_24h === 0);
                break;
        }
        // Apply sorting
        filtered.sort((a, b) => {
            let aVal, bVal;
            switch (sortBy) {
                case "last_seen":
                    aVal = a.last_seen || "0000-01-01";
                    bVal = b.last_seen || "0000-01-01";
                    break;
                case "events_24h":
                    aVal = a.events_24h;
                    bVal = b.events_24h;
                    break;
                case "name":
                    aVal = a.name.toLowerCase();
                    bVal = b.name.toLowerCase();
                    break;
                default:
                    aVal = a.last_seen || "0000-01-01";
                    bVal = b.last_seen || "0000-01-01";
            }
            if (sortOrder === "asc") {
                return aVal > bVal ? 1 : -1;
            }
            else {
                return aVal < bVal ? 1 : -1;
            }
        });
        return filtered;
    }
    const sortedSources = getSortedAndFilteredSources();
    const hasActivity = sources.some(s => s.events_24h > 0);
    const hasEnabled = sources.some(s => s.enabled);
    if (!project?.id) {
        return (_jsx(Shell, { children: _jsx("div", { className: "text-center py-8 text-gray-500", children: "No project selected. Please select a project to view sources." }) }));
    }
    return (_jsxs(Shell, { children: [_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-slate-900", children: "AI Sources" }), _jsxs("p", { className: "text-slate-600 mt-2", children: ["Manage and monitor AI platforms that reference your ", project.name, " content"] })] }), _jsx("a", { href: "/docs/sources", className: "text-blue-600 hover:text-blue-800 underline text-sm", children: "Docs \u2192" })] }), _jsx(Card, { title: "Add AI Source", children: _jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx("button", { onClick: () => setShowAddModal(true), className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: "Enable Existing Source" }), !user?.is_admin && (_jsx("button", { onClick: () => setShowSuggestModal(true), className: "px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2", children: "Suggest Pattern" })), user?.is_admin && (_jsx("button", { onClick: () => setShowAdminModal(true), className: "px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2", children: "Create Global Source" }))] }) }) }), error && (_jsx("div", { className: "bg-red-50 border border-red-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("svg", { className: "h-5 w-5 text-red-400", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z", clipRule: "evenodd" }) }) }), _jsx("div", { className: "ml-3", children: _jsx("p", { className: "text-sm text-red-800", children: error }) }), _jsx("div", { className: "ml-auto pl-3", children: _jsxs("button", { onClick: () => setError(null), className: "text-red-400 hover:text-red-600", children: [_jsx("span", { className: "sr-only", children: "Dismiss" }), _jsx("svg", { className: "h-5 w-5", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z", clipRule: "evenodd" }) })] }) })] }) })), _jsxs(Card, { title: "AI Sources", children: [_jsxs("div", { className: "mb-4 flex flex-wrap gap-4 items-center", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Sort by:" }), _jsxs("select", { value: sortBy, onChange: (e) => setSortBy(e.target.value), className: "text-sm border border-gray-300 rounded px-2 py-1", children: [_jsx("option", { value: "last_seen", children: "Last Seen" }), _jsx("option", { value: "events_24h", children: "24h Events" }), _jsx("option", { value: "name", children: "Name" })] }), _jsx("button", { onClick: () => setSortOrder(sortOrder === "asc" ? "desc" : "asc"), className: "text-sm text-gray-600 hover:text-gray-800", children: sortOrder === "asc" ? "↑" : "↓" })] }), _jsx("div", { className: "flex space-x-2", children: ["all", "enabled", "has_activity", "no_activity"].map((filterOption) => (_jsxs("button", { onClick: () => setFilter(filterOption), className: `px-3 py-1 text-xs rounded-full ${filter === filterOption
                                                ? "bg-blue-100 text-blue-800"
                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`, children: [filterOption === "all" && "All", filterOption === "enabled" && "Enabled", filterOption === "has_activity" && "Has Activity", filterOption === "no_activity" && "No Activity"] }, filterOption))) })] }), loading ? (_jsx("div", { className: "space-y-3", children: [...Array(8)].map((_, i) => (_jsx("div", { className: "animate-pulse", children: _jsx("div", { className: "h-12 bg-gray-200 rounded" }) }, i))) })) : sortedSources.length === 0 ? (_jsx("div", { className: "text-center py-12", children: !hasActivity && !hasEnabled ? (_jsxs("div", { children: [_jsx("p", { className: "text-lg text-gray-900 font-medium", children: "No AI sources yet" }), _jsx("p", { className: "text-gray-600 mt-1", children: "Add your first source above." })] })) : (_jsxs("div", { children: [_jsx("p", { className: "text-lg text-gray-900 font-medium", children: "No sources match your filters" }), _jsx("p", { className: "text-gray-600 mt-1", children: "Try adjusting your filter selection." })] })) })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-slate-500 border-b", children: [_jsx("th", { className: "py-3 pr-4", children: "Source" }), _jsx("th", { className: "py-3 pr-4", children: "Enabled" }), _jsx("th", { className: "py-3 pr-4", children: _jsx("span", { className: "cursor-help", title: "Number of events attributed to this source in the last 15 minutes", children: "Last Seen" }) }), _jsx("th", { className: "py-3 pr-4", children: _jsx("span", { className: "cursor-help", title: "Number of events attributed to this source in the last 15 minutes", children: "15m" }) }), _jsx("th", { className: "py-3 pr-4", children: _jsx("span", { className: "cursor-help", title: "Number of events attributed to this source in the last 24 hours", children: "24h" }) }), _jsx("th", { className: "py-3 pr-4", children: _jsx("span", { className: "cursor-help", title: "AI referrals detected in the last 24 hours", children: "Referrals (24h)" }) }), _jsx("th", { className: "py-3 pr-4", children: "Actions" })] }) }), _jsx("tbody", { children: sortedSources.map((source) => (_jsxs(_Fragment, { children: [_jsxs("tr", { className: "border-b hover:bg-gray-50", children: [_jsx("td", { className: "py-3 pr-4", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: source.name }), _jsx("div", { className: "text-xs text-gray-500", children: source.slug })] }), _jsx("span", { className: `px-2 py-1 text-xs rounded-full ${source.category === 'chat_assistant' ? 'bg-green-100 text-green-800' :
                                                                                source.category === 'search_engine' ? 'bg-blue-100 text-blue-800' :
                                                                                    source.category === 'crawler' ? 'bg-purple-100 text-purple-800' :
                                                                                        source.category === 'browser_ai' ? 'bg-yellow-100 text-yellow-800' :
                                                                                            source.category === 'model_api' ? 'bg-red-100 text-red-800' :
                                                                                                'bg-gray-100 text-gray-800'}`, children: source.category.replace('_', ' ') })] }) }), _jsx("td", { className: "py-3 pr-4", children: _jsx("button", { onClick: () => toggleSource(source, !source.enabled), className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${source.enabled ? 'bg-blue-600' : 'bg-gray-200'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${source.enabled ? 'translate-x-6' : 'translate-x-1'}` }) }) }), _jsx("td", { className: "py-3 pr-4 text-gray-600", children: source.last_seen ? (_jsx("span", { title: new Date(source.last_seen).toLocaleString(), children: new Date(source.last_seen).toLocaleDateString() })) : (_jsx("span", { className: "text-gray-400", children: "Never" })) }), _jsx("td", { className: "py-3 pr-4 text-gray-600", children: source.events_15m }), _jsx("td", { className: "py-3 pr-4 text-gray-600", children: source.events_24h }), _jsx("td", { className: "py-3 pr-4 text-gray-600", children: source.referrals_24h }), _jsx("td", { className: "py-3 pr-4", children: _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => toggleRowExpansion(source.id), className: "text-blue-600 hover:text-blue-800 text-sm", children: expandedRows.has(source.id) ? "Hide Details" : "View Details" }), !source.enabled && source.events_24h > 0 && (_jsx("button", { onClick: () => toggleSource(source, true), className: "text-green-600 hover:text-green-800 text-sm", children: "Enable" })), user?.is_admin && (_jsx("a", { href: `/admin/rules?s=${source.slug}`, className: "text-gray-600 hover:text-gray-800 text-sm", children: "Edit Global" }))] }) })] }, source.id), expandedRows.has(source.id) && (_jsx("tr", { className: "bg-gray-50", children: _jsx("td", { colSpan: 7, className: "py-4 px-4", children: _jsxs("div", { className: "space-y-3", children: [_jsx("h4", { className: "font-medium text-gray-900", children: "Top Content (Last 24h)" }), source.top_content && source.top_content.length > 0 ? (_jsx("div", { className: "space-y-2", children: source.top_content.map((content, idx) => (_jsxs("div", { className: "flex justify-between items-center text-sm", children: [_jsx("span", { className: "text-gray-700 truncate max-w-md", children: content.content_url }), _jsxs("span", { className: "text-gray-500 font-mono", children: [content.count, " views"] })] }, idx))) })) : (_jsx("p", { className: "text-gray-500 text-sm", children: "No content data available" }))] }) }) }, `${source.id}-expanded`))] }))) })] }) }))] })] }), showAddModal && (_jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50", children: _jsx("div", { className: "relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white", children: _jsxs("div", { className: "mt-3", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Enable Existing Source" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Select Source" }), _jsxs("select", { className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", onChange: (e) => {
                                                    const source = sources.find(s => s.id === parseInt(e.target.value));
                                                    if (source) {
                                                        toggleSource(source, true);
                                                        setShowAddModal(false);
                                                    }
                                                }, children: [_jsx("option", { value: "", children: "Choose a source..." }), sources.filter(s => !s.enabled).map(source => (_jsxs("option", { value: source.id, children: [source.name, " (", source.category.replace('_', ' '), ")"] }, source.id)))] })] }), _jsx("div", { className: "flex space-x-3", children: _jsx("button", { onClick: () => setShowAddModal(false), className: "flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400", children: "Cancel" }) })] })] }) }) })), showSuggestModal && (_jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50", children: _jsx("div", { className: "relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white", children: _jsxs("div", { className: "mt-3", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Suggest Pattern" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Select Source" }), _jsxs("select", { className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", onChange: (e) => setSuggestPattern(prev => ({ ...prev, ai_source_id: parseInt(e.target.value) })), children: [_jsx("option", { value: "", children: "Choose a source..." }), sources.map(source => (_jsxs("option", { value: source.id, children: [source.name, " (", source.category.replace('_', ' '), ")"] }, source.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Pattern JSON" }), _jsx("textarea", { value: suggestPattern.pattern, onChange: (e) => setSuggestPattern(prev => ({ ...prev, pattern: e.target.value })), placeholder: '{"ua_regex": ["pattern"], "referer_domains": ["domain.com"]}', className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Enter JSON pattern (max 2KB). See docs for schema." })] }), _jsxs("div", { className: "flex space-x-3", children: [_jsx("button", { onClick: () => setShowSuggestModal(false), className: "flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400", children: "Cancel" }), _jsx("button", { onClick: submitPatternSuggestion, disabled: !suggestPattern.ai_source_id || !suggestPattern.pattern, className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50", children: "Submit" })] })] })] }) }) })), showAdminModal && (_jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50", children: _jsx("div", { className: "relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white", children: _jsxs("div", { className: "mt-3", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Create Global Source" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Name" }), _jsx("input", { type: "text", value: newSource.name, onChange: (e) => setNewSource(prev => ({ ...prev, name: e.target.value })), placeholder: "ChatGPT", className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Slug" }), _jsx("input", { type: "text", value: newSource.slug, onChange: (e) => setNewSource(prev => ({ ...prev, slug: e.target.value })), placeholder: "chatgpt", className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Category" }), _jsx("select", { value: newSource.category, onChange: (e) => setNewSource(prev => ({ ...prev, category: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", children: CATEGORY_OPTIONS.map(option => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("div", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", checked: newSource.is_active, onChange: (e) => setNewSource(prev => ({ ...prev, is_active: e.target.checked })), className: "h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" }), _jsx("label", { className: "ml-2 block text-sm text-gray-900", children: "Active" })] }), _jsxs("div", { className: "flex space-x-3", children: [_jsx("button", { onClick: () => setShowAdminModal(false), className: "flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400", children: "Cancel" }), _jsx("button", { onClick: createGlobalSource, disabled: !newSource.name || !newSource.slug, className: "flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50", children: "Create" })] })] })] }) }) }))] }));
}
