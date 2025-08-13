import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
export default function Events() {
    const [events, setEvents] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [newEvent, setNewEvent] = useState({
        project_id: "",
        content_url: "",
        ai_source_name: "",
        event_type: "view",
        metadata: ""
    });
    useEffect(() => {
        loadEvents();
        loadSummary();
    }, []);
    async function loadEvents() {
        setLoading(true);
        try {
            // For now, using a placeholder project_id - in real app this would come from context
            const response = await fetch(`${API_BASE}/api/events?project_id=1`, FETCH_OPTS);
            if (response.ok) {
                const data = await response.json();
                setEvents(data.events || []);
            }
            else {
                console.error("Failed to load events:", response.status);
            }
        }
        catch (error) {
            console.error("Error loading events:", error);
        }
        finally {
            setLoading(false);
        }
    }
    async function loadSummary() {
        try {
            const response = await fetch(`${API_BASE}/api/events/summary?project_id=1`, FETCH_OPTS);
            if (response.ok) {
                const data = await response.json();
                setSummary(data);
            }
            else {
                console.error("Failed to load summary:", response.status);
            }
        }
        catch (error) {
            console.error("Error loading summary:", error);
        }
    }
    async function addEvent() {
        if (!newEvent.project_id || !newEvent.event_type)
            return;
        try {
            const response = await fetch(`${API_BASE}/api/events`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newEvent)
            });
            if (response.ok) {
                setNewEvent({ project_id: "", content_url: "", ai_source_name: "", event_type: "view", metadata: "" });
                await loadEvents();
                await loadSummary();
            }
            else {
                console.error("Failed to add event");
            }
        }
        catch (error) {
            console.error("Error adding event:", error);
        }
    }
    function getTrafficClassColor(trafficClass) {
        switch (trafficClass) {
            case "ai_agent_crawl": return "bg-purple-100 text-purple-800";
            case "human_via_ai": return "bg-blue-100 text-blue-800";
            case "direct_human": return "bg-green-100 text-green-800";
            case "unknown_ai_like": return "bg-orange-100 text-orange-800";
            default: return "bg-gray-100 text-gray-800";
        }
    }
    function getEventTypeColor(eventType) {
        switch (eventType) {
            case "view": return "bg-blue-100 text-blue-800";
            case "click": return "bg-green-100 text-green-800";
            case "purchase": return "bg-purple-100 text-purple-800";
            case "signup": return "bg-orange-100 text-orange-800";
            case "download": return "bg-indigo-100 text-indigo-800";
            default: return "bg-gray-100 text-gray-800";
        }
    }
    return (_jsx(Shell, { children: _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-slate-900", children: "Interaction Events" }), _jsx("p", { className: "text-slate-600 mt-2", children: "Track user interactions and AI-driven engagement with your content" })] }), summary && (_jsxs("div", { className: "grid md:grid-cols-4 gap-4", children: [_jsxs(Card, { title: "Total Events", children: [_jsx("div", { className: "text-3xl font-bold text-blue-600", children: summary.total }), _jsx("div", { className: "text-sm text-gray-500", children: "All time" })] }), _jsxs(Card, { title: "AI-Influenced", children: [_jsx("div", { className: "text-3xl font-bold text-purple-600", children: summary.breakdown
                                        .filter(b => b.traffic_class !== "direct_human")
                                        .reduce((sum, b) => sum + b.count, 0) }), _jsxs("div", { className: "text-sm text-gray-500", children: [summary.total > 0
                                            ? Math.round((summary.breakdown
                                                .filter(b => b.traffic_class !== "direct_human")
                                                .reduce((sum, b) => sum + b.count, 0) / summary.total) * 100)
                                            : 0, "% of total"] })] }), _jsxs(Card, { title: "Top AI Source", children: [_jsx("div", { className: "text-xl font-semibold text-green-600", children: summary.top_sources[0]?.name || "None" }), _jsxs("div", { className: "text-sm text-gray-500", children: [summary.top_sources[0]?.count || 0, " events"] })] }), _jsx(Card, { title: "Traffic Classes", children: _jsx("div", { className: "text-sm space-y-1", children: summary.breakdown.map((b, i) => (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "capitalize", children: b.traffic_class.replace(/_/g, " ") }), _jsx("span", { className: "font-medium", children: b.count })] }, i))) }) })] })), _jsx(Card, { title: "Track Event", children: _jsxs("form", { onSubmit: (e) => { e.preventDefault(); addEvent(); }, className: "space-y-4", children: [_jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Project ID" }), _jsx("input", { type: "text", value: newEvent.project_id, onChange: (e) => setNewEvent({ ...newEvent, project_id: e.target.value }), placeholder: "1", required: true, className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Event Type" }), _jsxs("select", { value: newEvent.event_type, onChange: (e) => setNewEvent({ ...newEvent, event_type: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "view", children: "View" }), _jsx("option", { value: "click", children: "Click" }), _jsx("option", { value: "purchase", children: "Purchase" }), _jsx("option", { value: "signup", children: "Sign Up" }), _jsx("option", { value: "download", children: "Download" }), _jsx("option", { value: "custom", children: "Custom" })] })] })] }), _jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Content URL (Optional)" }), _jsx("input", { type: "url", value: newEvent.content_url, onChange: (e) => setNewEvent({ ...newEvent, content_url: e.target.value }), placeholder: "https://example.com/page", className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "AI Source (Optional)" }), _jsx("input", { type: "text", value: newEvent.ai_source_name, onChange: (e) => setNewEvent({ ...newEvent, ai_source_name: e.target.value }), placeholder: "ChatGPT, Claude, Gemini...", className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-2", children: "Metadata (Optional)" }), _jsx("textarea", { value: newEvent.metadata, onChange: (e) => setNewEvent({ ...newEvent, metadata: e.target.value }), placeholder: "JSON metadata or additional context", rows: 3, className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] }), _jsx("button", { type: "submit", disabled: !newEvent.project_id || !newEvent.event_type, className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: "Track Event" })] }) }), _jsx(Card, { title: "Recent Events", children: loading ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "Loading events..." })) : events.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No events found. Track your first event above." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-slate-500 border-b", children: [_jsx("th", { className: "py-3 pr-4", children: "Event" }), _jsx("th", { className: "py-3 pr-4", children: "Traffic Class" }), _jsx("th", { className: "py-3 pr-4", children: "Content" }), _jsx("th", { className: "py-3 pr-4", children: "AI Source" }), _jsx("th", { className: "py-3 pr-4", children: "Metadata" }), _jsx("th", { className: "py-3 pr-4", children: "Time" })] }) }), _jsx("tbody", { children: events.map((event) => (_jsxs("tr", { className: "border-b", children: [_jsx("td", { className: "py-3 pr-4", children: _jsx("span", { className: `px-2 py-1 text-xs rounded-full ${getEventTypeColor(event.event_type)}`, children: event.event_type }) }), _jsx("td", { className: "py-3 pr-4", children: event.metadata && typeof event.metadata === "string" ? ((() => {
                                                    try {
                                                        const meta = JSON.parse(event.metadata);
                                                        return (_jsx("span", { className: `px-2 py-1 text-xs rounded-full ${getTrafficClassColor(meta.class || "unknown")}`, children: meta.class || "unknown" }));
                                                    }
                                                    catch {
                                                        return _jsx("span", { className: "text-gray-400", children: "\u2014" });
                                                    }
                                                })()) : (_jsx("span", { className: "text-gray-400", children: "\u2014" })) }), _jsx("td", { className: "py-3 pr-4", children: event.content_url ? (_jsx("a", { href: event.content_url, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:underline truncate block max-w-xs", children: event.content_url })) : (_jsx("span", { className: "text-gray-400", children: "\u2014" })) }), _jsx("td", { className: "py-3 pr-4", children: event.ai_source_name || _jsx("span", { className: "text-gray-400", children: "\u2014" }) }), _jsx("td", { className: "py-3 pr-4 text-xs text-gray-600 font-mono max-w-xs truncate", children: event.metadata || "—" }), _jsx("td", { className: "py-3 pr-4 text-gray-600", children: new Date(event.occurred_at).toLocaleString() })] }, event.id))) })] }) })) })] }) }));
}
