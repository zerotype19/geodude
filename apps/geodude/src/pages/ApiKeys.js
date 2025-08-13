import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import KeyRotationModal from "../components/KeyRotationModal";
import { RotateCcw, Trash2, AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";
export default function ApiKeys() {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rotationModal, setRotationModal] = useState(null);
    useEffect(() => {
        loadKeys();
    }, []);
    async function loadKeys() {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${API_BASE}/api/keys`, FETCH_OPTS);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            setKeys(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load API keys");
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
    function getKeyStatus(key) {
        if (key.revoked_at) {
            return { status: 'revoked', icon: _jsx(XCircle, { className: "text-red-600", size: 16 }), text: 'Revoked' };
        }
        if (key.grace_secret_hash && key.grace_expires_at) {
            const expiry = new Date(key.grace_expires_at);
            const now = new Date();
            if (now < expiry) {
                return { status: 'grace', icon: _jsx(Clock, { className: "text-yellow-600", size: 16 }), text: 'Grace Period' };
            }
        }
        return { status: 'active', icon: _jsx(CheckCircle, { className: "text-green-600", size: 16 }), text: 'Active' };
    }
    function getGraceCountdown(key) {
        if (!key.grace_expires_at)
            return null;
        const expiry = new Date(key.grace_expires_at);
        const now = new Date();
        const diffMs = expiry.getTime() - now.getTime();
        if (diffMs <= 0)
            return null;
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m remaining`;
    }
    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
    }
    if (loading) {
        return (_jsx(Shell, { children: _jsx("div", { className: "flex items-center justify-center min-h-64", children: _jsx("div", { className: "text-lg", children: "Loading API keys..." }) }) }));
    }
    if (error) {
        return (_jsx(Shell, { children: _jsx("div", { className: "flex items-center justify-center min-h-64", children: _jsx("div", { className: "text-red-600 text-lg", children: error }) }) }));
    }
    return (_jsx(Shell, { children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "API Keys" }), _jsx("p", { className: "mt-2 text-gray-600", children: "Manage your API keys for data ingestion" })] }), keys.length === 0 ? (_jsx(Card, { title: "No API Keys", children: _jsx("div", { className: "text-center py-8", children: _jsx("p", { className: "text-gray-500", children: "No API keys found. Create your first key to start collecting data." }) }) })) : (_jsx("div", { className: "space-y-6", children: keys.map((key) => {
                        const status = getKeyStatus(key);
                        const graceCountdown = getGraceCountdown(key);
                        return (_jsx(Card, { title: `${key.name} (${key.domain})`, children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Key ID" }), _jsx("p", { className: "text-sm text-gray-900 font-mono", children: key.key_id })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Status" }), _jsxs("div", { className: "flex items-center space-x-2", children: [status.icon, _jsx("span", { className: `text-sm ${status.status === 'active' ? 'text-green-600' :
                                                                    status.status === 'grace' ? 'text-yellow-600' :
                                                                        'text-red-600'}`, children: status.text })] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Created" }), _jsx("p", { className: "text-sm text-gray-900", children: formatDate(key.created_at) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-500", children: "Last Used" }), _jsx("p", { className: "text-sm text-gray-900", children: key.last_used_at ? formatDate(key.last_used_at) : 'Never' })] })] }), status.status === 'grace' && graceCountdown && (_jsx("div", { className: "bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4", children: _jsxs("div", { className: "flex items-start", children: [_jsx(AlertTriangle, { className: "text-yellow-600 mt-0.5 mr-2 flex-shrink-0", size: 16 }), _jsxs("div", { className: "text-sm text-yellow-800", children: [_jsx("p", { className: "font-medium mb-1", children: "Grace Period Active" }), _jsxs("p", { className: "mb-2", children: ["This key is using a grace period. The old secret will expire in: ", _jsx("strong", { children: graceCountdown })] }), _jsx("p", { children: "Update your implementation with the new secret before the grace period expires." })] })] }) })), _jsxs("div", { className: "flex space-x-3", children: [status.status !== 'revoked' && (_jsxs("button", { onClick: () => setRotationModal({ isOpen: true, keyId: key.id, keyName: key.name }), className: "flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors", children: [_jsx(RotateCcw, { size: 16 }), _jsx("span", { children: "Rotate" })] })), status.status !== 'revoked' && (_jsxs("button", { onClick: () => handleRevoke(key.id), className: "flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors", children: [_jsx(Trash2, { size: 16 }), _jsx("span", { children: "Revoke" })] }))] })] }) }, key.id));
                    }) })), rotationModal && (_jsx(KeyRotationModal, { isOpen: rotationModal.isOpen, onClose: () => setRotationModal(null), keyId: rotationModal.keyId, keyName: rotationModal.keyName, onRotate: handleRotate }))] }) }));
}
