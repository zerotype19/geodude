import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { X, Copy, Eye, EyeOff, AlertTriangle } from "lucide-react";
export default function KeyRotationModal({ isOpen, onClose, keyId, keyName, onRotate }) {
    const [immediate, setImmediate] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const [rotationResult, setRotationResult] = useState(null);
    const [showSecret, setShowSecret] = useState(false);
    const [secretDisplayTime, setSecretDisplayTime] = useState(null);
    // Auto-hide secret after 5 minutes
    useEffect(() => {
        if (rotationResult?.new_secret_once && !secretDisplayTime) {
            const time = Date.now();
            setSecretDisplayTime(time);
            const timer = setTimeout(() => {
                setShowSecret(false);
            }, 5 * 60 * 1000); // 5 minutes
            return () => clearTimeout(timer);
        }
    }, [rotationResult, secretDisplayTime]);
    const handleRotate = async () => {
        setIsRotating(true);
        try {
            await onRotate(keyId, immediate);
            // The parent component should handle the actual rotation
            // and pass the result back via a callback
        }
        catch (error) {
            console.error("Rotation failed:", error);
        }
        finally {
            setIsRotating(false);
        }
    };
    const handleCopySecret = async () => {
        if (rotationResult?.new_secret_once) {
            try {
                await navigator.clipboard.writeText(rotationResult.new_secret_once);
                // Could add a toast notification here
            }
            catch (error) {
                console.error("Failed to copy secret:", error);
            }
        }
    };
    const formatGraceExpiry = (expiry) => {
        const expiryDate = new Date(expiry);
        const now = new Date();
        const diffMs = expiryDate.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${diffHours}h ${diffMinutes}m remaining`;
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full mx-4", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900", children: "Rotate API Key" }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600 transition-colors", children: _jsx(X, { size: 20 }) })] }), _jsx("div", { className: "p-6", children: !rotationResult ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mb-4", children: [_jsxs("p", { className: "text-sm text-gray-600 mb-4", children: ["You're about to rotate the API key ", _jsxs("strong", { children: ["\"", keyName, "\""] }), "."] }), _jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-md p-4 mb-4", children: _jsxs("div", { className: "flex items-start", children: [_jsx(AlertTriangle, { className: "text-blue-600 mt-0.5 mr-2 flex-shrink-0", size: 16 }), _jsxs("div", { className: "text-sm text-blue-800", children: [_jsx("p", { className: "font-medium mb-1", children: "Choose your rotation strategy:" }), _jsxs("p", { className: "mb-2", children: [_jsx("strong", { children: "Grace Period (Recommended):" }), " Keep the old secret valid for 24 hours so your traffic doesn't drop."] }), _jsxs("p", { children: [_jsx("strong", { children: "Immediate:" }), " Cut over immediately. Any requests using the old secret will fail."] })] })] }) })] }), _jsxs("div", { className: "space-y-3 mb-6", children: [_jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "radio", checked: !immediate, onChange: () => setImmediate(false), className: "mr-3 text-blue-600" }), _jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Grace Period Rotation" }), _jsx("p", { className: "text-sm text-gray-500", children: "24-hour grace period for seamless transition" })] })] }), _jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "radio", checked: immediate, onChange: () => setImmediate(true), className: "mr-3 text-blue-600" }), _jsxs("div", { children: [_jsx("span", { className: "font-medium", children: "Immediate Rotation" }), _jsx("p", { className: "text-sm text-gray-500", children: "Cut over immediately (may cause downtime)" })] })] })] }), _jsxs("div", { className: "flex space-x-3", children: [_jsx("button", { onClick: onClose, className: "flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors", children: "Cancel" }), _jsx("button", { onClick: handleRotate, disabled: isRotating, className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: isRotating ? "Rotating..." : "Rotate Key" })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "text-center mb-6", children: [_jsx("div", { className: "w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4", children: _jsx("div", { className: "w-8 h-8 bg-green-600 rounded-full" }) }), _jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-2", children: "Key Rotated Successfully!" }), _jsx("p", { className: "text-sm text-gray-600", children: rotationResult.message })] }), _jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "New Secret (Copy this now - it won't be shown again!)" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("div", { className: "flex-1 relative", children: [_jsx("input", { type: showSecret ? "text" : "password", value: rotationResult.new_secret_once, readOnly: true, className: "w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm" }), _jsx("button", { onClick: () => setShowSecret(!showSecret), className: "absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600", children: showSecret ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] }), _jsx("button", { onClick: handleCopySecret, className: "px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors", title: "Copy to clipboard", children: _jsx(Copy, { size: 16 }) })] }), secretDisplayTime && (_jsxs("p", { className: "text-xs text-gray-500 mt-1", children: ["Secret will be hidden in ", Math.max(0, Math.floor((secretDisplayTime + 5 * 60 * 1000 - Date.now()) / 1000)), "s"] }))] }), rotationResult.grace_expires_at && (_jsx("div", { className: "bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6", children: _jsxs("div", { className: "flex items-start", children: [_jsx(AlertTriangle, { className: "text-yellow-600 mt-0.5 mr-2 flex-shrink-0", size: 16 }), _jsxs("div", { className: "text-sm text-yellow-800", children: [_jsx("p", { className: "font-medium mb-1", children: "Grace Period Active" }), _jsxs("p", { className: "mb-2", children: ["The old secret will remain valid until: ", _jsx("strong", { children: formatGraceExpiry(rotationResult.grace_expires_at) })] }), _jsx("p", { children: "Update your implementation with the new secret before the grace period expires." })] })] }) })), _jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-md p-4 mb-6", children: _jsxs("div", { className: "text-sm text-blue-800", children: [_jsx("p", { className: "font-medium mb-1", children: "Edge Worker Customers" }), _jsx("p", { children: "If you use the Customer Edge Worker, update its stored secret within 24 hours to avoid service interruption." })] }) }), _jsx("button", { onClick: onClose, className: "w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors", children: "Done" })] })) })] }) }));
}
