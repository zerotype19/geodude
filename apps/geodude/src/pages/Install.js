import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { CheckCircle, Clock, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Eye, EyeOff, Copy } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
// Hosted Tag Builder Component
function HostedTagBuilder({ properties, apiKeys, projectId }) {
    const [selectedProperty, setSelectedProperty] = useState(properties[0] || null);
    const [selectedApiKey, setSelectedApiKey] = useState(null);
    const [showKeyId, setShowKeyId] = useState(false);
    const [config, setConfig] = useState({
        clicks: true,
        spa: true,
        batchSize: 10,
        flushMs: 3000
    });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [copiedSnippet, setCopiedSnippet] = useState(false);
    const [copiedGtm, setCopiedGtm] = useState(false);
    // Auto-select the first API key for the selected property
    useEffect(() => {
        if (selectedProperty && apiKeys.length > 0) {
            const propertyApiKey = apiKeys.find(key => key.property_id === selectedProperty.id);
            setSelectedApiKey(propertyApiKey || apiKeys[0]);
        }
    }, [selectedProperty, apiKeys]);
    const generateSnippet = () => {
        if (!selectedProperty || !selectedApiKey)
            return '';
        return `<script async src="https://api.optiview.ai/v1/tag.js"
  data-key-id="${selectedApiKey.key_id}"
  data-project-id="${projectId}"
  data-property-id="${selectedProperty.id}"
  data-clicks="${config.clicks ? '1' : '0'}"
  data-spa="${config.spa ? '1' : '0'}"
  data-batch-size="${config.batchSize}"
  data-flush-ms="${config.flushMs}"></script>`;
    };
    const generateGtmSnippet = () => {
        if (!selectedProperty || !selectedApiKey)
            return '';
        return `<!-- Use as Custom HTML tag; trigger on All Pages -->
<script async src="https://api.optiview.ai/v1/tag.js"
  data-key-id="${selectedApiKey.key_id}"
  data-project-id="${projectId}"
  data-property-id="${selectedProperty.id}"
  data-clicks="${config.clicks ? '1' : '0'}"
  data-spa="${config.spa ? '1' : '0'}"
  data-batch-size="${config.batchSize}"
  data-flush-ms="${config.flushMs}"></script>`;
    };
    const generateTestCurls = () => {
        if (!selectedProperty || !selectedApiKey)
            return { pageview: '', conversion: '' };
        const pageviewCurl = `curl -X POST "https://api.optiview.ai/api/events" \\
  -H "Content-Type: application/json" \\
  -H "x-optiview-key-id: ${selectedApiKey.key_id}" \\
  -d '{
    "project_id": "${projectId}",
    "property_id": ${selectedProperty.id},
    "events": [{
      "event_type": "pageview",
      "metadata": {
        "url": "https://${selectedProperty.domain}/test",
        "pathname": "/test",
        "title": "Test Page"
      },
      "occurred_at": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
    }]
  }'`;
        const conversionCurl = `curl -X POST "https://api.optiview.ai/api/conversions" \\
  -H "Content-Type: application/json" \\
  -H "x-optiview-key-id: ${selectedApiKey.key_id}" \\
  -d '{
    "project_id": "${projectId}",
    "property_id": ${selectedProperty.id},
    "amount_cents": 1299,
    "currency": "USD",
    "metadata": {
      "order_id": "test-order-123"
    }
  }'`;
        return { pageview: pageviewCurl, conversion: conversionCurl };
    };
    const copyToClipboard = async (text, type) => {
        await navigator.clipboard.writeText(text);
        if (type === 'snippet') {
            setCopiedSnippet(true);
            setTimeout(() => setCopiedSnippet(false), 2000);
        }
        else {
            setCopiedGtm(true);
            setTimeout(() => setCopiedGtm(false), 2000);
        }
    };
    if (properties.length === 0 || apiKeys.length === 0) {
        return (_jsxs("div", { className: "text-center py-8", children: [_jsx("p", { className: "text-gray-500 mb-4", children: properties.length === 0
                        ? "Create a property first to use the hosted tag builder."
                        : "Create an API key first to use the hosted tag builder." }), _jsx("a", { href: "/api-keys", className: "text-blue-600 hover:text-blue-800 underline", children: "Manage API Keys \u2192" })] }));
    }
    const snippet = generateSnippet();
    const gtmSnippet = generateGtmSnippet();
    const testCurls = generateTestCurls();
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Property" }), _jsx("select", { value: selectedProperty?.id || '', onChange: (e) => setSelectedProperty(properties.find(p => p.id === parseInt(e.target.value)) || null), className: "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500", children: properties.map((property) => (_jsx("option", { value: property.id, children: property.domain }, property.id))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "API Key" }), _jsxs("div", { className: "relative", children: [_jsx("select", { value: selectedApiKey?.id || '', onChange: (e) => setSelectedApiKey(apiKeys.find(k => k.id === parseInt(e.target.value)) || null), className: "w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500", children: apiKeys.map((apiKey) => (_jsx("option", { value: apiKey.id, children: apiKey.name }, apiKey.id))) }), _jsx("button", { onClick: () => setShowKeyId(!showKeyId), className: "absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-600", children: showKeyId ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] }), showKeyId && selectedApiKey && (_jsxs("div", { className: "mt-1 text-xs text-gray-600 font-mono", children: ["Key ID: ", selectedApiKey.key_id] }))] })] }), _jsx("div", { className: "bg-gray-50 p-4 rounded-md", children: _jsxs("div", { className: "grid grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "font-medium text-gray-700", children: "Project ID:" }), _jsx("span", { className: "ml-2 font-mono text-gray-600", children: projectId })] }), _jsxs("div", { children: [_jsx("span", { className: "font-medium text-gray-700", children: "Property ID:" }), _jsx("span", { className: "ml-2 font-mono text-gray-600", children: selectedProperty?.id })] })] }) }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center space-x-6", children: [_jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", checked: config.clicks, onChange: (e) => setConfig({ ...config, clicks: e.target.checked }), className: "rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" }), _jsx("span", { className: "ml-2 text-sm text-gray-700", children: "Click tracking" })] }), _jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", checked: config.spa, onChange: (e) => setConfig({ ...config, spa: e.target.checked }), className: "rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" }), _jsx("span", { className: "ml-2 text-sm text-gray-700", children: "SPA route tracking" })] })] }), _jsxs("div", { children: [_jsxs("button", { onClick: () => setShowAdvanced(!showAdvanced), className: "flex items-center text-sm text-blue-600 hover:text-blue-800", children: [showAdvanced ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 }), _jsx("span", { className: "ml-1", children: "Advanced Settings" })] }), showAdvanced && (_jsxs("div", { className: "mt-3 grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Batch size (1-50)" }), _jsx("input", { type: "number", min: "1", max: "50", value: config.batchSize, onChange: (e) => setConfig({ ...config, batchSize: Math.min(Math.max(parseInt(e.target.value) || 10, 1), 50) }), className: "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Flush interval (500-10000ms)" }), _jsx("input", { type: "number", min: "500", max: "10000", step: "100", value: config.flushMs, onChange: (e) => setConfig({ ...config, flushMs: Math.min(Math.max(parseInt(e.target.value) || 3000, 500), 10000) }), className: "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" })] })] }))] })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-700 mb-2", children: "HTML Snippet" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "bg-gray-900 text-green-400 p-3 rounded-md font-mono text-sm overflow-x-auto", children: snippet }), _jsx("button", { onClick: () => copyToClipboard(snippet, 'snippet'), className: "absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-200 bg-gray-800 rounded", children: _jsx(Copy, { size: 16 }) })] }), copiedSnippet && (_jsx("div", { className: "text-xs text-green-600 mt-1", children: "Copied to clipboard!" }))] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-700 mb-2", children: "Google Tag Manager" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "bg-gray-900 text-green-400 p-3 rounded-md font-mono text-sm overflow-x-auto", children: gtmSnippet }), _jsx("button", { onClick: () => copyToClipboard(gtmSnippet, 'gtm'), className: "absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-200 bg-gray-800 rounded", children: _jsx(Copy, { size: 16 }) })] }), copiedGtm && (_jsx("div", { className: "text-xs text-green-600 mt-1", children: "Copied to clipboard!" })), _jsx("div", { className: "text-xs text-gray-600 mt-2", children: "Use as Custom HTML tag; trigger on All Pages" })] })] }), _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-md p-4", children: [_jsx("h4", { className: "font-medium text-blue-800 mb-2", children: "Test Calls" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h5", { className: "text-sm font-medium text-blue-700 mb-1", children: "Pageview Test:" }), _jsx("div", { className: "bg-blue-900 text-blue-100 p-2 rounded text-xs font-mono overflow-x-auto", children: testCurls.pageview })] }), _jsxs("div", { children: [_jsx("h5", { className: "text-sm font-medium text-blue-700 mb-1", children: "Conversion Test:" }), _jsx("div", { className: "bg-blue-900 text-blue-100 p-2 rounded text-xs font-mono overflow-x-auto", children: testCurls.conversion })] })] })] }), _jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-md p-4", children: [_jsx("h4", { className: "font-medium text-yellow-800 mb-2", children: "Troubleshooting" }), _jsxs("div", { className: "text-sm text-yellow-700 space-y-2", children: [_jsxs("p", { children: ["\u2022 To exclude elements from click tracking, add ", _jsx("code", { className: "bg-yellow-100 px-1 rounded", children: "data-optiview=\"ignore\"" })] }), _jsxs("p", { children: ["\u2022 Call ", _jsxs("code", { className: "bg-yellow-100 px-1 rounded", children: ["window.optiview.conversion(", "{amount_cents: 1299, currency: 'USD', metadata: {order_id: 'A123'}", ")"] }), " for conversions"] }), _jsxs("p", { children: ["\u2022 Use ", _jsx("code", { className: "bg-yellow-100 px-1 rounded", children: "window.optiview.track('custom_event', metadata)" }), " for custom events"] }), _jsx("p", { children: "\u2022 Check browser console for errors if events aren't appearing" })] }), _jsx("div", { className: "mt-3", children: _jsx("a", { href: "/docs/install", className: "text-yellow-800 hover:text-yellow-900 underline text-sm", children: "View full documentation \u2192" }) })] })] }));
}
// Installation Verification Banner Component
function InstallVerificationBanner({ properties, apiKeys }) {
    const { project } = useAuth();
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
        if (!project?.id)
            return;
        try {
            setLoading(prev => ({ ...prev, [propertyId]: true }));
            setError(prev => ({ ...prev, [propertyId]: "" }));
            const response = await fetch(`${API_BASE}/api/events/last-seen?project_id=${project.id}&property_id=${propertyId}`, FETCH_OPTS);
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
        // Since we're not managing API keys here, verify all properties
        for (const property of properties) {
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
                        }, className: "flex items-center space-x-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors", children: [_jsx(RefreshCw, { size: 14 }), _jsx("span", { children: "Recheck" })] }))] }), _jsx("div", { className: "space-y-3", children: properties.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: _jsx("p", { children: "No properties found. Create a property first to start tracking." }) })) : (properties.map(property => {
                    const status = getVerificationStatus(property.id);
                    const lastEventText = getLastEventText(property.id);
                    const data = verificationData[property.id];
                    return (_jsxs("div", { className: "p-4 border border-gray-200 rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [status.icon, _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900", children: property.domain }), _jsx("p", { className: "text-sm text-gray-600", children: status.text })] })] }), status.status === 'connected' && lastEventText && (_jsxs("span", { className: "text-sm text-green-600", children: ["Last event: ", lastEventText] }))] }), status.status === 'connected' && data && (_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Total (15m):" }), _jsx("div", { className: "font-medium", children: data.events_15m })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Direct Human:" }), _jsx("div", { className: "font-medium", children: data.by_class_15m.direct_human })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Human via AI:" }), _jsx("div", { className: "font-medium", children: data.by_class_15m.human_via_ai })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "AI Agent:" }), _jsx("div", { className: "font-medium", children: data.by_class_15m.ai_agent_crawl })] })] })), status.status === 'error' && (_jsxs("div", { className: "text-sm text-red-600", children: ["Error: ", error[property.id]] }))] }, property.id));
                })) })] }));
}
// Troubleshooting Guide Component
function TroubleshootingGuide({ properties, apiKeys }) {
    const [expandedSections, setExpandedSections] = useState({});
    function toggleSection(section) {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    }
    function getTestCurl(propertyId) {
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
  -H "x-optiview-key-id: <YOUR_KEY_ID>" \\
  -H "x-optiview-timestamp: \$ts" \\
  -H "x-optiview-signature: \$sig" \\
  --data "\$body"`;
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Use this guide to troubleshoot common installation issues. Each section can be expanded for detailed information." }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('tag'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "text-green-600", size: 16 }), _jsx("span", { className: "font-medium", children: "Tag Present" })] }), expandedSections['tag'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['tag'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "View your page source and confirm the Optiview script tag is present in the <head> section." }), properties.length > 0 ? (_jsx("div", { className: "bg-gray-50 p-3 rounded-md", children: _jsx("div", { className: "text-xs font-mono text-gray-700", children: properties.map(property => (_jsxs("div", { className: "mb-2", children: [_jsxs("div", { className: "text-gray-500 mb-1", children: [property.domain, ":"] }), _jsxs("div", { className: "text-gray-800", children: ["<script async src=\"", API_BASE, "/v1/tag.js?pid=", property.id, "\"></script>"] })] }, property.id))) }) })) : (_jsx("div", { className: "text-sm text-gray-500 italic", children: "Create a property first to see installation snippets." }))] }) }))] }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('origin'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "text-green-600", size: 16 }), _jsx("span", { className: "font-medium", children: "Origin & Domain" })] }), expandedSections['origin'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['origin'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "Requests must originate from your registered domain(s). Ensure your site loads over HTTPS and the domain matches your property configuration." }), properties.length > 0 && (_jsx("div", { className: "bg-blue-50 p-3 rounded-md", children: _jsxs("div", { className: "text-sm text-blue-800", children: [_jsx("strong", { children: "Registered domains:" }), _jsx("ul", { className: "mt-1 space-y-1", children: properties.map(property => (_jsxs("li", { className: "text-blue-700", children: ["\u2022 ", property.domain] }, property.id))) })] }) }))] }) }))] }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('time'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Clock, { className: "text-blue-600", size: 16 }), _jsx("span", { className: "font-medium", children: "Time Synchronization" })] }), expandedSections['time'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['time'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "System clock skew can break HMAC signatures. This is rare but can happen on servers with incorrect time settings." }), _jsx("div", { className: "bg-yellow-50 p-3 rounded-md", children: _jsxs("div", { className: "text-sm text-yellow-800", children: [_jsx("strong", { children: "Check your server time:" }), _jsx("div", { className: "mt-1 text-xs text-yellow-700", children: "date && echo \"UTC: $(date -u)\" && echo \"Local: $(date)\"" })] }) })] }) }))] }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('cors'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(AlertTriangle, { className: "text-orange-600", size: 16 }), _jsx("span", { className: "font-medium", children: "CORS & HTTPS" })] }), expandedSections['cors'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['cors'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "Ensure your site loads over HTTPS and check browser console for CORS errors. Mixed content can cause issues." }), _jsx("div", { className: "bg-orange-50 p-3 rounded-md", children: _jsxs("div", { className: "text-sm text-orange-800", children: [_jsx("strong", { children: "Common CORS issues:" }), _jsxs("ul", { className: "mt-1 text-xs text-orange-700 space-y-1", children: [_jsx("li", { children: "\u2022 HTTP site trying to call HTTPS API" }), _jsx("li", { children: "\u2022 Domain not in allowed origins list" }), _jsx("li", { children: "\u2022 Missing or invalid Origin header" })] })] }) })] }) }))] }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('key'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "text-green-600", size: 16 }), _jsx("span", { className: "font-medium", children: "API Key & Secret" })] }), expandedSections['key'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['key'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "Create and manage your API keys on the dedicated API Keys page." }), _jsx("div", { className: "bg-blue-50 p-3 rounded-md", children: _jsxs("div", { className: "text-sm text-blue-800", children: [_jsx("strong", { children: "Next step:" }), _jsx("a", { href: "/api-keys", className: "text-blue-600 hover:text-blue-800 underline ml-1", children: "Go to API Keys page" })] }) })] }) }))] }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('curl'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(AlertTriangle, { className: "text-blue-600", size: 16 }), _jsx("span", { className: "font-medium", children: "Test cURL Command" })] }), expandedSections['curl'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['curl'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "Test your API key and secret with this cURL command. First create an API key on the API Keys page." }), properties.length > 0 ? (_jsx("div", { className: "space-y-3", children: properties.map(property => (_jsxs("div", { className: "bg-gray-900 text-green-400 p-3 rounded-md", children: [_jsxs("div", { className: "text-xs text-gray-400 mb-2", children: [property.domain, ":"] }), _jsx("div", { className: "text-xs text-yellow-400 mb-2", children: "\u26A0\uFE0F Create an API key first to get the key_id and secret" }), _jsx("pre", { className: "text-xs overflow-x-auto whitespace-pre-wrap", children: getTestCurl(property.id) })] }, property.id))) })) : (_jsx("div", { className: "text-sm text-gray-500 italic", children: "Create a property first to see test commands." })), _jsx("div", { className: "bg-blue-50 p-3 rounded-md", children: _jsxs("div", { className: "text-sm text-blue-800", children: [_jsx("strong", { children: "Next step:" }), _jsx("a", { href: "/api-keys", className: "text-blue-600 hover:text-blue-800 underline", children: "Create API keys on the API Keys page" })] }) })] }) }))] }), _jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => toggleSection('errors'), className: "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(AlertTriangle, { className: "text-red-600", size: 16 }), _jsx("span", { className: "font-medium", children: "Recent Errors (15m)" })] }), expandedSections['errors'] ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), expandedSections['errors'] && (_jsx("div", { className: "px-4 pb-4 border-t border-gray-200", children: _jsxs("div", { className: "pt-3 space-y-3", children: [_jsx("p", { className: "text-sm text-gray-700", children: "Check for recent error patterns that might indicate configuration issues." }), _jsx("div", { className: "bg-gray-50 p-3 rounded-md", children: _jsxs("div", { className: "text-sm text-gray-600", children: [_jsx("strong", { children: "Error monitoring:" }), " Use the Health dashboard to view recent error patterns and identify common issues."] }) })] }) }))] })] }));
}
export default function Install() {
    const { project } = useAuth();
    const [properties, setProperties] = useState([]);
    const [apiKeys, setApiKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newProperty, setNewProperty] = useState({
        project_id: project?.id || "",
        domain: ""
    });
    useEffect(() => {
        if (project?.id) {
            setNewProperty(prev => ({ ...prev, project_id: project.id }));
            loadProperties();
            loadApiKeys();
        }
    }, [project]);
    async function loadProperties() {
        if (!project?.id)
            return;
        try {
            const response = await fetch(`${API_BASE}/api/content?project_id=${project.id}`, FETCH_OPTS);
            if (response.ok) {
                const data = await response.json();
                // Extract unique properties from content
                const uniqueProperties = data.content.reduce((acc, item) => {
                    if (item.domain && !acc.find(p => p.domain === item.domain)) {
                        acc.push({ id: item.id, domain: item.domain, project_id: parseInt(project.id) });
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
        if (!project?.id)
            return;
        try {
            const response = await fetch(`${API_BASE}/api/keys?project_id=${project.id}`, FETCH_OPTS);
            if (response.ok) {
                const data = await response.json();
                setApiKeys(data);
            }
        }
        catch (error) {
            console.error("Error loading API keys:", error);
        }
        finally {
            setLoading(false);
        }
    }
    async function addProperty() {
        if (!project?.id || !newProperty.domain)
            return;
        try {
            const response = await fetch(`${API_BASE}/api/content`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: parseInt(project.id),
                    domain: newProperty.domain,
                    url: `https://${newProperty.domain}/`,
                    type: "website"
                })
            });
            if (response.ok) {
                setNewProperty({ project_id: project.id, domain: "" });
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
    return (_jsx(Shell, { children: _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-slate-900", children: "Installation & Setup" }), _jsxs("p", { className: "text-slate-600 mt-2", children: ["Get Optiview tracking on your ", project?.name || 'project', " website with our easy installation options"] })] }), _jsx(Card, { title: "Properties", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex gap-4", children: [_jsx("input", { type: "text", value: newProperty.domain, onChange: (e) => setNewProperty({ ...newProperty, domain: e.target.value }), placeholder: "example.com", className: "flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" }), _jsx("button", { onClick: addProperty, disabled: !newProperty.domain, className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: "Add Property" })] }), properties.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx("h4", { className: "font-medium text-slate-700", children: "Your Properties:" }), properties.map((property) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-md", children: [_jsx("span", { className: "font-mono text-sm", children: property.domain }), _jsxs("span", { className: "text-xs text-gray-500", children: ["ID: ", property.id] })] }, property.id)))] }))] }) }), _jsx(Card, { title: "API Keys", children: _jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "text-center py-8", children: [_jsx("p", { className: "text-gray-500 mb-4", children: "Create and manage your API keys on the dedicated API Keys page." }), _jsx("a", { href: "/api-keys", className: "inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors", children: "Manage API Keys" })] }) }) }), _jsx(Card, { title: "Hosted Tag Builder", children: _jsx(HostedTagBuilder, { properties: properties, apiKeys: apiKeys, projectId: project?.id || "" }) }), properties.length > 0 && (_jsx(Card, { title: "Installation Status", children: _jsx(InstallVerificationBanner, { properties: properties, apiKeys: [] }) })), _jsx(Card, { title: "Troubleshooting", children: _jsx(TroubleshootingGuide, { properties: properties, apiKeys: [] }) })] }) }));
}
