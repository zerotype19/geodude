import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE, FETCH_OPTS } from '../config';
import { CheckCircle, Clock, AlertTriangle, Copy, ExternalLink, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './ui/Card';
import MaskedKey from './MaskedKey';
import CreateApiKeyModal from './CreateApiKeyModal';
import { ToastContainer } from './Toast';
export default function InstallWizard() {
    const { project } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    // Parse URL parameters
    const urlParams = new URLSearchParams(location.search);
    const preselectedKeyId = urlParams.get('key_id');
    const preselectedPropertyId = urlParams.get('property_id');
    const preselectedProjectId = urlParams.get('project_id');
    // State
    const [properties, setProperties] = useState([]);
    const [apiKeys, setApiKeys] = useState([]);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [selectedApiKey, setSelectedApiKey] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [toasts, setToasts] = useState([]);
    // New property form
    const [newPropertyDomain, setNewPropertyDomain] = useState('');
    const [propertyError, setPropertyError] = useState(null);
    const [isCreatingProperty, setIsCreatingProperty] = useState(false);
    // Snippet config
    const [config, setConfig] = useState({
        clicks: true,
        spa: true,
        batchSize: 10,
        flushMs: 3000
    });
    const [showAdvanced, setShowAdvanced] = useState(false);
    // Verification state
    const [verificationData, setVerificationData] = useState(null);
    const [verificationStatus, setVerificationStatus] = useState('waiting');
    const [verificationTimer, setVerificationTimer] = useState(null);
    // Copy states
    const [copiedSnippet, setCopiedSnippet] = useState(false);
    // Calculate wizard steps
    const steps = [
        {
            id: 1,
            title: 'Property',
            status: selectedProperty ? 'ready' : 'pending',
            description: selectedProperty ? `Selected: ${selectedProperty.domain}` : 'Choose your domain'
        },
        {
            id: 2,
            title: 'API Key',
            status: selectedApiKey && selectedApiKey.status !== 'revoked' ? 'ready' : 'pending',
            description: selectedApiKey ? `Selected: ${selectedApiKey.name}` : 'Choose your API key'
        },
        {
            id: 3,
            title: 'Hosted Tag',
            status: (selectedProperty && selectedApiKey && selectedApiKey.status !== 'revoked') ? 'ready' : 'pending',
            description: verificationStatus === 'connected' ? 'Installation verified!' : 'Copy and install your tag'
        }
    ];
    // Load data on mount and project change
    useEffect(() => {
        if (project?.id) {
            loadData();
        }
    }, [project]);
    // Handle preselection
    useEffect(() => {
        if (preselectedPropertyId && properties.length > 0) {
            const property = properties.find(p => p.id.toString() === preselectedPropertyId);
            if (property) {
                setSelectedProperty(property);
            }
        }
        else if (properties.length === 1) {
            setSelectedProperty(properties[0]);
        }
    }, [preselectedPropertyId, properties]);
    useEffect(() => {
        if (preselectedKeyId && apiKeys.length > 0) {
            const key = apiKeys.find(k => k.id === preselectedKeyId);
            if (key) {
                setSelectedApiKey(key);
            }
        }
        else if (apiKeys.length > 0 && !preselectedKeyId) {
            // Auto-select most recently created active key
            const activeKeys = apiKeys.filter(k => k.status === 'active');
            if (activeKeys.length > 0) {
                setSelectedApiKey(activeKeys[0]); // Already sorted by created_at desc
            }
        }
    }, [preselectedKeyId, apiKeys]);
    // Load localStorage preferences
    useEffect(() => {
        if (project?.id) {
            const storageKey = `install_prefs_${project.id}`;
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    const prefs = JSON.parse(saved);
                    if (prefs.config) {
                        setConfig(prev => ({ ...prev, ...prefs.config }));
                    }
                }
                catch (e) {
                    console.error('Failed to load preferences:', e);
                }
            }
        }
    }, [project]);
    // Save to localStorage when selections change
    useEffect(() => {
        if (project?.id && (selectedProperty || selectedApiKey)) {
            const storageKey = `install_prefs_${project.id}`;
            const prefs = {
                property_id: selectedProperty?.id,
                key_id: selectedApiKey?.id,
                config
            };
            localStorage.setItem(storageKey, JSON.stringify(prefs));
        }
    }, [project, selectedProperty, selectedApiKey, config]);
    const loadData = async () => {
        if (!project?.id)
            return;
        setLoading(true);
        try {
            const [propertiesResponse, keysResponse] = await Promise.all([
                fetch(`${API_BASE}/api/properties?project_id=${project.id}`, FETCH_OPTS),
                fetch(`${API_BASE}/api/keys?project_id=${project.id}`, FETCH_OPTS)
            ]);
            if (propertiesResponse.ok) {
                const propertiesData = await propertiesResponse.json();
                setProperties(propertiesData);
            }
            if (keysResponse.ok) {
                const keysData = await keysResponse.json();
                setApiKeys(keysData.keys || []);
            }
        }
        catch (error) {
            console.error('Error loading data:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const createProperty = async () => {
        if (!project?.id || !newPropertyDomain.trim())
            return;
        setIsCreatingProperty(true);
        setPropertyError(null);
        try {
            const response = await fetch(`${API_BASE}/api/properties`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: project.id,
                    domain: newPropertyDomain.trim()
                })
            });
            if (response.ok) {
                const newProperty = await response.json();
                setProperties(prev => [newProperty, ...prev]);
                setSelectedProperty(newProperty);
                setNewPropertyDomain('');
                addToast('Property created successfully!', 'success');
            }
            else {
                const error = await response.json();
                if (response.status === 409) {
                    setPropertyError('That domain is already registered for this project.');
                }
                else {
                    setPropertyError(error.error || 'Failed to create property');
                }
            }
        }
        catch (error) {
            console.error('Error creating property:', error);
            setPropertyError('Network error. Please try again.');
        }
        finally {
            setIsCreatingProperty(false);
        }
    };
    const createApiKey = async (formData) => {
        if (!project?.id)
            return;
        setIsCreating(true);
        try {
            const response = await fetch(`${API_BASE}/api/keys`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: project.id,
                    name: formData.note ? `${formData.name} (${formData.note})` : formData.name
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const newKey = await response.json();
            setApiKeys(prev => [newKey, ...prev]);
            setSelectedApiKey(newKey);
            setShowCreateModal(false);
            addToast('API Key created successfully!', 'success');
        }
        catch (error) {
            console.error('Error creating API key:', error);
            throw error;
        }
        finally {
            setIsCreating(false);
        }
    };
    const generateSnippet = () => {
        if (!selectedProperty || !selectedApiKey)
            return '';
        const attrs = [
            `data-key-id="${selectedApiKey.id}"`,
            `data-project-id="${project?.id}"`,
            `data-property-id="${selectedProperty.id}"`
        ];
        if (config.clicks)
            attrs.push('data-clicks="1"');
        if (config.spa)
            attrs.push('data-spa="1"');
        if (config.batchSize !== 10)
            attrs.push(`data-batch-size="${config.batchSize}"`);
        if (config.flushMs !== 3000)
            attrs.push(`data-flush-ms="${config.flushMs}"`);
        return `<script async src="https://api.optiview.ai/v1/tag.js"\n  ${attrs.join('\n  ')}></script>`;
    };
    const copySnippet = async () => {
        try {
            await navigator.clipboard.writeText(generateSnippet());
            setCopiedSnippet(true);
            addToast('Snippet copied to clipboard!', 'success');
            setTimeout(() => setCopiedSnippet(false), 2000);
        }
        catch (error) {
            addToast('Failed to copy to clipboard', 'error');
        }
    };
    // Verification polling
    const startVerification = () => {
        if (!project?.id)
            return;
        const poll = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/events/last-seen?project_id=${project.id}`, FETCH_OPTS);
                if (response.ok) {
                    const data = await response.json();
                    setVerificationData(data);
                    if (data.events_15m > 0) {
                        setVerificationStatus('connected');
                        if (verificationTimer) {
                            clearInterval(verificationTimer);
                            setVerificationTimer(null);
                        }
                    }
                }
            }
            catch (error) {
                console.error('Verification polling error:', error);
                setVerificationStatus('error');
            }
        };
        poll(); // Initial poll
        const timer = setInterval(poll, 10000); // Poll every 10 seconds
        setVerificationTimer(timer);
        // Auto-stop after 2 minutes
        setTimeout(() => {
            if (verificationTimer) {
                clearInterval(timer);
                setVerificationTimer(null);
            }
        }, 120000);
    };
    useEffect(() => {
        if (steps[2].status === 'ready' && verificationStatus === 'waiting') {
            startVerification();
        }
        return () => {
            if (verificationTimer) {
                clearInterval(verificationTimer);
            }
        };
    }, [steps[2].status]);
    // Toast management
    const addToast = (message, type) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);
    };
    const removeToast = (id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };
    if (loading) {
        return (_jsx("div", { className: "max-w-4xl mx-auto px-4 py-8", children: _jsxs("div", { className: "flex items-center justify-center py-12", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" }), _jsx("span", { className: "ml-3 text-gray-600", children: "Loading..." })] }) }));
    }
    const StepIcon = ({ step }) => {
        switch (step.status) {
            case 'ready':
                return _jsx(CheckCircle, { className: "text-green-600", size: 24 });
            case 'error':
                return _jsx(AlertTriangle, { className: "text-red-600", size: 24 });
            default:
                return (_jsx("div", { className: "w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center", children: _jsx("span", { className: "text-sm font-medium text-gray-600", children: step.id }) }));
        }
    };
    return (_jsxs("div", { className: "max-w-4xl mx-auto px-4 py-8", children: [_jsxs("div", { className: "mb-8", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "Installation Guide" }), _jsx("p", { className: "mt-2 text-gray-600", children: "Set up your hosted analytics tag in 3 easy steps" })] }), project && (_jsxs("div", { className: "px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium", children: ["Project: ", project.name] }))] }), (preselectedKeyId || preselectedPropertyId) && (_jsx("div", { className: "mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md", children: _jsxs("p", { className: "text-sm text-blue-800", children: ["\uD83D\uDD17 Preselected from link:", preselectedKeyId && ` Key ${preselectedKeyId}`, preselectedPropertyId && ` Property ${preselectedPropertyId}`, ". You can change selections below."] }) })), _jsx("div", { className: "mt-6 flex space-x-6", children: steps.map((step) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(StepIcon, { step: step }), _jsx("span", { className: `text-sm font-medium ${step.status === 'ready' ? 'text-green-600' :
                                        step.status === 'error' ? 'text-red-600' : 'text-gray-500'}`, children: step.title })] }, step.id))) })] }), _jsx(Card, { title: "Step 1 \u2014 Property", children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-start space-x-4", children: [_jsx(StepIcon, { step: steps[0] }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "Choose Your Domain" }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Your site's domain must be allow-listed for CORS. Use the exact domain where you'll install the tag." }), properties.length > 0 ? (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Select Property" }), _jsxs("select", { value: selectedProperty?.id || '', onChange: (e) => {
                                                            const property = properties.find(p => p.id.toString() === e.target.value);
                                                            setSelectedProperty(property || null);
                                                        }, className: "w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "", children: "Choose a domain..." }), properties.map((property) => (_jsx("option", { value: property.id, children: property.domain }, property.id)))] })] }), _jsxs("div", { className: "border-t pt-4", children: [_jsx("h4", { className: "text-sm font-medium text-gray-900 mb-2", children: "Or add a new domain:" }), _jsxs("div", { className: "flex space-x-3", children: [_jsx("input", { type: "text", placeholder: "example.com", value: newPropertyDomain, onChange: (e) => setNewPropertyDomain(e.target.value), className: "flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" }), _jsx("button", { onClick: createProperty, disabled: isCreatingProperty || !newPropertyDomain.trim(), className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500", children: isCreatingProperty ? 'Adding...' : 'Add Property' })] })] })] })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex space-x-3", children: [_jsx("input", { type: "text", placeholder: "example.com", value: newPropertyDomain, onChange: (e) => setNewPropertyDomain(e.target.value), className: "flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" }), _jsx("button", { onClick: createProperty, disabled: isCreatingProperty || !newPropertyDomain.trim(), className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500", children: isCreatingProperty ? 'Adding...' : 'Add Property' })] }), _jsx("p", { className: "text-sm text-orange-600", children: "No properties found. Add your first domain to continue." })] })), propertyError && (_jsx("div", { className: "mt-3 p-3 bg-red-50 border border-red-200 rounded-md", children: _jsx("p", { className: "text-sm text-red-600", children: propertyError }) }))] })] }) }) }), _jsx(Card, { title: "Step 2 \u2014 API Key", children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-start space-x-4", children: [_jsx(StepIcon, { step: steps[1] }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "Choose Your API Key" }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Select an active API key for authentication. Only active and grace period keys can be used." }), apiKeys.length > 0 ? (_jsxs("div", { className: "space-y-4", children: [apiKeys.map((key) => (_jsx("div", { className: `p-4 border rounded-md cursor-pointer transition-colors ${selectedApiKey?.id === key.id
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : key.status === 'revoked'
                                                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                                                        : 'border-gray-200 hover:border-gray-300'}`, onClick: () => {
                                                    if (key.status !== 'revoked') {
                                                        setSelectedApiKey(key);
                                                    }
                                                }, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("h4", { className: "font-medium text-gray-900", children: key.name }), _jsx("span", { className: `px-2 py-1 text-xs rounded-full ${key.status === 'active' ? 'bg-green-100 text-green-800' :
                                                                                key.status === 'grace' ? 'bg-yellow-100 text-yellow-800' :
                                                                                    'bg-red-100 text-red-800'}`, children: key.status === 'active' ? 'Active' :
                                                                                key.status === 'grace' ? 'In Grace Period' : 'Revoked' })] }), selectedApiKey?.id === key.id && (_jsx("div", { className: "mt-2", children: _jsx(MaskedKey, { value: key.id, className: "text-sm" }) }))] }), _jsx("div", { className: "flex items-center", children: _jsx("input", { type: "radio", checked: selectedApiKey?.id === key.id, disabled: key.status === 'revoked', onChange: () => { }, className: "w-4 h-4 text-blue-600 disabled:opacity-50" }) })] }) }, key.id))), _jsx("div", { className: "border-t pt-4", children: _jsx("button", { onClick: () => setShowCreateModal(true), className: "px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500", children: "Create New API Key" }) })] })) : (_jsxs("div", { className: "text-center py-8", children: [_jsx("p", { className: "text-sm text-gray-500 mb-4", children: "No API keys found." }), _jsx("button", { onClick: () => setShowCreateModal(true), className: "px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500", children: "Create Your First API Key" })] }))] })] }) }) }), steps[2].status === 'ready' && (_jsx(Card, { title: "Step 3 \u2014 Hosted Tag", children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-start space-x-4", children: [_jsx(StepIcon, { step: steps[2] }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "Install Your Tag" }), _jsx("p", { className: "text-sm text-gray-600 mb-6", children: "Copy this snippet and paste it in your website's HTML, just before the closing </head> tag." }), _jsxs("div", { className: "mb-6 space-y-4", children: [_jsxs("div", { className: "flex space-x-6", children: [_jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", checked: config.clicks, onChange: (e) => setConfig(prev => ({ ...prev, clicks: e.target.checked })), className: "w-4 h-4 text-blue-600 rounded" }), _jsx("span", { className: "ml-2 text-sm text-gray-700", children: "Click tracking" })] }), _jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", checked: config.spa, onChange: (e) => setConfig(prev => ({ ...prev, spa: e.target.checked })), className: "w-4 h-4 text-blue-600 rounded" }), _jsx("span", { className: "ml-2 text-sm text-gray-700", children: "SPA routing" })] })] }), _jsxs("div", { className: "border-t pt-4", children: [_jsxs("button", { onClick: () => setShowAdvanced(!showAdvanced), className: "flex items-center text-sm text-gray-600 hover:text-gray-800", children: [showAdvanced ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 }), _jsx("span", { className: "ml-1", children: "Advanced Settings" })] }), showAdvanced && (_jsxs("div", { className: "mt-3 grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Batch Size (1-50)" }), _jsx("input", { type: "number", min: "1", max: "50", value: config.batchSize, onChange: (e) => setConfig(prev => ({
                                                                            ...prev,
                                                                            batchSize: Math.max(1, Math.min(50, parseInt(e.target.value) || 10))
                                                                        })), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Flush Interval (500-10000ms)" }), _jsx("input", { type: "number", min: "500", max: "10000", step: "100", value: config.flushMs, onChange: (e) => setConfig(prev => ({
                                                                            ...prev,
                                                                            flushMs: Math.max(500, Math.min(10000, parseInt(e.target.value) || 3000))
                                                                        })), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" })] })] }))] })] }), _jsx("div", { className: "mb-6", children: _jsxs("div", { className: "relative", children: [_jsx("pre", { className: "bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm", children: _jsx("code", { children: generateSnippet() }) }), _jsx("button", { onClick: copySnippet, className: "absolute top-3 right-3 p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500", children: copiedSnippet ? _jsx(CheckCircle, { size: 16 }) : _jsx(Copy, { size: 16 }) })] }) }), _jsxs("div", { className: "flex flex-wrap gap-3 mb-6", children: [_jsxs("a", { href: "/docs/install#gtm", target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500", children: [_jsx(ExternalLink, { size: 16, className: "mr-2" }), "GTM Instructions"] }), _jsxs("a", { href: `https://api.optiview.ai/v1/tag.js?debug=1&key_id=${selectedApiKey?.id}&project_id=${project?.id}&property_id=${selectedProperty?.id}`, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500", children: [_jsx(ExternalLink, { size: 16, className: "mr-2" }), "Debug Build"] })] }), _jsxs("div", { className: "border-t pt-6", children: [_jsx("h4", { className: "text-sm font-medium text-gray-900 mb-3", children: "Installation Verification" }), _jsxs("div", { className: "bg-gray-50 p-4 rounded-md", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("span", { className: `inline-flex items-center px-2 py-1 text-xs rounded-full ${verificationStatus === 'connected' ? 'bg-green-100 text-green-800' :
                                                                    verificationStatus === 'error' ? 'bg-red-100 text-red-800' :
                                                                        'bg-yellow-100 text-yellow-800'}`, children: verificationStatus === 'connected' ? (_jsxs(_Fragment, { children: [_jsx(CheckCircle, { size: 12, className: "mr-1" }), "Connected"] })) : verificationStatus === 'error' ? (_jsxs(_Fragment, { children: [_jsx(AlertTriangle, { size: 12, className: "mr-1" }), "Error"] })) : (_jsxs(_Fragment, { children: [_jsx(Clock, { size: 12, className: "mr-1" }), "Waiting for events..."] })) }), _jsx("button", { onClick: () => {
                                                                    setVerificationStatus('waiting');
                                                                    setVerificationData(null);
                                                                    startVerification();
                                                                }, className: "p-1 text-gray-500 hover:text-gray-700", children: _jsx(RefreshCw, { size: 16 }) })] }), verificationData ? (_jsxs("div", { className: "text-sm space-y-2", children: [_jsxs("p", { children: [_jsx("strong", { children: "Events (15m):" }), " ", verificationData.events_15m] }), verificationData.last_event_ts && (_jsxs("p", { children: [_jsx("strong", { children: "Last Event:" }), " ", new Date(verificationData.last_event_ts * 1000).toLocaleString()] })), Object.keys(verificationData.by_class_15m).length > 0 && (_jsxs("div", { children: [_jsx("strong", { children: "Event Types:" }), _jsx("ul", { className: "ml-4 mt-1", children: Object.entries(verificationData.by_class_15m).map(([type, count]) => (_jsxs("li", { children: ["\u2022 ", type, ": ", count] }, type))) })] }))] })) : (_jsx("p", { className: "text-sm text-gray-600", children: "Install the tag on your website, then visit a page to verify the connection." }))] })] })] })] }) }) })), _jsx(CreateApiKeyModal, { isOpen: showCreateModal, onClose: () => setShowCreateModal(false), onSubmit: createApiKey, isLoading: isCreating }), _jsx(ToastContainer, { toasts: toasts, onRemove: removeToast })] }));
}
