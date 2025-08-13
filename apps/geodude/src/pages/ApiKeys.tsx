import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import KeyRotationModal from "../components/KeyRotationModal";
import { RotateCcw, Trash2, AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";

interface ApiKey {
  id: number;
  key_id: string;
  name: string;
  property_id: number;
  project_id: number;
  domain: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  grace_secret_hash: string | null;
  grace_expires_at: string | null;
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rotationModal, setRotationModal] = useState<{ isOpen: boolean; keyId: number; keyName: string } | null>(null);
  const [newKey, setNewKey] = useState({ domain: "", name: "" });

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
      setKeys(data.keys || []); // Extract the keys array from the response
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }

  async function createApiKey() {
    if (!newKey.domain || !newKey.name) return;
    
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE}/api/keys`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: 1, // Default project ID for now
          property_id: 1, // Default property ID for now
          name: newKey.name,
          domain: newKey.domain
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`API Key created! Key ID: ${data.key_id}\nSecret: ${data.secret_once}\n\n⚠️ Store this secret securely - it won't be shown again!`);
        setNewKey({ domain: "", name: "" });
        await loadKeys();
      } else {
        console.error("Failed to create API key");
      }
    } catch (error) {
      console.error("Error creating API key:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRotate(keyId: number, immediate: boolean) {
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
    } catch (err) {
      console.error("Rotation failed:", err);
      // Could show error toast here
    }
  }

  async function handleRevoke(keyId: number) {
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
    } catch (err) {
      console.error("Revocation failed:", err);
      // Could show error toast here
    }
  }

  function getKeyStatus(key: ApiKey) {
    if (key.revoked_at) {
      return { status: 'revoked', icon: <XCircle className="text-red-600" size={16} />, text: 'Revoked' };
    }
    
    if (key.grace_secret_hash && key.grace_expires_at) {
      const expiry = new Date(key.grace_expires_at);
      const now = new Date();
      if (now < expiry) {
        return { status: 'grace', icon: <Clock className="text-yellow-600" size={16} />, text: 'Grace Period' };
      }
    }
    
    return { status: 'active', icon: <CheckCircle className="text-green-600" size={16} />, text: 'Active' };
  }

  function getGraceCountdown(key: ApiKey) {
    if (!key.grace_expires_at) return null;
    
    const expiry = new Date(key.grace_expires_at);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    
    if (diffMs <= 0) return null;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-lg">Loading API keys...</div>
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-red-600 text-lg">{error}</div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
          <p className="mt-2 text-gray-600">
            Manage your API keys for data ingestion
          </p>
        </div>

        {keys.length === 0 ? (
          <Card title="No API Keys">
            <div className="text-center py-8">
              <p className="text-gray-500 mb-6">No API keys found. Create your first key to start collecting data.</p>
              
              {/* Create API Key Form */}
              <div className="max-w-md mx-auto">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="property-domain" className="block text-sm font-medium text-gray-700 mb-1">
                      Property Domain
                    </label>
                    <input
                      id="property-domain"
                      type="text"
                      placeholder="example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newKey.domain || ""}
                      onChange={(e) => setNewKey({ ...newKey, domain: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="key-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Key Name
                    </label>
                    <input
                      id="key-name"
                      type="text"
                      placeholder="Production Key"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newKey.name || ""}
                      onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                    />
                  </div>
                  
                  <button
                    onClick={createApiKey}
                    disabled={!newKey.domain || !newKey.name}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  >
                    Create API Key
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {keys.map((key) => {
              const status = getKeyStatus(key);
              const graceCountdown = getGraceCountdown(key);
              
              return (
                <Card key={key.id} title={`${key.name} (${key.domain})`}>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Key ID</p>
                        <p className="text-sm text-gray-900 font-mono">{key.key_id}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-gray-500">Status</p>
                        <div className="flex items-center space-x-2">
                          {status.icon}
                          <span className={`text-sm ${
                            status.status === 'active' ? 'text-green-600' :
                            status.status === 'grace' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {status.text}
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-gray-500">Created</p>
                        <p className="text-sm text-gray-900">{formatDate(key.created_at)}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-gray-500">Last Used</p>
                        <p className="text-sm text-gray-900">
                          {key.last_used_at ? formatDate(key.last_used_at) : 'Never'}
                        </p>
                      </div>
                    </div>

                    {/* Grace Period Warning */}
                    {status.status === 'grace' && graceCountdown && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                        <div className="flex items-start">
                          <AlertTriangle className="text-yellow-600 mt-0.5 mr-2 flex-shrink-0" size={16} />
                          <div className="text-sm text-yellow-800">
                            <p className="font-medium mb-1">Grace Period Active</p>
                            <p className="mb-2">
                              This key is using a grace period. The old secret will expire in: <strong>{graceCountdown}</strong>
                            </p>
                            <p>
                              Update your implementation with the new secret before the grace period expires.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                      {status.status !== 'revoked' && (
                        <button
                          onClick={() => setRotationModal({ isOpen: true, keyId: key.id, keyName: key.name })}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                          <RotateCcw size={16} />
                          <span>Rotate</span>
                        </button>
                      )}
                      
                      {status.status !== 'revoked' && (
                        <button
                          onClick={() => handleRevoke(key.id)}
                          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                        >
                          <Trash2 size={16} />
                          <span>Revoke</span>
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Rotation Modal */}
        {rotationModal && (
          <KeyRotationModal
            isOpen={rotationModal.isOpen}
            onClose={() => setRotationModal(null)}
            keyId={rotationModal.keyId}
            keyName={rotationModal.keyName}
            onRotate={handleRotate}
          />
        )}
      </div>
    </Shell>
  );
}
