import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
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
                                        }) })) : (_jsx("div", { className: "text-sm text-gray-500 italic", children: "Create a property and API key first to see GTM templates." }))] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-slate-700 mb-2", children: "3. Cloudflare Worker (Advanced)" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "For high-traffic sites, deploy our worker template on your own zone for edge-level classification." }), _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-md p-4", children: [_jsxs("div", { className: "text-sm text-blue-800", children: [_jsx("strong", { children: "Download:" }), " ", _jsx("a", { href: "/examples/customer-worker.js", download: true, className: "text-blue-600 hover:text-blue-800 underline", children: "customer-worker.js" })] }), _jsx("div", { className: "text-xs text-blue-700 mt-2", children: "Deploy this to your Cloudflare zone and set environment variables for your Optiview credentials." })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-slate-700 mb-2", children: "4. Verify Installation" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "After installing, visit your website and check the Optiview dashboard for incoming events." }), _jsxs("div", { className: "bg-green-50 border border-green-200 rounded-md p-4", children: [_jsx("div", { className: "text-sm text-green-800", children: _jsx("strong", { children: "Success indicators:" }) }), _jsxs("ul", { className: "text-xs text-green-700 mt-2 space-y-1", children: [_jsx("li", { children: "\u2022 Page views appear in your Events dashboard" }), _jsx("li", { children: "\u2022 AI traffic is classified automatically" }), _jsx("li", { children: "\u2022 No console errors in browser dev tools" })] })] })] })] }) })] }) }));
}
