import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { CheckCircle, Clock, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Eye, EyeOff, Copy } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface ApiKey {
  id: number;
  name: string;
  key_id: string;
  property_id: number;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  property_domain: string;
}

interface Property {
  id: number;
  domain: string;
  project_id: number;
}

interface VerificationData {
  property_id: number;
  events_15m: number;
  by_class_15m: {
    direct_human: number;
    human_via_ai: number;
    ai_agent_crawl: number;
    unknown_ai_like: number;
  };
  last_event_ts: string | null;
}

interface InstallVerificationBannerProps {
  properties: Property[];
  apiKeys: ApiKey[];
}

interface TroubleshootingGuideProps {
  properties: Property[];
  apiKeys: ApiKey[];
}

interface HostedTagBuilderProps {
  properties: Property[];
  apiKeys: ApiKey[];
  projectId: string;
}

// Hosted Tag Builder Component
function HostedTagBuilder({ properties, apiKeys, projectId }: HostedTagBuilderProps) {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(properties[0] || null);
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null);
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
    if (!selectedProperty || !selectedApiKey) return '';
    
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
    if (!selectedProperty || !selectedApiKey) return '';
    
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
    if (!selectedProperty || !selectedApiKey) return { pageview: '', conversion: '' };
    
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

  const copyToClipboard = async (text: string, type: 'snippet' | 'gtm') => {
    await navigator.clipboard.writeText(text);
    if (type === 'snippet') {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } else {
      setCopiedGtm(true);
      setTimeout(() => setCopiedGtm(false), 2000);
    }
  };

  if (properties.length === 0 || apiKeys.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">
          {properties.length === 0 
            ? "Create a property first to use the hosted tag builder."
            : "Create an API key first to use the hosted tag builder."}
        </p>
        <a
          href="/api-keys"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Manage API Keys →
        </a>
      </div>
    );
  }

  const snippet = generateSnippet();
  const gtmSnippet = generateGtmSnippet();
  const testCurls = generateTestCurls();

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Property
          </label>
          <select
            value={selectedProperty?.id || ''}
            onChange={(e) => setSelectedProperty(properties.find(p => p.id === parseInt(e.target.value)) || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.domain}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API Key
          </label>
          <div className="relative">
            <select
              value={selectedApiKey?.id || ''}
              onChange={(e) => setSelectedApiKey(apiKeys.find(k => k.id === parseInt(e.target.value)) || null)}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              {apiKeys.map((apiKey) => (
                <option key={apiKey.id} value={apiKey.id}>
                  {apiKey.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowKeyId(!showKeyId)}
              className="absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-600"
            >
              {showKeyId ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {showKeyId && selectedApiKey && (
            <div className="mt-1 text-xs text-gray-600 font-mono">
              Key ID: {selectedApiKey.key_id}
            </div>
          )}
        </div>
      </div>

      {/* Read-only information */}
      <div className="bg-gray-50 p-4 rounded-md">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Project ID:</span>
            <span className="ml-2 font-mono text-gray-600">{projectId}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Property ID:</span>
            <span className="ml-2 font-mono text-gray-600">{selectedProperty?.id}</span>
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-4">
        <div className="flex items-center space-x-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.clicks}
              onChange={(e) => setConfig({...config, clicks: e.target.checked})}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span className="ml-2 text-sm text-gray-700">Click tracking</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.spa}
              onChange={(e) => setConfig({...config, spa: e.target.checked})}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span className="ml-2 text-sm text-gray-700">SPA route tracking</span>
          </label>
        </div>

        {/* Advanced Settings */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span className="ml-1">Advanced Settings</span>
          </button>
          
          {showAdvanced && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch size (1-50)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={config.batchSize}
                  onChange={(e) => setConfig({...config, batchSize: Math.min(Math.max(parseInt(e.target.value) || 10, 1), 50)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flush interval (500-10000ms)
                </label>
                <input
                  type="number"
                  min="500"
                  max="10000"
                  step="100"
                  value={config.flushMs}
                  onChange={(e) => setConfig({...config, flushMs: Math.min(Math.max(parseInt(e.target.value) || 3000, 500), 10000)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Snippet Output */}
      <div className="space-y-4">
        <div>
          <h4 className="font-medium text-gray-700 mb-2">HTML Snippet</h4>
          <div className="relative">
            <div className="bg-gray-900 text-green-400 p-3 rounded-md font-mono text-sm overflow-x-auto">
              {snippet}
            </div>
            <button
              onClick={() => copyToClipboard(snippet, 'snippet')}
              className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-200 bg-gray-800 rounded"
            >
              <Copy size={16} />
            </button>
          </div>
          {copiedSnippet && (
            <div className="text-xs text-green-600 mt-1">Copied to clipboard!</div>
          )}
        </div>

        <div>
          <h4 className="font-medium text-gray-700 mb-2">Google Tag Manager</h4>
          <div className="relative">
            <div className="bg-gray-900 text-green-400 p-3 rounded-md font-mono text-sm overflow-x-auto">
              {gtmSnippet}
            </div>
            <button
              onClick={() => copyToClipboard(gtmSnippet, 'gtm')}
              className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-200 bg-gray-800 rounded"
            >
              <Copy size={16} />
            </button>
          </div>
          {copiedGtm && (
            <div className="text-xs text-green-600 mt-1">Copied to clipboard!</div>
          )}
          <div className="text-xs text-gray-600 mt-2">
            Use as Custom HTML tag; trigger on All Pages
          </div>
        </div>
      </div>

      {/* Test Calls */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="font-medium text-blue-800 mb-2">Test Calls</h4>
        <div className="space-y-3">
          <div>
            <h5 className="text-sm font-medium text-blue-700 mb-1">Pageview Test:</h5>
            <div className="bg-blue-900 text-blue-100 p-2 rounded text-xs font-mono overflow-x-auto">
              {testCurls.pageview}
            </div>
          </div>
          <div>
            <h5 className="text-sm font-medium text-blue-700 mb-1">Conversion Test:</h5>
            <div className="bg-blue-900 text-blue-100 p-2 rounded text-xs font-mono overflow-x-auto">
              {testCurls.conversion}
            </div>
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <h4 className="font-medium text-yellow-800 mb-2">Troubleshooting</h4>
        <div className="text-sm text-yellow-700 space-y-2">
          <p>• To exclude elements from click tracking, add <code className="bg-yellow-100 px-1 rounded">data-optiview="ignore"</code></p>
          <p>• Call <code className="bg-yellow-100 px-1 rounded">window.optiview.conversion({"{amount_cents: 1299, currency: 'USD', metadata: {order_id: 'A123'}"})</code> for conversions</p>
          <p>• Use <code className="bg-yellow-100 px-1 rounded">window.optiview.track('custom_event', metadata)</code> for custom events</p>
          <p>• Check browser console for errors if events aren't appearing</p>
        </div>
        <div className="mt-3">
          <a href="/docs/install" className="text-yellow-800 hover:text-yellow-900 underline text-sm">
            View full documentation →
          </a>
        </div>
      </div>
    </div>
  );
}

// Installation Verification Banner Component
function InstallVerificationBanner({ properties, apiKeys }: InstallVerificationBannerProps) {
  const { project } = useAuth();
  const [verificationData, setVerificationData] = useState<Record<number, VerificationData>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<Record<number, string>>({});
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

  async function verifyProperty(propertyId: number) {
    if (!project?.id) return;

    try {
      setLoading(prev => ({ ...prev, [propertyId]: true }));
      setError(prev => ({ ...prev, [propertyId]: "" }));

      const response = await fetch(`${API_BASE}/api/events/last-seen?project_id=${project.id}&property_id=${propertyId}`, FETCH_OPTS);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setVerificationData(prev => ({ ...prev, [propertyId]: data }));
    } catch (err) {
      setError(prev => ({ ...prev, [propertyId]: err instanceof Error ? err.message : "Verification failed" }));
    } finally {
      setLoading(prev => ({ ...prev, [propertyId]: false }));
    }
  }

  async function verifyAllProperties() {
    // Since we're not managing API keys here, verify all properties
    for (const property of properties) {
      await verifyProperty(property.id);
    }
  }

  function getVerificationStatus(propertyId: number) {
    const data = verificationData[propertyId];
    const loadingState = loading[propertyId];
    const errorState = error[propertyId];

    if (loadingState) {
      return { status: 'loading', icon: <Clock className="text-yellow-600" size={20} />, text: 'Checking...' };
    }

    if (errorState) {
      return { status: 'error', icon: <AlertTriangle className="text-red-600" size={20} />, text: 'Verification failed' };
    }

    if (!data) {
      return { status: 'waiting', icon: <Clock className="text-gray-400" size={20} />, text: 'Waiting for data...' };
    }

    if (data.events_15m > 0) {
      return { status: 'connected', icon: <CheckCircle className="text-green-600" size={20} />, text: 'Receiving data ✓' };
    }

    return { status: 'waiting', icon: <Clock className="text-gray-400" size={20} />, text: 'Waiting for data...' };
  }

  function getLastEventText(propertyId: number) {
    const data = verificationData[propertyId];
    if (!data?.last_event_ts) return null;

    const lastEvent = new Date(data.last_event_ts);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - lastEvent.getTime()) / 1000);

    if (diffSeconds < 60) {
      return `${diffSeconds} seconds ago`;
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
  }

  function formatCountdown() {
    const minutes = Math.floor(refreshCountdown / 60);
    const seconds = refreshCountdown % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  return (
    <div className="space-y-4">
      {/* Auto-refresh Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {autoRefresh ? (
            <>
              <RefreshCw className="text-blue-600 animate-spin" size={16} />
              <span className="text-sm text-blue-600">
                Auto-refreshing... {formatCountdown()} remaining
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-500">Auto-refresh stopped</span>
          )}
        </div>

        {!autoRefresh && (
          <button
            onClick={() => {
              setAutoRefresh(true);
              setRefreshCountdown(120);
              verifyAllProperties();
            }}
            className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={14} />
            <span>Recheck</span>
          </button>
        )}
      </div>

      {/* Property Verification Status */}
      <div className="space-y-3">
        {properties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No properties found. Create a property first to start tracking.</p>
          </div>
        ) : (
          properties.map(property => {
            const status = getVerificationStatus(property.id);
            const lastEventText = getLastEventText(property.id);
            const data = verificationData[property.id];

            return (
              <div key={property.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {status.icon}
                    <div>
                      <h4 className="font-medium text-gray-900">{property.domain}</h4>
                      <p className="text-sm text-gray-600">{status.text}</p>
                    </div>
                  </div>

                  {status.status === 'connected' && lastEventText && (
                    <span className="text-sm text-green-600">
                      Last event: {lastEventText}
                    </span>
                  )}
                </div>

                {status.status === 'connected' && data && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Total (15m):</span>
                      <div className="font-medium">{data.events_15m}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Direct Human:</span>
                      <div className="font-medium">{data.by_class_15m.direct_human}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Human via AI:</span>
                      <div className="font-medium">{data.by_class_15m.human_via_ai}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">AI Agent:</span>
                      <div className="font-medium">{data.by_class_15m.ai_agent_crawl}</div>
                    </div>
                  </div>
                )}

                {status.status === 'error' && (
                  <div className="text-sm text-red-600">
                    Error: {error[property.id]}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Troubleshooting Guide Component
function TroubleshootingGuide({ properties, apiKeys }: TroubleshootingGuideProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  function toggleSection(section: string) {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }

  function getTestCurl(propertyId: number) {
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

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Use this guide to troubleshoot common installation issues. Each section can be expanded for detailed information.
      </div>

      {/* Tag Presence */}
      <div className="border border-gray-200 rounded-lg">
        <button
          onClick={() => toggleSection('tag')}
          className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <CheckCircle className="text-green-600" size={16} />
            <span className="font-medium">Tag Present</span>
          </div>
          {expandedSections['tag'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expandedSections['tag'] && (
          <div className="px-4 pb-4 border-t border-gray-200">
            <div className="pt-3 space-y-3">
              <p className="text-sm text-gray-700">
                View your page source and confirm the Optiview script tag is present in the &lt;head&gt; section.
              </p>
              {properties.length > 0 ? (
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-xs font-mono text-gray-700">
                    {properties.map(property => (
                      <div key={property.id} className="mb-2">
                        <div className="text-gray-500 mb-1">{property.domain}:</div>
                        <div className="text-gray-800">
                          &lt;script async src="{API_BASE}/v1/tag.js?pid={property.id}"&gt;&lt;/script&gt;
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  Create a property first to see installation snippets.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Origin Check */}
      <div className="border border-gray-200 rounded-lg">
        <button
          onClick={() => toggleSection('origin')}
          className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <CheckCircle className="text-green-600" size={16} />
            <span className="font-medium">Origin & Domain</span>
          </div>
          {expandedSections['origin'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expandedSections['origin'] && (
          <div className="px-4 pb-4 border-t border-gray-200">
            <div className="pt-3 space-y-3">
              <p className="text-sm text-gray-700">
                Requests must originate from your registered domain(s). Ensure your site loads over HTTPS and the domain matches your property configuration.
              </p>
              {properties.length > 0 && (
                <div className="bg-blue-50 p-3 rounded-md">
                  <div className="text-sm text-blue-800">
                    <strong>Registered domains:</strong>
                    <ul className="mt-1 space-y-1">
                      {properties.map(property => (
                        <li key={property.id} className="text-blue-700">• {property.domain}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Time Sync */}
      <div className="border border-gray-200 rounded-lg">
        <button
          onClick={() => toggleSection('time')}
          className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Clock className="text-blue-600" size={16} />
            <span className="font-medium">Time Synchronization</span>
          </div>
          {expandedSections['time'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expandedSections['time'] && (
          <div className="px-4 pb-4 border-t border-gray-200">
            <div className="pt-3 space-y-3">
              <p className="text-sm text-gray-700">
                System clock skew can break HMAC signatures. This is rare but can happen on servers with incorrect time settings.
              </p>
              <div className="bg-yellow-50 p-3 rounded-md">
                <div className="text-sm text-yellow-800">
                  <strong>Check your server time:</strong>
                  <div className="mt-1 text-xs text-yellow-700">
                    date && echo "UTC: $(date -u)" && echo "Local: $(date)"
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CORS */}
      <div className="border border-gray-200 rounded-lg">
        <button
          onClick={() => toggleSection('cors')}
          className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <AlertTriangle className="text-orange-600" size={16} />
            <span className="font-medium">CORS & HTTPS</span>
          </div>
          {expandedSections['cors'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expandedSections['cors'] && (
          <div className="px-4 pb-4 border-t border-gray-200">
            <div className="pt-3 space-y-3">
              <p className="text-sm text-gray-700">
                Ensure your site loads over HTTPS and check browser console for CORS errors. Mixed content can cause issues.
              </p>
              <div className="bg-orange-50 p-3 rounded-md">
                <div className="text-sm text-orange-800">
                  <strong>Common CORS issues:</strong>
                  <ul className="mt-1 text-xs text-orange-700 space-y-1">
                    <li>• HTTP site trying to call HTTPS API</li>
                    <li>• Domain not in allowed origins list</li>
                    <li>• Missing or invalid Origin header</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* API Key */}
      <div className="border border-gray-200 rounded-lg">
        <button
          onClick={() => toggleSection('key')}
          className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <CheckCircle className="text-green-600" size={16} />
            <span className="font-medium">API Key & Secret</span>
          </div>
          {expandedSections['key'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expandedSections['key'] && (
          <div className="px-4 pb-4 border-t border-gray-200">
            <div className="pt-3 space-y-3">
              <p className="text-sm text-gray-700">
                Create and manage your API keys on the dedicated API Keys page.
              </p>
              <div className="bg-blue-50 p-3 rounded-md">
                <div className="text-sm text-blue-800">
                  <strong>Next step:</strong>
                  <a href="/api-keys" className="text-blue-600 hover:text-blue-800 underline ml-1">
                    Go to API Keys page
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Test cURL */}
      <div className="border border-gray-200 rounded-lg">
        <button
          onClick={() => toggleSection('curl')}
          className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <AlertTriangle className="text-blue-600" size={16} />
            <span className="font-medium">Test cURL Command</span>
          </div>
          {expandedSections['curl'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expandedSections['curl'] && (
          <div className="px-4 pb-4 border-t border-gray-200">
            <div className="pt-3 space-y-3">
              <p className="text-sm text-gray-700">
                Test your API key and secret with this cURL command. First create an API key on the API Keys page.
              </p>
              {properties.length > 0 ? (
                <div className="space-y-3">
                  {properties.map(property => (
                    <div key={property.id} className="bg-gray-900 text-green-400 p-3 rounded-md">
                      <div className="text-xs text-gray-400 mb-2">{property.domain}:</div>
                      <div className="text-xs text-yellow-400 mb-2">
                        ⚠️ Create an API key first to get the key_id and secret
                      </div>
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                        {getTestCurl(property.id)}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  Create a property first to see test commands.
                </div>
              )}
              <div className="bg-blue-50 p-3 rounded-md">
                <div className="text-sm text-blue-800">
                  <strong>Next step:</strong>
                  <a href="/api-keys" className="text-blue-600 hover:text-blue-800 underline">
                    Create API keys on the API Keys page
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Errors */}
      <div className="border border-gray-200 rounded-lg">
        <button
          onClick={() => toggleSection('errors')}
          className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <AlertTriangle className="text-red-600" size={16} />
            <span className="font-medium">Recent Errors (15m)</span>
          </div>
          {expandedSections['errors'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expandedSections['errors'] && (
          <div className="px-4 pb-4 border-t border-gray-200">
            <div className="pt-3 space-y-3">
              <p className="text-sm text-gray-700">
                Check for recent error patterns that might indicate configuration issues.
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm text-gray-600">
                  <strong>Error monitoring:</strong> Use the Health dashboard to view recent error patterns and identify common issues.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Install() {
  const { project } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
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
    if (!project?.id) return;

    try {
      const response = await fetch(`${API_BASE}/api/content?project_id=${project.id}`, FETCH_OPTS);
      if (response.ok) {
        const data = await response.json();
        // Extract unique properties from content
        const uniqueProperties = data.content.reduce((acc: Property[], item: any) => {
          if (item.domain && !acc.find(p => p.domain === item.domain)) {
            acc.push({ id: item.id, domain: item.domain, project_id: parseInt(project.id) });
          }
          return acc;
        }, []);
        setProperties(uniqueProperties);
      }
    } catch (error) {
      console.error("Error loading properties:", error);
    }
  }

  async function loadApiKeys() {
    if (!project?.id) return;

    try {
      const response = await fetch(`${API_BASE}/api/keys?project_id=${project.id}`, FETCH_OPTS);
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys || []);
      }
    } catch (error) {
      console.error("Error loading API keys:", error);
    } finally {
      setLoading(false);
    }
  }

  async function addProperty() {
    if (!project?.id || !newProperty.domain) return;

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
      } else {
        console.error("Failed to add property");
      }
    } catch (error) {
      console.error("Error adding property:", error);
    }
  }



  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Installation & Setup</h1>
          <p className="text-slate-600 mt-2">
            Get Optiview tracking on your {project?.name || 'project'} website with our easy installation options
          </p>
        </div>

        {/* Properties Management */}
        <Card title="Properties">
          <div className="space-y-4">
            <div className="flex gap-4">
              <input
                type="text"
                value={newProperty.domain}
                onChange={(e) => setNewProperty({ ...newProperty, domain: e.target.value })}
                placeholder="example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={addProperty}
                disabled={!newProperty.domain}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Add Property
              </button>
            </div>

            {properties.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-slate-700">Your Properties:</h4>
                {properties.map((property) => (
                  <div key={property.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <span className="font-mono text-sm">{property.domain}</span>
                    <span className="text-xs text-gray-500">ID: {property.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* API Keys Management */}
        <Card title="API Keys">
          <div className="space-y-4">
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                Create and manage your API keys on the dedicated API Keys page.
              </p>
              <a
                href="/api-keys"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Manage API Keys
              </a>
            </div>
          </div>
        </Card>

        {/* Hosted Tag Builder */}
        <Card title="Hosted Tag Builder">
          <HostedTagBuilder
            properties={properties}
            apiKeys={apiKeys}
            projectId={project?.id || ""}
          />
        </Card>

        {/* Installation Verification Banner */}
        {properties.length > 0 && (
          <Card title="Installation Status">
            <InstallVerificationBanner
              properties={properties}
              apiKeys={[]} // Pass an empty array as apiKeys is removed
            />
          </Card>
        )}

        {/* Troubleshooting Guide */}
        <Card title="Troubleshooting">
          <TroubleshootingGuide
            properties={properties}
            apiKeys={[]} // Pass an empty array as apiKeys is removed
          />
        </Card>
      </div>
    </Shell>
  );
}
