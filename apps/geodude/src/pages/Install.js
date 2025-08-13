import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { CheckCircle, Clock, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
// Installation Verification Banner Component
function InstallVerificationBanner({ properties, apiKeys }) {
    const [verificationData, setVerificationData] = useState({});
    const [loading, setLoading] = useState({});
    const [error, setError] = useState({});
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshCountdown, setRefreshCountdown] = useState(120); // 2 minutes
    useEffect(() => {
        if (autoRefresh && refreshCountdown > 0) {
            const timer = setTimeout(() => {
                setRefreshCountdown(prev => prev - 10);
                if (refreshCountdown <= 10) {
                    setAutoRefresh(false);
                }
            }, 10000); // Every 10 seconds
            return () => clearTimeout(timer);
        }
    }, [autoRefresh, refreshCountdown]);
    useEffect(() => {
        if (autoRefresh) {
            verifyAllProperties();
        }
    }, [autoRefresh]);
    async function verifyProperty(propertyId) {
        try {
            setLoading(prev => ({ ...prev, [propertyId]: true }));
            setError(prev => ({ ...prev, [propertyId]: "" }));
            const response = await fetch(`${API_BASE}/api/events/last-seen?property_id=${propertyId}`, FETCH_OPTS);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            setVerificationData(prev => ({ ...prev, [propertyId]: data }));
        }
        catch (err) {
            setError(prev => ({ ...prev, [propertyId]: err instanceof Error ? err.message : "Verification failed" }));
        }
        finally {
            setLoading(prev => ({ ...prev, [propertyId]: false }));
        }
    }
    async function verifyAllProperties() {
        const activeProperties = properties.filter(property => apiKeys.some(key => key.property_id === property.id && !key.revoked_at));
        for (const property of activeProperties) {
            await verifyProperty(property.id);
        }
    }
    function getVerificationStatus(propertyId) {
        const data = verificationData[propertyId];
        const loadingState = loading[propertyId];
        const errorState = error[propertyId];
        if (loadingState) {
            return { status: 'loading', icon: _jsx(Clock, { className: "text-yellow-600", size: 20 }), text: 'Checking...' };
        }
        if (errorState) {
            return { status: 'error', icon: _jsx(AlertTriangle, { className: "text-red-600", size: 20 }), text: 'Verification failed' };
        }
        if (!data) {
            return { status: 'waiting', icon: _jsx(Clock, { className: "text-gray-400", size: 20 }), text: 'Waiting for data...' };
        }
        if (data.events_15m > 0) {
            return { status: 'connected', icon: _jsx(CheckCircle, { className: "text-green-600", size: 20 }), text: 'Receiving data ✓' };
        }
        return { status: 'waiting', icon: _jsx(Clock, { className: "text-gray-400", size: 20 }), text: 'Waiting for data...' };
    }
    function getLastEventText(propertyId) {
        const data = verificationData[propertyId];
        if (!data?.last_event_ts)
            return null;
        const lastEvent = new Date(data.last_event_ts);
        const now = new Date();
        const diffSeconds = Math.floor((now.getTime() - lastEvent.getTime()) / 1000);
        if (diffSeconds < 60) {
            return `${diffSeconds} seconds ago`;
        }
        else if (diffSeconds < 3600) {
            const minutes = Math.floor(diffSeconds / 60);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        }
        else {
            const hours = Math.floor(diffSeconds / 3600);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
    }
    function formatCountdown() {
        const minutes = Math.floor(refreshCountdown / 60);
        const seconds = refreshCountdown % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "flex items-center space-x-2", children: autoRefresh ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "text-blue-600 animate-spin", size: 16 }), _jsxs("span", { className: "text-sm text-blue-600", children: ["Auto-refreshing... ", formatCountdown(), " remaining"] })] })) : (_jsx("span", { className: "text-sm text-gray-500", children: "Auto-refresh stopped" })) }), !autoRefresh && (_jsxs("button", { onClick: () => {
                            setAutoRefresh(true);
                            setRefreshCountdown(120);
                            verifyAllProperties();
                        }, className: "flex items-center space-x-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors", children: [_jsx(RefreshCw, { size: 14 }), _jsx("span", { children: "Recheck" })] }))] }), _jsx("div", { className: "space-y-3", children: properties
                    .filter(property => apiKeys.some(key => key.property_id === property.id && !key.revoked_at))
                    .map(property => {
                    const status = getVerificationStatus(property.id);
                    const lastEventText = getLastEventText(property.id);
                    const data = verificationData[property.id];
                    return (_jsxs("div", { className: "p-4 border border-gray-200 rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [status.icon, _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900", children: property.domain }), _jsx("p", { className: "text-sm text-gray-600", children: status.text })] })] }), status.status === 'connected' && lastEventText && (_jsxs("span", { className: "text-sm text-green-600", children: ["Last event: ", lastEventText] }))] }), status.status === 'connected' && data && (_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Total (15m):" }), _jsx("div", { className: "font-medium", children: data.events_15m })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Direct Human:" }), _jsx("div", { className: "font-medium", children: data.by_class_15m.direct_human })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Human via AI:" }), _jsx("div", { className: "font-medium", children: data.by_class_15m.human_via_ai })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "AI Agent:" }), _jsx("div", { className: "font-medium", children: data.by_class_15m.ai_agent_crawl })] })] })), status.status === 'error' && (_jsxs("div", { className: "text-sm text-red-600", children: ["Error: ", error[property.id]] }))] }, property.id));
                }) })] }));
}
// Troubleshooting Guide Component
function TroubleshootingGuide({ properties, apiKeys }) {
    const [expandedSections, setExpandedSections] = useState({});
    function toggleSection(section) {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    }
    function getTestCurl(propertyId, keyId) {
        const timestamp = Math.floor(Date.now() / 1000);
        const body = JSON.stringify({
            project_id: 1, // Placeholder - should come from user context
            property_id: propertyId,
            event_type: "view",
            metadata: {
                p: "/",
                r: "chat.openai.com"
            }
        });
        return `ts=$(date +%s)
body='${body}'
sig=$(echo -n "\${ts}.\${body}" | openssl dgst -sha256 -hmac "<SECRET>" -binary | base64)
curl -X POST ${API_BASE}/api/events \\
  -H "content-type: application/json" \\
  -H "x-optiview-key-id: ${keyId}" \\
  -H "x-optiview-timestamp: \$ts" \\
  -H "x-optiview-signature: \$sig" \\
  --data "\$body"`;
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Use this guide to troubleshoot common installation issues. Each section can be expanded for detailed information." }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('tag'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "text-green-600", size: 16 }), _jsx("span", { className: "font-medium", children: "Tag Present" })] }), expandedSections['tag'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['tag'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "View your page source and confirm the Optiview script tag is present in the <head> section." }), properties.length > 0 && apiKeys.length > 0 && (_jsx("div", { className: "bg-gray-50 p-3 rounded-md", children: _jsx("div", { className: "text-xs font-mono text-gray-700", children: properties.map(property => {
                                            const key = apiKeys.find(k => k.property_id === property.id && !k.revoked_at);
                                            if (!key)
                                                return null;
                                            return (_jsxs("div", { className: "mb-2", children: [_jsxs("div", { className: "text-gray-500 mb-1", children: [property.domain, ":"] }), _jsxs("div", { className: "text-gray-800", children: ["<script async src=\"", API_BASE, "/v1/tag.js?pid=", property.id, "&kid=", key.key_id, "\"></script>"] })] }, property.id));
                                        }) }) }))] }) }))] }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('origin'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "text-green-600", size: 16 }), _jsx("span", { className: "font-medium", children: "Origin & Domain" })] }), expandedSections['origin'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['origin'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "Requests must originate from your registered domain(s). Ensure your site loads over HTTPS and the domain matches your property configuration." }), properties.length > 0 && (_jsx("div", { className: "bg-blue-50 p-3 rounded-md", children: _jsxs("div", { className: "text-sm text-blue-800", children: [_jsx("strong", { children: "Registered domains:" }), _jsx("ul", { className: "mt-1 space-y-1", children: properties.map(property => (_jsxs("li", { className: "text-blue-700", children: ["\u2022 ", property.domain] }, property.id))) })] }) }))] }) }))] }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('time'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Clock, { className: "text-blue-600", size: 16 }), _jsx("span", { className: "font-medium", children: "Time Synchronization" })] }), expandedSections['time'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['time'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "System clock skew can break HMAC signatures. This is rare but can happen on servers with incorrect time settings." }), _jsx("div", { className: "bg-yellow-50 p-3 rounded-md", children: _jsxs("div", { className: "text-sm text-yellow-800", children: [_jsx("strong", { children: "Check your server time:" }), _jsx("div", { className: "mt-1 text-xs text-yellow-700", children: "date && echo \"UTC: $(date -u)\" && echo \"Local: $(date)\"" })] }) })] }) }))] }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('cors'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(AlertTriangle, { className: "text-orange-600", size: 16 }), _jsx("span", { className: "font-medium", children: "CORS & HTTPS" })] }), expandedSections['cors'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['cors'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "Ensure your site loads over HTTPS and check browser console for CORS errors. Mixed content can cause issues." }), _jsx("div", { className: "bg-orange-50 p-3 rounded-md", children: _jsxs("div", { className: "text-sm text-orange-800", children: [_jsx("strong", { children: "Common CORS issues:" }), _jsxs("ul", { className: "mt-1 text-xs text-orange-700 space-y-1", children: [_jsx("li", { children: "\u2022 HTTP site trying to call HTTPS API" }), _jsx("li", { children: "\u2022 Domain not in allowed origins list" }), _jsx("li", { children: "\u2022 Missing or invalid Origin header" })] })] }) })] }) }))] }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('key'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "text-green-600", size: 16 }), _jsx("span", { className: "font-medium", children: "API Key & Secret" })] }), expandedSections['key'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['key'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "If you rotated keys, update your tag to use the latest key ID. The secret is only needed for server-side requests." }), properties.length > 0 && apiKeys.length > 0 && (_jsx("div", { className: "bg-gray-50 p-3 rounded-md", children: _jsxs("div", { className: "text-sm text-gray-700", children: [_jsx("strong", { children: "Active API Keys:" }), _jsx("ul", { className: "mt-1 space-y-1", children: properties.map(property => {
                                                    const key = apiKeys.find(k => k.property_id === property.id && !k.revoked_at);
                                                    if (!key)
                                                        return null;
                                                    return (_jsxs("li", { className: "text-gray-600", children: [property.domain, ": ", key.key_id] }, property.id));
                                                }) })] }) }))] }) }))] }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('curl'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(AlertTriangle, { className: "text-blue-600", size: 16 }), _jsx("span", { className: "font-medium", children: "Test cURL Command" })] }), expandedSections['curl'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['curl'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "Test your API key and secret with this cURL command. Replace <SECRET> with your actual secret." }), properties.length > 0 && apiKeys.length > 0 && (_jsx("div", { className: "space-y-3", children: properties.map(property => {
                                        const key = apiKeys.find(k => k.property_id === property.id && !k.revoked_at);
                                        if (!key)
                                            return null;
                                        return (_jsxs("div", { className: "bg-gray-900 text-green-400 p-3 rounded-md", children: [_jsxs("div", { className: "text-xs text-gray-400 mb-2", children: [property.domain, ":"] }), _jsx("pre", { className: "text-xs overflow-x-auto whitespace-pre-wrap", children: getTestCurl(property.id, key.key_id) }), _jsx("button", { onClick: () => navigator.clipboard.writeText(getTestCurl(property.id, key.key_id)), className: "mt-2 text-xs text-blue-400 hover:text-blue-400 underline", children: "Copy to clipboard" })] }, property.id));
                                    }) })), _jsx("div", { className: "bg-yellow-50 p-3 rounded-md", children: _jsxs("div", { className: "text-sm text-yellow-800", children: [_jsx("strong", { children: "Note:" }), " The secret is only shown when you first create or rotate a key. If you can't see it, rotate your key to get a new secret."] }) })] }) }))] }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('errors'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(AlertTriangle, { className: "text-red-600", size: 16 }), _jsx("span", { className: "font-medium", children: "Recent Errors (15m)" })] }), expandedSections['errors'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['errors'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "Check for recent error patterns that might indicate configuration issues." }), _jsx("div", { className: "bg-gray-50 p-3 rounded-md", children: _jsxs("div", { className: "text-sm text-gray-600", children: [_jsx("strong", { children: "Error monitoring:" }), " Use the Health dashboard to view recent error patterns and identify common issues."] }) })] }) }))] })] }));
}
export default function Install() {
    const [properties, setProperties] = useState([]);
    const [apiKeys, setApiKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newKey, setNewKey] = useState({
        project_id: "1",
        property_id: "",
        name: ""
    });
    const [newProperty, setNewProperty] = useState({
        project_id: "1",
        domain: ""
    });
    useEffect(() => {
        loadProperties();
        loadApiKeys();
    }, []);
    async function loadProperties() {
        try {
            // For now, using placeholder project_id - in real app this would come from context
            const response = await fetch(`${API_BASE}/api/content?project_id=1`, FETCH_OPTS);
            if (response.ok) {
                const data = await response.json();
                // Extract unique properties from content
                const uniqueProperties = data.content.reduce((acc, item) => {
                    if (item.domain && !acc.find(p => p.domain === item.domain)) {
                        acc.push({ id: item.id, domain: item.domain, project_id: 1 });
                    }
                    return acc;
                }, []);
                setProperties(uniqueProperties);
            }
        }
        catch (error) {
            console.error("Error loading properties:", error);
        }
    }
    async function loadApiKeys() {
        try {
            const response = await fetch(`${API_BASE}/api/keys?project_id=1`, FETCH_OPTS);
            if (response.ok) {
                const data = await response.json();
                setApiKeys(data.keys || []);
            }
        }
        catch (error) {
            console.error("Error loading API keys:", error);
        }
        finally {
            setLoading(false);
        }
    }
    async function createApiKey() {
        if (!newKey.project_id || !newKey.property_id || !newKey.name)
            return;
        try {
            const response = await fetch(`${API_BASE}/api/keys`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newKey)
            });
            if (response.ok) {
                const data = await response.json();
                alert(`API Key created! Key ID: ${data.key_id}\nSecret: ${data.secret_once}\n\n⚠️ Store this secret securely - it won't be shown again!`);
                setNewKey({ project_id: "1", property_id: "", name: "" });
                await loadApiKeys();
            }
            else {
                console.error("Failed to create API key");
            }
        }
        catch (error) {
            console.error("Error creating API key:", error);
        }
    }
    async function revokeApiKey(keyId) {
        if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone."))
            return;
        try {
            const response = await fetch(`${API_BASE}/api/keys/${keyId}/revoke`, {
                method: "POST",
                credentials: "include"
            });
            if (response.ok) {
                await loadApiKeys();
            }
            else {
                console.error("Failed to revoke API key");
            }
        }
        catch (error) {
            console.error("Error revoking API key:", error);
        }
    }
    async function addProperty() {
        if (!newProperty.project_id || !newProperty.domain)
            return;
        try {
            const response = await fetch(`${API_BASE}/api/content`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: parseInt(newProperty.project_id),
                    domain: newProperty.domain,
                    url: `https://${newProperty.domain}/`,
                    type: "website"
                })
            });
            if (response.ok) {
                setNewProperty({ project_id: "1", domain: "" });
                await loadProperties();
            }
            else {
                console.error("Failed to add property");
            }
        }
        catch (error) {
            console.error("Error adding property:", error);
        }
    }
    function getInstallationSnippet(propertyId, keyId) {
        return `<script async src="https://app.optiview.io/v1/tag.js?pid=${propertyId}&kid=${keyId}"></script>`;
    }
    function getGtmTemplate(propertyId, keyId) {
        return `{
  "name": "Optiview Analytics",
  "type": "html",
  "code": "<script async src=\\"https://app.optiview.io/v1/tag.js?pid=${propertyId}&kid=${keyId}\\"></script>"
}`;
    }
    return (_jsx(Shell, { children: _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-slate-900", children: "Installation & Setup" }), _jsx("p", { className: "text-slate-600 mt-2", children: "Get Optiview tracking on your website with our easy installation options" })] }), _jsx(Card, { title: "Properties", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex gap-4", children: [_jsx("input", { type: "text", value: newProperty.domain, onChange: (e) => setNewProperty({ ...newProperty, domain: e.target.value }), placeholder: "example.com", className: "flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" }), _jsx("button", { onClick: addProperty, disabled: !newProperty.domain, className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: "Add Property" })] }), properties.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx("h4", { className: "font-medium text-slate-700", children: "Your Properties:" }), properties.map((property) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-md", children: [_jsx("span", { className: "font-mono text-sm", children: property.domain }), _jsxs("span", { className: "text-xs text-gray-500", children: ["ID: ", property.id] })] }, property.id)))] }))] }) }), _jsx(Card, { title: "API Keys", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid md:grid-cols-3 gap-4", children: [_jsxs("select", { value: newKey.property_id, onChange: (e) => setNewKey({ ...newKey, property_id: e.target.value }), className: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "", children: "Select Property" }), properties.map((property) => (_jsx("option", { value: property.id, children: property.domain }, property.id)))] }), _jsx("input", { type: "text", value: newKey.name, onChange: (e) => setNewKey({ ...newKey, name: e.target.value }), placeholder: "Key name (e.g., Production)", className: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" }), _jsx("button", { onClick: createApiKey, disabled: !newKey.property_id || !newKey.name, className: "px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2", children: "Create API Key" })] }), loading ? (_jsx("div", { className: "text-center py-4 text-gray-500", children: "Loading API keys..." })) : apiKeys.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No API keys found. Create your first key above." })) : (_jsxs("div", { className: "space-y-3", children: [_jsx("h4", { className: "font-medium text-slate-700", children: "Your API Keys:" }), apiKeys.map((key) => (_jsxs("div", { className: "flex items-center justify-between p-4 border border-gray-200 rounded-lg", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-medium", children: key.name }), key.revoked_at && (_jsx("span", { className: "px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full", children: "Revoked" }))] }), _jsxs("div", { className: "text-sm text-gray-600", children: [_jsx("span", { className: "font-mono", children: key.key_id }), " \u2022 ", key.property_domain] }), _jsxs("div", { className: "text-xs text-gray-500", children: ["Created: ", new Date(key.created_at).toLocaleDateString(), key.last_used_at && ` • Last used: ${new Date(key.last_used_at).toLocaleDateString()}`] })] }), !key.revoked_at && (_jsx("button", { onClick: () => revokeApiKey(key.key_id), className: "px-3 py-1 text-sm text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2", children: "Revoke" }))] }, key.id)))] }))] }) }), _jsx(Card, { title: "Installation Instructions", children: _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-slate-700 mb-2", children: "1. JavaScript Tag (Recommended)" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "Add this script tag to your website's <head> section. It will automatically track page views and AI traffic." }), properties.length > 0 && apiKeys.length > 0 ? (_jsx("div", { className: "space-y-3", children: properties.map((property) => {
                                            const key = apiKeys.find(k => k.property_id === property.id && !k.revoked_at);
                                            if (!key)
                                                return null;
                                            return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "text-sm font-medium text-slate-600", children: [property.domain, ":"] }), _jsx("div", { className: "bg-gray-900 text-green-400 p-3 rounded-md font-mono text-sm overflow-x-auto", children: getInstallationSnippet(property.id.toString(), key.key_id) }), _jsx("button", { onClick: () => navigator.clipboard.writeText(getInstallationSnippet(property.id.toString(), key.key_id)), className: "text-xs text-blue-600 hover:text-blue-800 focus:outline-none", children: "Copy to clipboard" })] }, property.id));
                                        }) })) : (_jsx("div", { className: "text-sm text-gray-500 italic", children: "Create a property and API key first to see installation snippets." }))] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-slate-700 mb-2", children: "2. Google Tag Manager" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "If you use GTM, create a new HTML tag with this template:" }), properties.length > 0 && apiKeys.length > 0 ? (_jsx("div", { className: "space-y-3", children: properties.map((property) => {
                                            const key = apiKeys.find(k => k.property_id === property.id && !k.revoked_at);
                                            if (!key)
                                                return null;
                                            return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "text-sm font-medium text-slate-600", children: [property.domain, ":"] }), _jsx("div", { className: "bg-gray-900 text-green-400 p-3 rounded-md font-mono text-sm overflow-x-auto", children: getGtmTemplate(property.id.toString(), key.key_id) }), _jsx("button", { onClick: () => navigator.clipboard.writeText(getGtmTemplate(property.id.toString(), key.key_id)), className: "text-xs text-blue-600 hover:text-blue-800 focus:outline-none", children: "Copy to clipboard" })] }, property.id));
                                        }) })) : (_jsx("div", { className: "text-sm text-gray-500 italic", children: "Create a property and API key first to see GTM templates." }))] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-slate-700 mb-2", children: "3. Cloudflare Worker (Advanced)" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "For high-traffic sites, deploy our worker template on your own zone for edge-level classification." }), _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-md p-4", children: [_jsxs("div", { className: "text-sm text-blue-800", children: [_jsx("strong", { children: "Download:" }), " ", _jsx("a", { href: "/examples/customer-worker.js", download: true, className: "text-blue-600 hover:text-blue-800 underline", children: "customer-worker.js" })] }), _jsx("div", { className: "text-xs text-blue-700 mt-2", children: "Deploy this to your Cloudflare zone and set environment variables for your Optiview credentials." })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-slate-700 mb-2", children: "4. Verify Installation" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "After installing, visit your website and check the Optiview dashboard for incoming events." }), _jsxs("div", { className: "bg-green-50 border border-green-200 rounded-md p-4", children: [_jsx("div", { className: "text-sm text-green-800", children: _jsx("strong", { children: "Success indicators:" }) }), _jsxs("ul", { className: "text-xs text-green-700 mt-2 space-y-1", children: [_jsx("li", { children: "\u2022 Page views appear in your Events dashboard" }), _jsx("li", { children: "\u2022 AI traffic is classified automatically" }), _jsx("li", { children: "\u2022 No console errors in browser dev tools" })] })] })] })] }) }), properties.length > 0 && apiKeys.length > 0 && (_jsx(Card, { title: "Installation Status", children: _jsx(InstallVerificationBanner, { properties: properties, apiKeys: apiKeys }) })), _jsx(Card, { title: "Troubleshooting", children: _jsx(TroubleshootingGuide, { properties: properties, apiKeys: apiKeys }) })] }) }));
}
