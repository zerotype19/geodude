import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
export default function Content() {
    const [content, setContent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newContent, setNewContent] = useState({
        project_id: "",
        domain: "",
        url: "",
        type: "page",
        metadata: ""
    });
    useEffect(() => {
        loadContent();
    }, []);
    async function loadContent() {
        setLoading(true);
        try {
            // For now, using a placeholder project_id - in real app this would come from context
            const response = await fetch(`${API_BASE}/api/content?project_id=1`, FETCH_OPTS);
            if (response.ok) {
                const data = await response.json();
                setContent(data.content || []);
            }
            else {
                console.error("Failed to load content:", response.status);
            }
        }
        catch (error) {
            console.error("Error loading content:", error);
        }
        finally {
            setLoading(false);
        }
    }
    async function addContent() {
        if (!newContent.project_id || !newContent.domain || !newContent.url)
            return;
        try {
            const response = await fetch(`${API_BASE}/api/content`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newContent)
            });
            if (response.ok) {
                setNewContent({ project_id: "", domain: "", url: "", type: "page", metadata: "" });
                await loadContent();
            }
            else {
                console.error("Failed to add content");
            }
        }
        catch (error) {
            console.error("Error adding content:", error);
        }
    }
    return (_jsx(Shell, { children: _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-slate-900", children: "Content Assets" }), _jsx("p", { className: "text-slate-600 mt-2", children: "Manage your content that AI platforms can reference and recommend" })] }), _jsx(Card, { title: "Add Content Asset", children: _jsxs("form", { onSubmit: (e) => { e.preventDefault(); addContent(); }, className: "space-y-4", children: [_jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Project ID" }), _jsx("input", { type: "text", value: newContent.project_id, onChange: (e) => setNewContent({ ...newContent, project_id: e.target.value }), placeholder: "1", required: true, className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Domain" }), _jsx("input", { type: "text", value: newContent.domain, onChange: (e) => setNewContent({ ...newContent, domain: e.target.value }), placeholder: "example.com", required: true, className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "URL" }), _jsx("input", { type: "url", value: newContent.url, onChange: (e) => setNewContent({ ...newContent, url: e.target.value }), placeholder: "https://example.com/page", required: true, className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Type" }), _jsxs("select", { value: newContent.type, onChange: (e) => setNewContent({ ...newContent, type: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "page", children: "Page" }), _jsx("option", { value: "article", children: "Article" }), _jsx("option", { value: "product", children: "Product" }), _jsx("option", { value: "faq", children: "FAQ" }), _jsx("option", { value: "guide", children: "Guide" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Metadata (Optional)" }), _jsx("textarea", { value: newContent.metadata, onChange: (e) => setNewContent({ ...newContent, metadata: e.target.value }), placeholder: "JSON metadata or description", rows: 3, className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] }), _jsx("button", { type: "submit", disabled: !newContent.project_id || !newContent.domain || !newContent.url, className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: "Add Content" })] }) }), _jsx(Card, { title: "Content Assets", children: loading ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "Loading content..." })) : content.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No content assets found. Add your first content above." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-slate-500 border-b", children: [_jsx("th", { className: "py-3 pr-4", children: "URL" }), _jsx("th", { className: "py-3 pr-4", children: "Type" }), _jsx("th", { className: "py-3 pr-4", children: "Domain" }), _jsx("th", { className: "py-3 pr-4", children: "Metadata" }), _jsx("th", { className: "py-3 pr-4", children: "Added" })] }) }), _jsx("tbody", { children: content.map((asset) => (_jsxs("tr", { className: "border-b", children: [_jsx("td", { className: "py-3 pr-4", children: _jsx("a", { href: asset.url, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:underline truncate block max-w-xs", children: asset.url }) }), _jsx("td", { className: "py-3 pr-4", children: _jsx("span", { className: `px-2 py-1 text-xs rounded-full ${asset.type === 'page' ? 'bg-blue-100 text-blue-800' :
                                                        asset.type === 'article' ? 'bg-green-100 text-green-800' :
                                                            asset.type === 'product' ? 'bg-purple-100 text-purple-800' :
                                                                asset.type === 'faq' ? 'bg-orange-100 text-orange-800' :
                                                                    'bg-gray-100 text-gray-800'}`, children: asset.type }) }), _jsx("td", { className: "py-3 pr-4 font-medium", children: asset.domain }), _jsx("td", { className: "py-3 pr-4 text-xs text-gray-600 font-mono max-w-xs truncate", children: asset.metadata || "—" }), _jsx("td", { className: "py-3 pr-4 text-gray-600", children: new Date(asset.created_at).toLocaleDateString() })] }, asset.id))) })] }) })) })] }) }));
}
