import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import KeyRotationModal from "../components/KeyRotationModal";
import { RotateCcw, Trash2, AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
function getKeyStatus(key) {
    switch (key.status) {
        case 'active':
            return { status: 'active', text: 'Active', icon: _jsx(CheckCircle, { className: "text-green-600", size: 16 }) };
        case 'grace':
            return { status: 'grace', text: 'Grace Period', icon: _jsx(Clock, { className: "text-yellow-600", size: 16 }) };
        case 'revoked':
            return { status: 'revoked', text: 'Revoked', icon: _jsx(XCircle, { className: "text-red-600", size: 16 }) };
        default:
            return { status: 'active', text: 'Active', icon: _jsx(CheckCircle, { className: "text-green-600", size: 16 }) };
    }
}
function getGraceCountdown(key) {
    if (key.status !== 'grace' || !key.grace_expires_at)
        return null;
    const expiresAt = new Date(key.grace_expires_at).getTime();
    const now = Date.now();
    const timeLeft = expiresAt - now;
    if (timeLeft <= 0)
        return "Expired";
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    else {
        return `${minutes}m`;
    }
}
function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    catch (e) {
        return 'Invalid Date';
    }
}
export default function ApiKeys() {
    const { project } = useAuth();
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rotationModal, setRotationModal] = useState(null);
    const [newKey, setNewKey] = useState({ name: "" });
    const [showCreateForm, setShowCreateForm] = useState(false);
    useEffect(() => {
        if (project?.id) {
            loadKeys();
        }
    }, [project]);
    async function loadKeys() {
        if (!project?.id)
            return;
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${API_BASE}/api/keys?project_id=${project.id}`, FETCH_OPTS);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            setKeys(data.keys || []); // Extract the keys array from the response
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load API keys");
        }
        finally {
            setLoading(false);
        }
    }
    async function createApiKey() {
        if (!project?.id || !newKey.name)
            return;
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/api/keys`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: project.id,
                    name: newKey.name
                })
            });
            if (response.ok) {
                const data = await response.json();
                alert(`API Key created! Key ID: ${data.id}\n\n⚠️ Use this Key ID in your hosted tag implementation.`);
                setNewKey({ name: "" });
                setShowCreateForm(false);
                await loadKeys();
            }
            else {
                console.error("Failed to create API key");
            }
        }
        catch (error) {
            console.error("Error creating API key:", error);
        }
        finally {
            setLoading(false);
        }
    }
    async function handleRotate(keyId, immediate) {
        try {
            const response = await fetch(`${API_BASE}/api/keys/${keyId}/rotate`, {
                ...FETCH_OPTS,
                method: 'POST',
                body: JSON.stringify({ immediate })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();
            // Reload keys to get updated grace period info
            await loadKeys();
            // Show success message (could be a toast)
            console.log("Key rotated successfully:", result);
            // Close modal
            setRotationModal(null);
        }
        catch (err) {
            console.error("Rotation failed:", err);
            // Could show error toast here
        }
    }
    async function handleRevoke(keyId) {
        if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/keys/${keyId}/revoke`, {
                ...FETCH_OPTS,
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            // Reload keys
            await loadKeys();
            // Show success message
            console.log("Key revoked successfully");
        }
        catch (err) {
            console.error("Revocation failed:", err);
            // Could show error toast here
        }
    }
    if (loading) {
        return (_jsx(Shell, { children: _jsx("div", { className: "flex items-center justify-center min-h-64", children: _jsx("div", { className: "text-lg", children: "Loading API keys..." }) }) }));
    }
    if (error) {
        return (_jsx(Shell, { children: _jsx("div", { className: "flex items-center justify-center min-h-64", children: _jsx("div", { className: "text-red-600 text-lg", children: error }) }) }));
    }
    return (_jsx(Shell, { children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: [_jsxs("div", { className: "mb-8 flex justify-between items-center", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "API Keys" }), _jsx("p", { className: "mt-2 text-gray-600", children: "Manage your API keys for data ingestion" })] }), keys.length > 0 && (_jsx("button", { onClick: () => setShowCreateForm(!showCreateForm), className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors", children: "Create New Key" }))] }), keys.length === 0 ? (_jsx(Card, { title: "No API Keys", children: _jsxs("div", { className: "text-center py-8", children: [_jsx("p", { className: "text-gray-500 mb-6", children: "No API keys found. Create your first key to start collecting data." }), _jsx("div", { className: "max-w-md mx-auto", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "key-name", className: "block text-sm font-medium text-gray-700 mb-1", children: "Key Name" }), _jsx("input", { id: "key-name", type: "text", placeholder: "Production Key", className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", value: newKey.name || "", onChange: (e) => setNewKey({ ...newKey, name: e.target.value }) })] }), _jsx("button", { onClick: createApiKey, disabled: !project?.id || !newKey.name, className: "w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors", children: "Create API Key" })] }) })] }) })) : (_jsxs("div", { className: "space-y-6", children: [showCreateForm && (_jsx(Card, { title: "Create New API Key", children: _jsx("div", { className: "p-6", children: _jsx("div", { className: "max-w-md", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "new-key-name", className: "block text-sm font-medium text-gray-700 mb-1", children: "Key Name" }), _jsx("input", { id: "new-key-name", type: "text", placeholder: "Production Key", className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", value: newKey.name || "", onChange: (e) => setNewKey({ ...newKey, name: e.target.value }) })] }), _jsxs("div", { className: "flex space-x-3", children: [_jsx("button", { onClick: createApiKey, disabled: !project?.id || !newKey.name, className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors", children: "Create API Key" }), _jsx("button", { onClick: () => setShowCreateForm(false), className: "px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors", children: "Cancel" })] })] }) }) }) })), keys.map((key) => {
                            const status = getKeyStatus(key);
                            const graceCountdown = getGraceCountdown(key);
                            return (_jsx(Card, { title: `${key.name} (${key.id})`, children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Key ID" }), _jsx("p", { className: "text-sm text-gray-900 font-mono", children: key.id })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Status" }), _jsxs("div", { className: "flex items-center space-x-2", children: [status.icon, _jsx("span", { className: `text-sm ${status.status === 'active' ? 'text-green-600' :
                                                                        status.status === 'grace' ? 'text-yellow-600' :
                                                                            'text-red-600'}`, children: status.text })] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Created" }), _jsx("p", { className: "text-sm text-gray-900", children: formatDate(key.created_at) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Last Used" }), _jsx("p", { className: "text-sm text-gray-900", children: key.last_used_at ? formatDate(key.last_used_at) : 'Never' })] })] }), status.status === 'grace' && graceCountdown && (_jsx("div", { className: "bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4", children: _jsxs("div", { className: "flex items-start", children: [_jsx(AlertTriangle, { className: "text-yellow-600 mt-0.5 mr-2 flex-shrink-0", size: 16 }), _jsxs("div", { className: "text-sm text-yellow-800", children: [_jsx("p", { className: "font-medium mb-1", children: "Grace Period Active" }), _jsxs("p", { className: "mb-2", children: ["This key is using a grace period. The old secret will expire in: ", _jsx("strong", { children: graceCountdown })] }), _jsx("p", { children: "Update your implementation with the new secret before the grace period expires." })] })] }) })), _jsxs("div", { className: "flex space-x-3", children: [status.status !== 'revoked' && (_jsxs("button", { onClick: () => setRotationModal({ isOpen: true, keyId: key.id, keyName: key.name }), className: "flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors", children: [_jsx(RotateCcw, { size: 16 }), _jsx("span", { children: "Rotate" })] })), status.status !== 'revoked' && (_jsxs("button", { onClick: () => handleRevoke(key.id), className: "flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors", children: [_jsx(Trash2, { size: 16 }), _jsx("span", { children: "Revoke" })] }))] })] }) }, key.id));
                        })] })), rotationModal && (_jsx(KeyRotationModal, { isOpen: rotationModal.isOpen, onClose: () => setRotationModal(null), keyId: rotationModal.keyId, keyName: rotationModal.keyName, onRotate: handleRotate }))] }) }));
}
