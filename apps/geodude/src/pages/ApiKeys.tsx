import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE, FETCH_OPTS } from '../config';
import Shell from '../components/Shell';
import { Plus, Copy, Trash2, RefreshCw, Key, Calendar, Activity, AlertTriangle } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  status: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  grace_expires_at: string | null;
}

const ApiKeys: React.FC = () => {
  const { user, project } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (project?.id) {
      fetchApiKeys();
    }
  }, [project?.id]);

  const fetchApiKeys = async () => {
    if (!project?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/keys?project_id=${project.id}`, FETCH_OPTS);
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys || []);
      } else {
        console.error('Failed to fetch API keys');
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!project?.id || !newKeyName.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch(`${API_BASE}/api/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...FETCH_OPTS,
        body: JSON.stringify({
          project_id: project.id,
          name: newKeyName.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setApiKeys(prev => [data.key, ...prev]);
        setNewKeyName('');
        setShowCreateModal(false);
      } else {
        const errorData = await response.json();
        console.error('Failed to create API key:', errorData.message);
      }
    } catch (error) {
      console.error('Error creating API key:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const revokeApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/keys/${keyId}/revoke`, {
        method: 'POST',
        ...FETCH_OPTS
      });

      if (response.ok) {
        setApiKeys(prev => prev.map(key => 
          key.id === keyId 
            ? { ...key, status: 'revoked', revoked_at: new Date().toISOString() }
            : key
        ));
      } else {
        console.error('Failed to revoke API key');
      }
    } catch (error) {
      console.error('Error revoking API key:', error);
    }
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(keyId);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'revoked': return 'bg-red-100 text-red-800 border-red-200';
      case 'expired': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'revoked': return 'Revoked';
      case 'expired': return 'Expired';
      default: return status;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Please sign in to view API keys</h1>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
              <p className="mt-2 text-gray-600">
                Manage API keys for your project
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchApiKeys}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create API Key
              </button>
            </div>
          </div>
        </div>

        {/* API Keys List */}
        <Card>
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading API keys...</p>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8">
                <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No API keys found</h3>
                <p className="text-gray-600 mb-4">Create your first API key to start tracking events.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create API Key
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <Key className="h-5 w-5 text-gray-400" />
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">{apiKey.name}</h3>
                            <p className="text-sm text-gray-500 font-mono">{apiKey.id}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(apiKey.status)}`}>
                          {getStatusLabel(apiKey.status)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(apiKey.id, apiKey.id)}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          {copied === apiKey.id ? (
                            <span className="text-green-600">Copied!</span>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-1" />
                              Copy
                            </>
                          )}
                        </button>
                        {apiKey.status === 'active' && (
                          <button
                            onClick={() => revokeApiKey(apiKey.id)}
                            className="inline-flex items-center px-3 py-1 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>Created: {new Date(apiKey.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center">
                        <Activity className="h-4 w-4 mr-2" />
                        <span>
                          Last used: {apiKey.last_used_at 
                            ? new Date(apiKey.last_used_at).toLocaleDateString()
                            : 'Never'
                          }
                        </span>
                      </div>
                      {apiKey.grace_expires_at && (
                        <div className="flex items-center">
                          <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                          <span>
                            Grace expires: {new Date(apiKey.grace_expires_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Create API Key Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create New API Key</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., Production API Key"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>• Choose a descriptive name for this API key</p>
                    <p>• You can revoke keys at any time</p>
                    <p>• Keep your API keys secure and never share them publicly</p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createApiKey}
                      disabled={isCreating || !newKeyName.trim()}
                      className="flex-1 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreating ? 'Creating...' : 'Create Key'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
};

export default ApiKeys;