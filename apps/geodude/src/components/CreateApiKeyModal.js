import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { X } from 'lucide-react';
export default function CreateApiKeyModal({ isOpen, onClose, onSubmit, isLoading = false }) {
    const [formData, setFormData] = useState({ name: '', note: '' });
    const [error, setError] = useState(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim())
            return;
        setError(null);
        try {
            await onSubmit({
                name: formData.name.trim(),
                note: formData.note.trim() || undefined
            });
            // Reset form on success
            setFormData({ name: '', note: '' });
            onClose();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create API key');
        }
    };
    const handleClose = () => {
        if (!isLoading) {
            setFormData({ name: '', note: '' });
            setError(null);
            onClose();
        }
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full mx-4", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900", children: "Create New API Key" }), _jsx("button", { onClick: handleClose, disabled: isLoading, className: "text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded", "aria-label": "Close modal", children: _jsx(X, { size: 20 }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "p-6", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { htmlFor: "key-name", className: "block text-sm font-medium text-gray-700 mb-1", children: ["Name ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { id: "key-name", type: "text", required: true, placeholder: "Production Key", className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }), disabled: isLoading })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "key-note", className: "block text-sm font-medium text-gray-700 mb-1", children: "Note/Label" }), _jsx("input", { id: "key-note", type: "text", placeholder: "Optional description or environment", className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", value: formData.note, onChange: (e) => setFormData({ ...formData, note: e.target.value }), disabled: isLoading }), _jsx("p", { className: "mt-1 text-xs text-gray-500", children: "Optional description for this key (e.g., \"Production\", \"Staging\")" })] }), error && (_jsx("div", { className: "p-3 bg-red-50 border border-red-200 rounded-md", children: _jsx("p", { className: "text-sm text-red-600", children: error }) }))] }), _jsxs("div", { className: "flex justify-end space-x-3 mt-6", children: [_jsx("button", { type: "button", onClick: handleClose, disabled: isLoading, className: "px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50", children: "Cancel" }), _jsx("button", { type: "submit", disabled: !formData.name.trim() || isLoading, className: "px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50", children: isLoading ? 'Creating...' : 'Create API Key' })] })] })] }) }));
}
