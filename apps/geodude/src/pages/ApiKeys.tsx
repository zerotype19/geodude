import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import KeyRotationModal from "../components/KeyRotationModal";
import CreateApiKeyModal from "../components/CreateApiKeyModal";
import MaskedKey from "../components/MaskedKey";
import ApiKeySuccessPanel from "../components/ApiKeySuccessPanel";
import { ToastContainer, ToastData } from "../components/Toast";
import { RotateCcw, Trash2, AlertTriangle, Clock, CheckCircle, XCircle, Plus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface ApiKey {
  id: string;
  name: string;
  status: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  grace_expires_at: string | null;
}

interface KeyWithHighlight extends ApiKey {
  isHighlighted?: boolean;
  showSuccessPanel?: boolean;
}

function getKeyStatus(key: ApiKey) {
  switch (key.status) {
    case 'active':
      return { status: 'active', text: 'Active', icon: <CheckCircle className="text-green-600" size={16} /> };
    case 'grace':
      return { status: 'grace', text: 'Grace Period', icon: <Clock className="text-yellow-600" size={16} /> };
    case 'revoked':
      return { status: 'revoked', text: 'Revoked', icon: <XCircle className="text-red-600" size={16} /> };
    default:
      return { status: 'active', text: 'Active', icon: <CheckCircle className="text-green-600" size={16} /> };
  }
}

function getGraceCountdown(key: ApiKey) {
  if (key.status !== 'grace' || !key.grace_expires_at) return null;
  
  const expiresAt = new Date(key.grace_expires_at).getTime();
  const now = Date.now();
  const timeLeft = expiresAt - now;
  
  if (timeLeft <= 0) return "Expired";
  
  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return 'Invalid Date';
  }
}

export default function ApiKeys() {
  const { project } = useAuth();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<KeyWithHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rotationModal, setRotationModal] = useState<{ isOpen: boolean; keyId: string; keyName: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const newKeyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (project?.id) {
      loadKeys();
    }
  }, [project]);

  // Toast management
  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Listen for toast events from MaskedKey component
  useEffect(() => {
    const handleToastEvent = (event: any) => {
      addToast(event.detail.message, event.detail.type);
    };

    window.addEventListener('show-toast', handleToastEvent);
    return () => window.removeEventListener('show-toast', handleToastEvent);
  }, []);

  async function loadKeys() {
    if (!project?.id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/api/keys?project_id=${project.id}`, FETCH_OPTS);
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

  const createApiKey = async (formData: { name: string; note?: string }) => {
    if (!project?.id) return;

    setIsCreating(true);
    try {
      const response = await fetch(`${API_BASE}/api/keys`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          // Combine name and note if note exists
          name: formData.note ? `${formData.name} (${formData.note})` : formData.name
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const newKey = await response.json();
      
      // Close modal
      setShowCreateModal(false);
      
      // Add new key to the top of the list with highlight and success panel
      setKeys(prev => [{
        ...newKey,
        isHighlighted: true,
        showSuccessPanel: true
      }, ...prev.map(k => ({ ...k, isHighlighted: false, showSuccessPanel: false }))]);

      // Show success toast
      addToast('API Key created. Click "Reveal" to view the Key ID.', 'success');

      // Scroll to new key after a brief delay
      setTimeout(() => {
        newKeyRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);

      // Remove highlight after 3 seconds
      setTimeout(() => {
        setKeys(prev => prev.map(k => ({ 
          ...k, 
          isHighlighted: false 
        })));
      }, 3000);

      // Remove success panel after 10 seconds
      setTimeout(() => {
        setKeys(prev => prev.map(k => ({ 
          ...k, 
          showSuccessPanel: false 
        })));
      }, 10000);

    } catch (error) {
      console.error("Error creating API key:", error);
      throw error; // Re-throw so modal can show error
    } finally {
      setIsCreating(false);
    }
  };

  const handleGoToInstall = (keyId: string) => {
    const params = new URLSearchParams({
      key_id: keyId,
      project_id: project?.id || ''
    });
    navigate(`/install?${params.toString()}`);
  };

  async function handleRotate(keyId: string, immediate: boolean) {
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

  async function handleRevoke(keyId: string) {
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
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
            <p className="mt-2 text-gray-600">
              Manage your API keys for data ingestion
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <Plus size={20} />
            <span>New API Key</span>
          </button>
        </div>

        {keys.length === 0 ? (
          <Card title="No API Keys">
            <div className="text-center py-8">
              <p className="text-gray-500 mb-6">No API keys found. Create your first key to start collecting data.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <Plus size={20} />
                <span>Create Your First API Key</span>
              </button>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {keys.map((key, index) => {
              const status = getKeyStatus(key);
              const graceCountdown = getGraceCountdown(key);
              const isFirstKey = index === 0;

              return (
                <div 
                  key={key.id}
                  ref={isFirstKey && key.isHighlighted ? newKeyRef : null}
                  className={`transition-all duration-500 ${
                    key.isHighlighted ? 'ring-2 ring-blue-400 ring-opacity-75 shadow-lg' : ''
                  }`}
                >
                  <Card title={key.name}>
                    {/* Success Panel */}
                    {key.showSuccessPanel && (
                      <div className="p-4 border-b">
                        <ApiKeySuccessPanel
                          keyId={key.id}
                          keyName={key.name}
                          projectId={project?.id || ''}
                          onGoToInstall={() => handleGoToInstall(key.id)}
                        />
                      </div>
                    )}

                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Key ID</p>
                          <MaskedKey value={key.id} className="mt-1" />
                        </div>

                      <div>
                        <p className="text-sm font-medium text-gray-500">Status</p>
                        <div className="flex items-center space-x-2">
                          {status.icon}
                          <span className={`text-sm ${status.status === 'active' ? 'text-green-600' :
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
                    <div className="flex flex-wrap gap-3">
                      {/* Go to Install - always available */}
                      <button
                        onClick={() => handleGoToInstall(key.id)}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-1M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span>Go to Install</span>
                      </button>

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
              </div>
              );
            })}
          </div>
        )}

        {/* Create API Key Modal */}
        <CreateApiKeyModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={createApiKey}
          isLoading={isCreating}
        />

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



        {/* Toast Container */}
        <ToastContainer
          toasts={toasts}
          onRemove={removeToast}
        />
      </div>
    </Shell>
  );
}
