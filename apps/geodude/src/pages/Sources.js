import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
export default function Sources() {
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newSource, setNewSource] = useState({ name: "", category: "search", fingerprint: "" });
    useEffect(() => {
        loadSources();
    }, []);
    async function loadSources() {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/sources`, FETCH_OPTS);
            if (response.ok) {
                const data = await response.json();
                setSources(data.sources || []);
            }
            else {
                console.error("Failed to load sources:", response.status);
            }
        }
        catch (error) {
            console.error("Error loading sources:", error);
        }
        finally {
            setLoading(false);
        }
    }
    async function addSource() {
        if (!newSource.name || !newSource.category)
            return;
        try {
            const response = await fetch(`${API_BASE}/api/sources`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSource)
            });
            if (response.ok) {
                setNewSource({ name: "", category: "search", fingerprint: "" });
                await loadSources();
            }
            else {
                console.error("Failed to add source");
            }
        }
        catch (error) {
            console.error("Error adding source:", error);
        }
    }
    return (_jsx(Shell, { children: _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-slate-900", children: "AI Sources" }), _jsx("p", { className: "text-slate-600 mt-2", children: "Manage and monitor AI platforms that reference your content" })] }), _jsx(Card, { title: "Add AI Source", children: _jsxs("form", { onSubmit: (e) => { e.preventDefault(); addSource(); }, className: "space-y-4", children: [_jsxs("div", { className: "grid md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Source Name" }), _jsx("input", { type: "text", value: newSource.name, onChange: (e) => setNewSource({ ...newSource, name: e.target.value }), placeholder: "ChatGPT, Claude, Gemini...", required: true, className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Category" }), _jsxs("select", { value: newSource.category, onChange: (e) => setNewSource({ ...newSource, category: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "search", children: "Search Engine" }), _jsx("option", { value: "chat", children: "Chat Assistant" }), _jsx("option", { value: "commerce", children: "E-commerce" }), _jsx("option", { value: "assistant", children: "Productivity Assistant" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Fingerprint (Optional)" }), _jsx("input", { type: "text", value: newSource.fingerprint, onChange: (e) => setNewSource({ ...newSource, fingerprint: e.target.value }), placeholder: "JSON pattern for detection", className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsx("button", { type: "submit", disabled: !newSource.name || !newSource.category, className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: "Add Source" })] }) }), _jsx(Card, { title: "AI Sources", children: loading ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "Loading sources..." })) : sources.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No AI sources found. Add your first source above." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-slate-500 border-b", children: [_jsx("th", { className: "py-3 pr-4", children: "Name" }), _jsx("th", { className: "py-3 pr-4", children: "Category" }), _jsx("th", { className: "py-3 pr-4", children: "Fingerprint" }), _jsx("th", { className: "py-3 pr-4", children: "Added" })] }) }), _jsx("tbody", { children: sources.map((source) => (_jsxs("tr", { className: "border-b", children: [_jsx("td", { className: "py-3 pr-4 font-medium", children: source.name }), _jsx("td", { className: "py-3 pr-4", children: _jsx("span", { className: `px-2 py-1 text-xs rounded-full ${source.category === 'search' ? 'bg-blue-100 text-blue-800' :
                                                        source.category === 'chat' ? 'bg-green-100 text-green-800' :
                                                            source.category === 'commerce' ? 'bg-purple-100 text-purple-800' :
                                                                'bg-gray-100 text-gray-800'}`, children: source.category }) }), _jsx("td", { className: "py-3 pr-4 text-xs text-gray-600 font-mono", children: source.fingerprint || "—" }), _jsx("td", { className: "py-3 pr-4 text-gray-600", children: new Date(source.created_at).toLocaleDateString() })] }, source.id))) })] }) })) })] }) }));
}
