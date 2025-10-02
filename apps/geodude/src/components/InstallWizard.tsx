import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE, FETCH_OPTS } from '../config';
import { CheckCircle, Clock, AlertTriangle, Eye, EyeOff, Copy, ExternalLink, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './ui/Card';
import MaskedKey from './MaskedKey';
import CreateApiKeyModal from './CreateApiKeyModal';
import { ToastContainer, ToastData } from './Toast';

interface Property {
  id: number;
  project_id: string;
  domain: string;
  created_at: string;
}

interface ApiKey {
  id: string;
  name: string;
  status: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  grace_expires_at: string | null;
}

interface WizardStep {
  id: number;
  title: string;
  status: 'pending' | 'ready' | 'error';
  description: string;
}

interface VerificationData {
  events_15m: number;
  by_class_15m: { [key: string]: number };
  last_event_ts: number | null;
  last_event_type: string | null;
}

interface ConfigState {
  clicks: boolean;
  spa: boolean;
  batchSize: number;
  flushMs: number;
}

export default function InstallWizard() {
  const { project } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Parse URL parameters
  const urlParams = new URLSearchParams(location.search);
  const preselectedKeyId = urlParams.get('key_id');
  const preselectedPropertyId = urlParams.get('property_id');
  const preselectedProjectId = urlParams.get('project_id');
  
  // Check if arrived via direct link with project_id and key_id
  const arrivedViaDirectLink = !!(preselectedProjectId && preselectedKeyId);

  // State
  const [properties, setProperties] = useState<Property[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // New property form
  const [newPropertyDomain, setNewPropertyDomain] = useState('');
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [isCreatingProperty, setIsCreatingProperty] = useState(false);

  // Snippet config
  const [config, setConfig] = useState<ConfigState>({
    clicks: true,
    spa: true,
    batchSize: 10,
    flushMs: 3000
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Verification state
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'waiting' | 'connected' | 'error'>('waiting');
  const [verificationTimer, setVerificationTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Live data banner state
  const [showLiveDataBanner, setShowLiveDataBanner] = useState(false);
  const [showPreselectedBanner, setShowPreselectedBanner] = useState(false);
  const [preselectedBannerDismissed, setPreselectedBannerDismissed] = useState(false);

  // Copy states
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Calculate wizard steps
  const steps: WizardStep[] = [
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
    } else if (properties.length === 1) {
      setSelectedProperty(properties[0]);
    }
  }, [preselectedPropertyId, properties]);

  useEffect(() => {
    if (preselectedKeyId && apiKeys.length > 0) {
      const key = apiKeys.find(k => k.id === preselectedKeyId);
      if (key) {
        setSelectedApiKey(key);
      }
    } else if (apiKeys.length > 0 && !preselectedKeyId) {
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
        } catch (e) {
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
    if (!project?.id) return;

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
        console.log('API Keys response:', keysData); // Debug logging
        setApiKeys(keysData.keys || []);
      } else {
        console.error('Failed to fetch API keys:', keysResponse.status, keysResponse.statusText);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProperty = async () => {
    if (!project?.id || !newPropertyDomain.trim()) return;

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
        addToast(`Domain added: ${newProperty.domain}`, 'success');
      } else {
        const error = await response.json();
        if (response.status === 409) {
          setPropertyError('That domain is already registered for this project.');
        } else {
          setPropertyError(error.error || 'Failed to create property');
        }
      }
    } catch (error) {
      console.error('Error creating property:', error);
      setPropertyError('Network error. Please try again.');
    } finally {
      setIsCreatingProperty(false);
    }
  };

  const createApiKey = async (formData: { name: string; note?: string }) => {
    if (!project?.id) return;

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
    } catch (error) {
      console.error('Error creating API key:', error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const generateSnippet = () => {
    if (!selectedProperty || !selectedApiKey) return '';
    
    const attrs = [
      `data-key-id="${selectedApiKey.id}"`,
      `data-project-id="${project?.id}"`,
      `data-property-id="${selectedProperty.id}"`
    ];

    if (config.clicks) attrs.push('data-clicks="1"');
    if (config.spa) attrs.push('data-spa="1"');
    if (config.batchSize !== 10) attrs.push(`data-batch-size="${config.batchSize}"`);
    if (config.flushMs !== 3000) attrs.push(`data-flush-ms="${config.flushMs}"`);

    return `<link rel="preconnect" href="https://api.optiview.ai" crossorigin>
<script defer src="https://api.optiview.ai/v1/tag.js"\n  ${attrs.join('\n  ')}></script>`;
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(generateSnippet());
      setCopiedSnippet(true);
      addToast('Snippet copied to clipboard!', 'success');
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch (error) {
      addToast('Failed to copy to clipboard', 'error');
    }
  };

  // Verification polling
  const startVerification = () => {
    if (!project?.id) return;

    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/events/last-seen?project_id=${project.id}`, FETCH_OPTS);
        if (response.ok) {
          const data = await response.json();
          setVerificationData(data);
          
          if (data.events_15m > 0) {
            setVerificationStatus('connected');
            
            // Show live data banner if arrived via direct link
            if (arrivedViaDirectLink && !showLiveDataBanner) {
              setShowLiveDataBanner(true);
            }
            
            if (verificationTimer) {
              clearInterval(verificationTimer);
              setVerificationTimer(null);
            }
          }
        }
      } catch (error) {
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
  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  const StepIcon = ({ step }: { step: WizardStep }) => {
    switch (step.status) {
      case 'ready':
        return <CheckCircle className="text-green-600" size={24} />;
      case 'error':
        return <AlertTriangle className="text-red-600" size={24} />;
      default:
        return (
          <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-sm font-medium text-gray-600">{step.id}</span>
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header with project badge */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Installation Guide</h1>
            <p className="mt-2 text-gray-600">Set up your hosted analytics tag in 3 easy steps</p>
          </div>
          {project && (
            <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Project: {project.name}
            </div>
          )}
        </div>

        {/* Preselect banner */}
        {(preselectedKeyId || preselectedPropertyId) && !preselectedBannerDismissed && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md relative">
            <button
              onClick={() => setPreselectedBannerDismissed(true)}
              className="absolute top-2 right-2 text-blue-600 hover:text-blue-800"
            >
              ✕
            </button>
            <p className="text-sm text-blue-800 pr-6">
              <strong>Preselected from API Keys:</strong> 
              {preselectedKeyId && ` Key ${preselectedKeyId}`}
              {preselectedPropertyId && ` Property ${preselectedPropertyId}`}
              . You can change selections below.
            </p>
          </div>
        )}

        {/* Live Data Detection Banner */}
        {showLiveDataBanner && verificationStatus === 'connected' && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">
                  Live data detected for this project in the last 15 minutes.
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Your tracking tag is working and events are flowing successfully.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigate('/events')}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Go to Events
                </button>
                <button
                  onClick={() => setShowLiveDataBanner(false)}
                  className="text-green-600 hover:text-green-800"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Checklist summary */}
        <div className="mt-6 flex space-x-6">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center space-x-2">
              <StepIcon step={step} />
              <span className={`text-sm font-medium ${
                step.status === 'ready' ? 'text-green-600' : 
                step.status === 'error' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Property */}
      <Card title="Step 1 — Property">
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <StepIcon step={steps[0]} />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium text-gray-900">Choose Your Domain</h3>
                <a
                  href="/settings#properties"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Manage domains
                </a>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Your site's domain must be allow-listed for CORS. Use the exact domain where you'll install the tag.
              </p>

              {/* Preselect error notice */}
              {preselectedPropertyId && !selectedProperty && properties.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Preselected property not found; please choose or add a domain.
                  </p>
                </div>
              )}

              {/* Test domain notice */}
              {properties.length > 0 && properties.every(p => p.domain.includes('test') || p.domain.includes('localhost') || p.domain.includes('dev')) && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    💡 Add your real domain to allow CORS from your site.
                  </p>
                </div>
              )}

              <div className="space-y-6">
                {/* Existing Properties Dropdown */}
                {properties.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Existing Domain
                    </label>
                    <select
                      value={selectedProperty?.id || ''}
                      onChange={(e) => {
                        const property = properties.find(p => p.id.toString() === e.target.value);
                        setSelectedProperty(property || null);
                      }}
                      className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Choose a domain...</option>
                      {properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.domain}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Add New Property - Always Visible */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {properties.length > 0 ? 'Or Add New Domain' : 'Add Your Domain'}
                  </label>
                  <div className="space-y-3">
                    <div className="flex space-x-3">
                      <input
                        type="text"
                        placeholder="example.com"
                        value={newPropertyDomain}
                        onChange={(e) => setNewPropertyDomain(e.target.value)}
                        className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={createProperty}
                        disabled={isCreatingProperty || !newPropertyDomain.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {isCreatingProperty ? 'Adding...' : 'Add Property'}
                      </button>
                    </div>
                    
                    {/* Help Text */}
                    <p className="text-sm text-gray-600">
                      Enter the exact hostname where you'll install the tag (no http/https, no path). Example: www.example.com or example.com.
                    </p>
                    
                    {/* Rules */}
                    <p className="text-xs text-gray-500">
                      Exact host match only • Subdomains are separate • IPs/localhost not allowed
                    </p>
                  </div>
                </div>
              </div>

              {propertyError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{propertyError}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Step 2: API Key */}
      <Card title="Step 2 — API Key">
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <StepIcon step={steps[1]} />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Choose Your API Key</h3>
              <p className="text-sm text-gray-600 mb-4">
                Select an active API key for authentication. Only active and grace period keys can be used.
              </p>

              {apiKeys.length > 0 ? (
                <div className="space-y-4">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className={`p-4 border rounded-md cursor-pointer transition-colors ${
                        selectedApiKey?.id === key.id
                          ? 'border-blue-500 bg-blue-50'
                          : key.status === 'revoked'
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        if (key.status !== 'revoked') {
                          setSelectedApiKey(key);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h4 className="font-medium text-gray-900">{key.name}</h4>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              key.status === 'active' ? 'bg-green-100 text-green-800' :
                              key.status === 'grace' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {key.status === 'active' ? 'Active' :
                               key.status === 'grace' ? 'In Grace Period' : 'Revoked'}
                            </span>
                          </div>
                          {selectedApiKey?.id === key.id && (
                            <div className="mt-2">
                              <MaskedKey value={key.id} className="text-sm" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            checked={selectedApiKey?.id === key.id}
                            disabled={key.status === 'revoked'}
                            onChange={() => {}}
                            className="w-4 h-4 text-blue-600 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="border-t pt-4">
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      Create New API Key
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 mb-4">No API keys found.</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    Create Your First API Key
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Step 3: Hosted Tag */}
      {steps[2].status === 'ready' && (
        <Card title="Step 3 — Hosted Tag">
          <div className="p-6">
            <div className="flex items-start space-x-4">
              <StepIcon step={steps[2]} />
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Install Your Tag</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Copy this snippet and paste it in your website's HTML, just before the closing &lt;/head&gt; tag.
                </p>

                {/* Configuration Controls */}
                <div className="mb-6 space-y-4">
                  <div className="flex space-x-6">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={config.clicks}
                        onChange={(e) => setConfig(prev => ({ ...prev, clicks: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Click tracking</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={config.spa}
                        onChange={(e) => setConfig(prev => ({ ...prev, spa: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">SPA routing</span>
                    </label>
                  </div>

                  <div className="border-t pt-4">
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                    >
                      {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      <span className="ml-1">Advanced Settings</span>
                    </button>

                    {showAdvanced && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Batch Size (1-50)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={config.batchSize}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              batchSize: Math.max(1, Math.min(50, parseInt(e.target.value) || 10))
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Flush Interval (500-10000ms)
                          </label>
                          <input
                            type="number"
                            min="500"
                            max="10000"
                            step="100"
                            value={config.flushMs}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              flushMs: Math.max(500, Math.min(10000, parseInt(e.target.value) || 3000))
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Snippet */}
                <div className="mb-6">
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
                      <code>{generateSnippet()}</code>
                    </pre>
                    <button
                      onClick={copySnippet}
                      className="absolute top-3 right-3 p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {copiedSnippet ? <CheckCircle size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 mb-6">
                  <a
                    href="/docs/install#gtm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    <ExternalLink size={16} className="mr-2" />
                    GTM Instructions
                  </a>
                  <a
                    href={`https://api.optiview.ai/v1/tag.js?debug=1&key_id=${selectedApiKey?.id}&project_id=${project?.id}&property_id=${selectedProperty?.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <ExternalLink size={16} className="mr-2" />
                    Debug Build
                  </a>
                </div>

                {/* Verification Panel */}
                <div className="border-t pt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Installation Verification</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                        verificationStatus === 'connected' ? 'bg-green-100 text-green-800' :
                        verificationStatus === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {verificationStatus === 'connected' ? (
                          <>
                            <CheckCircle size={12} className="mr-1" />
                            Connected
                          </>
                        ) : verificationStatus === 'error' ? (
                          <>
                            <AlertTriangle size={12} className="mr-1" />
                            Error
                          </>
                        ) : (
                          <>
                            <Clock size={12} className="mr-1" />
                            Waiting for events...
                          </>
                        )}
                      </span>
                      <button
                        onClick={() => {
                          setVerificationStatus('waiting');
                          setVerificationData(null);
                          startVerification();
                        }}
                        className="p-1 text-gray-500 hover:text-gray-700"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>

                    {verificationData ? (
                      <div className="text-sm space-y-2">
                        <p><strong>Events (15m):</strong> {verificationData.events_15m}</p>
                        {verificationData.last_event_ts && (
                          <p><strong>Last Event:</strong> {new Date(verificationData.last_event_ts * 1000).toLocaleString()}</p>
                        )}
                        {Object.keys(verificationData.by_class_15m).length > 0 && (
                          <div>
                            <strong>Event Types:</strong>
                            <ul className="ml-4 mt-1">
                              {Object.entries(verificationData.by_class_15m).map(([type, count]) => (
                                <li key={type}>• {type}: {count}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">
                        Install the tag on your website, then visit a page to verify the connection.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Modals */}
      <CreateApiKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createApiKey}
        isLoading={isCreating}
      />

      {/* Toast Container */}
      <ToastContainer
        toasts={toasts}
        onRemove={removeToast}
      />
    </div>
  );
}
