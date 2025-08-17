import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Link, Quote, ExternalLink, Search, Calendar, BarChart3 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Shell from "../components/Shell";
export default function Citations() {
    const { project } = useAuth();
    const [summary, setSummary] = useState(null);
    const [citations, setCitations] = useState([]);
    const [selectedCitation, setSelectedCitation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    // Filters
    const [window, setWindow] = useState("7d");
    const [sourceFilter, setSourceFilter] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 50;
    useEffect(() => {
        if (project?.id) {
            loadSummary();
            loadCitations();
        }
    }, [project?.id, window, sourceFilter, searchQuery, page]);
    const loadSummary = async () => {
        try {
            const response = await fetch(`https://api.optiview.ai/api/citations/summary?project_id=${project?.id}&window=${window}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setSummary(data);
            }
        }
        catch (error) {
            console.error('Failed to load citations summary:', error);
        }
    };
    const loadCitations = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                project_id: project?.id || '',
                window,
                page: page.toString(),
                pageSize: pageSize.toString()
            });
            if (sourceFilter)
                params.append('source', sourceFilter);
            if (searchQuery.trim())
                params.append('q', searchQuery.trim());
            const response = await fetch(`https://api.optiview.ai/api/citations?${params}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setCitations(data.items);
                setTotal(data.total);
            }
        }
        catch (error) {
            console.error('Failed to load citations:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const loadCitationDetail = async (citationId) => {
        try {
            const response = await fetch(`https://api.optiview.ai/api/citations/detail?id=${citationId}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setSelectedCitation(data);
                setDrawerOpen(true);
            }
        }
        catch (error) {
            console.error('Failed to load citation detail:', error);
        }
    };
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    const getWindowLabel = (w) => {
        switch (w) {
            case '15m': return 'Last 15 minutes';
            case '24h': return 'Last 24 hours';
            case '7d': return 'Last 7 days';
            default: return 'Last 7 days';
        }
    };
    if (!project) {
        return (_jsx(Shell, { children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "text-center py-8", children: [_jsx("h2", { className: "text-lg font-medium text-gray-900", children: "No project selected" }), _jsx("p", { className: "text-gray-500", children: "Please select a project to view citations." })] }) }) }));
    }
    return (_jsx(Shell, { children: _jsxs("div", { className: "p-6 space-y-6", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsxs("div", { children: [_jsxs("h1", { className: "text-2xl font-bold text-gray-900 flex items-center gap-2", children: [_jsx(Quote, { className: "h-6 w-6" }), "Citations & Mentions"] }), _jsx("p", { className: "text-gray-600", children: "Track where your content is referenced in AI tools" })] }) }), summary && (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-white p-4 rounded-lg border", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(BarChart3, { className: "h-4 w-4 text-blue-500" }), _jsx("span", { className: "text-sm font-medium text-gray-600", children: "Total Citations" })] }), _jsx("div", { className: "text-2xl font-bold text-gray-900", children: summary.totals.citations }), _jsx("div", { className: "text-xs text-gray-500", children: getWindowLabel(window) })] }), _jsxs("div", { className: "bg-white p-4 rounded-lg border", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Link, { className: "h-4 w-4 text-green-500" }), _jsx("span", { className: "text-sm font-medium text-gray-600", children: "AI Sources" })] }), _jsx("div", { className: "text-2xl font-bold text-gray-900", children: summary.totals.by_source.length }), _jsx("div", { className: "text-xs text-gray-500", children: "Active sources" })] }), _jsxs("div", { className: "bg-white p-4 rounded-lg border", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Quote, { className: "h-4 w-4 text-purple-500" }), _jsx("span", { className: "text-sm font-medium text-gray-600", children: "Top Content" })] }), _jsx("div", { className: "text-2xl font-bold text-gray-900", children: summary.top_content.length }), _jsx("div", { className: "text-xs text-gray-500", children: "Different URLs cited" })] }), _jsxs("div", { className: "bg-white p-4 rounded-lg border", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Calendar, { className: "h-4 w-4 text-orange-500" }), _jsx("span", { className: "text-sm font-medium text-gray-600", children: "Recent Activity" })] }), _jsx("div", { className: "text-2xl font-bold text-gray-900", children: summary.timeseries.slice(-1)[0]?.count || 0 }), _jsx("div", { className: "text-xs text-gray-500", children: "Citations today" })] })] })), summary && summary.totals.by_source.length > 0 && (_jsxs("div", { className: "bg-white p-4 rounded-lg border", children: [_jsx("h3", { className: "text-sm font-medium text-gray-700 mb-3", children: "Sources breakdown" }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("button", { onClick: () => setSourceFilter(""), className: `px-3 py-1 rounded-full text-sm ${sourceFilter === ""
                                        ? "bg-blue-100 text-blue-800 border-blue-200"
                                        : "bg-gray-100 text-gray-700 border-gray-200"} border hover:bg-blue-50`, children: ["All (", summary.totals.citations, ")"] }), summary.totals.by_source.map((source) => (_jsxs("button", { onClick: () => setSourceFilter(source.slug), className: `px-3 py-1 rounded-full text-sm ${sourceFilter === source.slug
                                        ? "bg-blue-100 text-blue-800 border-blue-200"
                                        : "bg-gray-100 text-gray-700 border-gray-200"} border hover:bg-blue-50`, children: [source.name, " (", source.count, ")"] }, source.slug)))] })] })), _jsx("div", { className: "bg-white p-4 rounded-lg border", children: _jsxs("div", { className: "flex flex-col sm:flex-row gap-4", children: [_jsx("div", { className: "flex-1", children: _jsxs("div", { className: "relative", children: [_jsx(Search, { className: "h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" }), _jsx("input", { type: "text", placeholder: "Search URLs or snippets...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "pl-9 pr-3 py-2 border border-gray-300 rounded-md w-full" })] }) }), _jsx("div", { children: _jsxs("select", { value: window, onChange: (e) => setWindow(e.target.value), className: "px-3 py-2 border border-gray-300 rounded-md", children: [_jsx("option", { value: "15m", children: "Last 15 minutes" }), _jsx("option", { value: "24h", children: "Last 24 hours" }), _jsx("option", { value: "7d", children: "Last 7 days" })] }) })] }) }), _jsxs("div", { className: "bg-white rounded-lg border", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-gray-50 border-b", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Detected" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Source" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Content URL" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Snippet" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Ref URL" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: loading ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-4 py-8 text-center", children: _jsx("div", { className: "animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto" }) }) })) : citations.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-4 py-8 text-center", children: _jsxs("div", { className: "text-gray-500", children: [_jsx(Quote, { className: "h-8 w-8 mx-auto mb-2 opacity-50" }), _jsx("h3", { className: "text-lg font-medium mb-1", children: "No citations yet" }), _jsxs("p", { className: "text-sm", children: ["Citations appear when AI tools reference your content. Check our", " ", _jsx("a", { href: "/docs/citations", className: "text-blue-600 hover:text-blue-800", children: "documentation" }), " ", "to learn how mentions are detected."] })] }) }) })) : (citations.map((citation) => (_jsxs("tr", { className: "hover:bg-gray-50 cursor-pointer", onClick: () => loadCitationDetail(citation.id), children: [_jsx("td", { className: "px-4 py-3 text-sm text-gray-900", children: formatDate(citation.detected_at) }), _jsx("td", { className: "px-4 py-3 text-sm", children: _jsx("span", { className: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800", children: citation.source.name }) }), _jsx("td", { className: "px-4 py-3 text-sm", children: citation.content ? (_jsx("a", { href: citation.content.url, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:text-blue-800 truncate max-w-xs block", onClick: (e) => e.stopPropagation(), children: citation.content.url })) : (_jsx("span", { className: "text-gray-400", children: "No content linked" })) }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-600 max-w-xs", children: citation.snippet ? (_jsx("span", { className: "truncate block", children: citation.snippet })) : (_jsx("span", { className: "text-gray-400", children: "No snippet" })) }), _jsx("td", { className: "px-4 py-3 text-sm", children: citation.ref_url ? (_jsxs("a", { href: citation.ref_url, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:text-blue-800 inline-flex items-center gap-1", onClick: (e) => e.stopPropagation(), children: [_jsx(ExternalLink, { className: "h-3 w-3" }), "View"] })) : (_jsx("span", { className: "text-gray-400", children: "No link" })) })] }, citation.id)))) })] }) }), total > pageSize && (_jsxs("div", { className: "px-4 py-3 border-t bg-gray-50 flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-700", children: ["Showing ", (page - 1) * pageSize + 1, " to ", Math.min(page * pageSize, total), " of ", total, " citations"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setPage(page - 1), disabled: page === 1, className: "px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed", children: "Previous" }), _jsx("button", { onClick: () => setPage(page + 1), disabled: page * pageSize >= total, className: "px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed", children: "Next" })] })] }))] }), drawerOpen && selectedCitation && (_jsxs("div", { className: "fixed inset-0 z-50 overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 bg-black bg-opacity-50", onClick: () => setDrawerOpen(false) }), _jsx("div", { className: "absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl", children: _jsxs("div", { className: "p-6 space-y-6 h-full overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900", children: "Citation Details" }), _jsx("button", { onClick: () => setDrawerOpen(false), className: "text-gray-400 hover:text-gray-600", children: "\u00D7" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Source" }), _jsx("span", { className: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800", children: selectedCitation.citation.source.name })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Detected" }), _jsx("p", { className: "text-sm text-gray-900", children: formatDate(selectedCitation.citation.detected_at) })] }), selectedCitation.citation.content && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Content URL" }), _jsx("a", { href: selectedCitation.citation.content.url, target: "_blank", rel: "noopener noreferrer", className: "text-sm text-blue-600 hover:text-blue-800 break-all", children: selectedCitation.citation.content.url })] })), selectedCitation.citation.ref_url && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "AI Reference URL" }), _jsxs("a", { href: selectedCitation.citation.ref_url, target: "_blank", rel: "noopener noreferrer", className: "text-sm text-blue-600 hover:text-blue-800 break-all flex items-center gap-1", children: [_jsx(ExternalLink, { className: "h-3 w-3" }), selectedCitation.citation.ref_url] })] })), selectedCitation.citation.snippet && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Snippet" }), _jsxs("p", { className: "text-sm text-gray-900 bg-gray-50 p-3 rounded-md", children: ["\"", selectedCitation.citation.snippet, "\""] })] })), selectedCitation.citation.confidence && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Confidence" }), _jsxs("p", { className: "text-sm text-gray-900", children: [(selectedCitation.citation.confidence * 100).toFixed(1), "%"] })] })), selectedCitation.related.recent_for_content.length > 0 && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Recent Citations for This Content" }), _jsx("div", { className: "space-y-2", children: selectedCitation.related.recent_for_content.map((item) => (_jsxs("div", { className: "flex justify-between items-center text-xs bg-gray-50 p-2 rounded", children: [_jsx("span", { children: formatDate(item.detected_at) }), _jsx("span", { className: "font-medium", children: item.source.name })] }, item.id))) })] })), selectedCitation.related.recent_referrals.length > 0 && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700", children: "Related Referrals" }), _jsx("div", { className: "space-y-2", children: selectedCitation.related.recent_referrals.map((item) => (_jsxs("div", { className: "text-xs bg-gray-50 p-2 rounded space-y-1", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: formatDate(item.detected_at) }), _jsx("span", { className: "font-medium", children: item.source.name })] }), item.ref_url && (_jsx("a", { href: item.ref_url, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:text-blue-800 break-all", children: item.ref_url }))] }, item.id))) })] }))] })] }) })] }))] }) }));
}
