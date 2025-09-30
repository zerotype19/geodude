import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE, FETCH_OPTS } from '../config';
import Shell from '../components/Shell';
import { CheckCircle, Copy, ExternalLink, RefreshCw, AlertTriangle, Eye, EyeOff } from 'lucide-react';

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

interface VerificationData {
  events_15m: number;
  by_class_15m: { [key: string]: number };
  last_event_ts: number | null;
  last_event_type: string | null;
}

const Install: React.FC = () => {
  const { user, project } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'waiting' | 'connected' | 'error'>('waiting');
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (project?.id) {
      loadData();
    }
  }, [project?.id]);

  useEffect(() => {
    if (selectedProperty && selectedApiKey) {
      startVerification();
    }
  }, [selectedProperty, selectedApiKey]);

  const loadData = async () => {
    if (!project?.id) return;

    setLoading(true);
    try {
      await Promise.all([
        fetchProperties(),
        fetchApiKeys()
      ]);
    } catch (error) {
      console.error('Error loading install data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    if (!project?.id) return;

    try {
      const response = await fetch(`${API_BASE}/api/properties?project_id=${project.id}`, FETCH_OPTS);
      if (response.ok) {
        const data = await response.json();
        setProperties(data.properties || []);
        if (data.properties && data.properties.length > 0) {
          setSelectedProperty(data.properties[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchApiKeys = async () => {
    if (!project?.id) return;

    try {
      const response = await fetch(`${API_BASE}/api/keys?project_id=${project.id}`, FETCH_OPTS);
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys || []);
        if (data.keys && data.keys.length > 0) {
          setSelectedApiKey(data.keys[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  const startVerification = () => {
    if (!selectedProperty || !selectedApiKey) return;

    setVerificationStatus('waiting');
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/events/last-seen?project_id=${project?.id}&property_id=${selectedProperty.id}`, FETCH_OPTS);
        if (response.ok) {
          const data = await response.json();
          setVerificationData(data);
          if (data.events_15m > 0) {
            setVerificationStatus('connected');
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error('Verification error:', error);
        setVerificationStatus('error');
        clearInterval(interval);
      }
    }, 5000);

    // Clear interval after 2 minutes
    setTimeout(() => {
      clearInterval(interval);
      if (verificationStatus === 'waiting') {
        setVerificationStatus('error');
      }
    }, 120000);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const generateSnippet = () => {
    if (!selectedApiKey || !selectedProperty) return '';

    return `<!-- Optiview Analytics -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${API_BASE}/v1/tag.js';
    script.async = true;
    script.setAttribute('data-key', '${selectedApiKey.id}');
    script.setAttribute('data-property', '${selectedProperty.id}');
    document.head.appendChild(script);
  })();
</script>
<!-- End Optiview Analytics -->`;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Please sign in to view install instructions</h1>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Please select a project first</h1>
        </div>
      </div>
    );
  }

  return (
    <Shell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Install Optiview</h1>
          <p className="mt-2 text-gray-600">
            Add Optiview to your website to start tracking AI traffic and interactions
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading install data...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Step 1: Select Property and API Key */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 1: Select Property and API Key</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Property Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Property (Domain)</label>
                    <select
                      value={selectedProperty?.id || ''}
                      onChange={(e) => {
                        const property = properties.find(p => p.id === parseInt(e.target.value));
                        setSelectedProperty(property || null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a property</option>
                      {properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.domain}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* API Key Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                    <select
                      value={selectedApiKey?.id || ''}
                      onChange={(e) => {
                        const apiKey = apiKeys.find(k => k.id === e.target.value);
                        setSelectedApiKey(apiKey || null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select an API key</option>
                      {apiKeys.map((apiKey) => (
                        <option key={apiKey.id} value={apiKey.id}>
                          {apiKey.name} ({apiKey.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {properties.length === 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex">
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">No properties found</h3>
                        <p className="mt-1 text-sm text-yellow-700">
                          You need to create a property first. Go to Settings to add a property.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {apiKeys.length === 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex">
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">No API keys found</h3>
                        <p className="mt-1 text-sm text-yellow-700">
                          You need to create an API key first. Go to API Keys to create one.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Step 2: Install Code */}
            {selectedProperty && selectedApiKey && (
              <Card>
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 2: Install the Tracking Code</h2>
                  
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Add this code to the <code className="bg-gray-100 px-1 py-0.5 rounded">&lt;head&gt;</code> section of your website:
                    </p>
                    
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{generateSnippet()}</code>
                      </pre>
                      <button
                        onClick={() => copyToClipboard(generateSnippet())}
                        className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
                      >
                        {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>

                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                      >
                        {showKey ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                        {showKey ? 'Hide' : 'Show'} API Key
                      </button>
                      <span className="text-sm text-gray-500">
                        Key: {showKey ? selectedApiKey.id : `${selectedApiKey.id.substring(0, 8)}...`}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Step 3: Verification */}
            {selectedProperty && selectedApiKey && (
              <Card>
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 3: Verify Installation</h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      {verificationStatus === 'waiting' && (
                        <>
                          <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                          <span className="text-sm text-gray-600">Waiting for events...</span>
                        </>
                      )}
                      {verificationStatus === 'connected' && (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="text-sm text-green-600">Installation verified! Events are being received.</span>
                        </>
                      )}
                      {verificationStatus === 'error' && (
                        <>
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          <span className="text-sm text-red-600">No events received. Please check your installation.</span>
                        </>
                      )}
                    </div>

                    {verificationData && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-900 mb-2">Live Data</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Events (15m):</span>
                            <span className="ml-2 font-medium">{verificationData.events_15m}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Event:</span>
                            <span className="ml-2 font-medium">
                              {verificationData.last_event_ts 
                                ? new Date(verificationData.last_event_ts * 1000).toLocaleTimeString()
                                : 'Never'
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="text-sm text-gray-600">
                      <p>• Make sure the code is added to every page of your website</p>
                      <p>• Visit your website and navigate between pages</p>
                      <p>• Events should appear here within a few minutes</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Help Section */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Need Help?</h2>
                <div className="space-y-3 text-sm text-gray-600">
                  <p>• <strong>No events showing?</strong> Check that the script is in the &lt;head&gt; section and your API key is correct</p>
                  <p>• <strong>Single Page App?</strong> The script automatically tracks route changes</p>
                  <p>• <strong>Still having issues?</strong> Check the browser console for any JavaScript errors</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Shell>
  );
};

export default Install;