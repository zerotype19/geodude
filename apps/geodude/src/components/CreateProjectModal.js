import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE, FETCH_OPTS } from "../config";
import { useNavigate } from "react-router-dom";
export default function CreateProjectModal({ isOpen, onClose }) {
    const { user, organization, switchContext } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: "",
        domain: "",
        createProperty: false,
        createKey: true
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Check if user can create projects
    const canCreateProjects = user?.is_admin || false; // You might need to add org role check here
    const validateDomain = (domain) => {
        if (!domain)
            return null;
        // Basic domain validation
        const normalizedDomain = domain.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/.*$/, '');
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalizedDomain)) {
            return "Please enter a valid domain (e.g., example.com)";
        }
        return null;
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!organization?.id || !formData.name.trim())
            return;
        // Validate domain if provided
        if (formData.domain && formData.createProperty) {
            const domainError = validateDomain(formData.domain);
            if (domainError) {
                setError(domainError);
                return;
            }
        }
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/api/projects`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    org_id: organization.id,
                    name: formData.name.trim(),
                    create_property: formData.createProperty && formData.domain,
                    domain: formData.domain || undefined,
                    create_key: formData.createKey
                }),
                ...FETCH_OPTS
            });
            if (response.ok) {
                const result = await response.json();
                // Switch to the new project
                await switchContext(organization.id, result.project.id);
                // Persist as last project
                localStorage.setItem('ov:lastProjectId', result.project.id);
                // Navigate based on what was created
                if (result.property && result.key) {
                    navigate(`/install?project_id=${result.project.id}&property_id=${result.property.id}&key_id=${result.key.id}`);
                }
                else {
                    navigate(`/events?project_id=${result.project.id}`);
                }
                // Close modal
                onClose();
                // Reset form
                setFormData({
                    name: "",
                    domain: "",
                    createProperty: false,
                    createKey: true
                });
            }
            else {
                const errorData = await response.json();
                setError(errorData.error || "Failed to create project");
            }
        }
        catch (error) {
            console.error("Error creating project:", error);
            setError("Network error. Please try again.");
        }
        finally {
            setLoading(false);
        }
    };
    const handleDomainChange = (e) => {
        const domain = e.target.value;
        setFormData(prev => ({
            ...prev,
            domain,
            createProperty: domain.length > 0 // Auto-enable if domain is provided
        }));
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50", children: _jsxs("div", { className: "relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Create New Project" }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600", children: _jsx(X, { className: "h-5 w-5" }) })] }), !canCreateProjects ? (_jsx("div", { className: "p-4 bg-yellow-50 border border-yellow-200 rounded-md", children: _jsxs("div", { className: "flex", children: [_jsx(AlertCircle, { className: "h-5 w-5 text-yellow-400" }), _jsx("div", { className: "ml-3", children: _jsx("p", { className: "text-sm text-yellow-800", children: "Only organization owners or admins can create projects." }) })] }) })) : (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [error && (_jsx("div", { className: "p-3 bg-red-50 border border-red-200 rounded-md", children: _jsx("p", { className: "text-sm text-red-800", children: error }) })), _jsxs("div", { children: [_jsx("label", { htmlFor: "name", className: "block text-sm font-medium text-gray-700 mb-2", children: "Project Name *" }), _jsx("input", { type: "text", id: "name", value: formData.name, onChange: (e) => setFormData(prev => ({ ...prev, name: e.target.value })), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", placeholder: "My Awesome Project", required: true })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "domain", className: "block text-sm font-medium text-gray-700 mb-2", children: "Primary Domain (optional)" }), _jsx("input", { type: "text", id: "domain", value: formData.domain, onChange: handleDomainChange, className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", placeholder: "example.com" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "The main website domain for this project" })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", id: "createProperty", checked: formData.createProperty, onChange: (e) => setFormData(prev => ({ ...prev, createProperty: e.target.checked })), disabled: !formData.domain, className: "h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" }), _jsx("label", { htmlFor: "createProperty", className: "ml-2 block text-sm text-gray-700", children: "Create initial property from domain" })] }), _jsxs("div", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", id: "createKey", checked: formData.createKey, onChange: (e) => setFormData(prev => ({ ...prev, createKey: e.target.checked })), className: "h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" }), _jsx("label", { htmlFor: "createKey", className: "ml-2 block text-sm text-gray-700", children: "Create default API key" })] })] }), _jsxs("div", { className: "flex space-x-3 pt-4", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: "Cancel" }), _jsx("button", { type: "submit", disabled: loading || !formData.name.trim(), className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: loading ? "Creating..." : "Create Project" })] })] }))] }) }));
}
