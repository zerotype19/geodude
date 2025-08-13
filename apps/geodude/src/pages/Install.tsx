import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";

interface ApiKey {
  id: number;
  name: string;
  key_id: string;
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

export default function Install() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
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
        const uniqueProperties = data.content.reduce((acc: Property[], item: any) => {
          if (item.domain && !acc.find(p => p.domain === item.domain)) {
            acc.push({ id: item.id, domain: item.domain, project_id: 1 });
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
    try {
      const response = await fetch(`${API_BASE}/api/keys?project_id=1`, FETCH_OPTS);
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

  async function createApiKey() {
    if (!newKey.project_id || !newKey.property_id || !newKey.name) return;
    
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
      } else {
        console.error("Failed to create API key");
      }
    } catch (error) {
      console.error("Error creating API key:", error);
    }
  }

  async function revokeApiKey(keyId: string) {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/keys/${keyId}/revoke`, {
        method: "POST",
        credentials: "include"
      });
      
      if (response.ok) {
        await loadApiKeys();
      } else {
        console.error("Failed to revoke API key");
      }
    } catch (error) {
      console.error("Error revoking API key:", error);
    }
  }

  async function addProperty() {
    if (!newProperty.project_id || !newProperty.domain) return;
    
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
      } else {
        console.error("Failed to add property");
      }
    } catch (error) {
      console.error("Error adding property:", error);
    }
  }

  function getInstallationSnippet(propertyId: string, keyId: string) {
    return `<script async src="https://app.optiview.io/v1/tag.js?pid=${propertyId}&kid=${keyId}"></script>`;
  }

  function getGtmTemplate(propertyId: string, keyId: string) {
    return `{
  "name": "Optiview Analytics",
  "type": "html",
  "code": "<script async src=\\"https://app.optiview.io/v1/tag.js?pid=${propertyId}&kid=${keyId}\\"></script>"
}`;
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Installation & Setup</h1>
          <p className="text-slate-600 mt-2">Get Optiview tracking on your website with our easy installation options</p>
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
            <div className="grid md:grid-cols-3 gap-4">
              <select
                value={newKey.property_id}
                onChange={(e) => setNewKey({ ...newKey, property_id: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.domain}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newKey.name}
                onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                placeholder="Key name (e.g., Production)"
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={createApiKey}
                disabled={!newKey.property_id || !newKey.name}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Create API Key
              </button>
            </div>
            
            {loading ? (
              <div className="text-center py-4 text-gray-500">Loading API keys...</div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No API keys found. Create your first key above.</div>
            ) : (
              <div className="space-y-3">
                <h4 className="font-medium text-slate-700">Your API Keys:</h4>
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{key.name}</span>
                        {key.revoked_at && (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Revoked</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-mono">{key.key_id}</span> • {key.property_domain}
                      </div>
                      <div className="text-xs text-gray-500">
                        Created: {new Date(key.created_at).toLocaleDateString()}
                        {key.last_used_at && ` • Last used: ${new Date(key.last_used_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    {!key.revoked_at && (
                      <button
                        onClick={() => revokeApiKey(key.key_id)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Installation Instructions */}
        <Card title="Installation Instructions">
          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-slate-700 mb-2">1. JavaScript Tag (Recommended)</h4>
              <p className="text-sm text-gray-600 mb-3">
                Add this script tag to your website's &lt;head&gt; section. It will automatically track page views and AI traffic.
              </p>
              {properties.length > 0 && apiKeys.length > 0 ? (
                <div className="space-y-3">
                  {properties.map((property) => {
                    const key = apiKeys.find(k => k.property_id === property.id && !k.revoked_at);
                    if (!key) return null;
                    
                    return (
                      <div key={property.id} className="space-y-2">
                        <div className="text-sm font-medium text-slate-600">{property.domain}:</div>
                        <div className="bg-gray-900 text-green-400 p-3 rounded-md font-mono text-sm overflow-x-auto">
                          {getInstallationSnippet(property.id.toString(), key.key_id)}
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(getInstallationSnippet(property.id.toString(), key.key_id))}
                          className="text-xs text-blue-600 hover:text-blue-800 focus:outline-none"
                        >
                          Copy to clipboard
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  Create a property and API key first to see installation snippets.
                </div>
              )}
            </div>

            <div>
              <h4 className="font-medium text-slate-700 mb-2">2. Google Tag Manager</h4>
              <p className="text-sm text-gray-600 mb-3">
                If you use GTM, create a new HTML tag with this template:
              </p>
              {properties.length > 0 && apiKeys.length > 0 ? (
                <div className="space-y-3">
                  {properties.map((property) => {
                    const key = apiKeys.find(k => k.property_id === property.id && !k.revoked_at);
                    if (!key) return null;
                    
                    return (
                      <div key={property.id} className="space-y-2">
                        <div className="text-sm font-medium text-slate-600">{property.domain}:</div>
                        <div className="bg-gray-900 text-green-400 p-3 rounded-md font-mono text-sm overflow-x-auto">
                          {getGtmTemplate(property.id.toString(), key.key_id)}
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(getGtmTemplate(property.id.toString(), key.key_id))}
                          className="text-xs text-blue-600 hover:text-blue-800 focus:outline-none"
                        >
                          Copy to clipboard
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  Create a property and API key first to see GTM templates.
                </div>
              )}
            </div>

            <div>
              <h4 className="font-medium text-slate-700 mb-2">3. Cloudflare Worker (Advanced)</h4>
              <p className="text-sm text-gray-600 mb-3">
                For high-traffic sites, deploy our worker template on your own zone for edge-level classification.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="text-sm text-blue-800">
                  <strong>Download:</strong> <a 
                    href="/examples/customer-worker.js" 
                    download
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    customer-worker.js
                  </a>
                </div>
                <div className="text-xs text-blue-700 mt-2">
                  Deploy this to your Cloudflare zone and set environment variables for your Optiview credentials.
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-slate-700 mb-2">4. Verify Installation</h4>
              <p className="text-sm text-gray-600 mb-3">
                After installing, visit your website and check the Optiview dashboard for incoming events.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="text-sm text-green-800">
                  <strong>Success indicators:</strong>
                </div>
                <ul className="text-xs text-green-700 mt-2 space-y-1">
                  <li>• Page views appear in your Events dashboard</li>
                  <li>• AI traffic is classified automatically</li>
                  <li>• No console errors in browser dev tools</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
