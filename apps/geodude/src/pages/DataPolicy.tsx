import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { Shield, Database, Clock, AlertTriangle, Trash2, Edit3, Save, X } from "lucide-react";

interface ProjectSettings {
  project_id: number;
  retention_days_events: number;
  retention_days_referrals: number;
  plan_tier: string;
  xray_trace_enabled: number;
}

interface PurgeResult {
  project_id: number;
  type: string;
  dry_run: boolean;
  deleted_events: number;
  deleted_referrals: number;
  message: string;
}

export default function DataPolicy() {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ events: number; referrals: number }>({ events: 0, referrals: 0 });
  const [purgeModal, setPurgeModal] = useState<{ isOpen: boolean; type: string; dryRun: boolean } | null>(null);
  const [purgeResult, setPurgeResult] = useState<PurgeResult | null>(null);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      setError(null);
      
      // For now, we'll use a placeholder project ID
      // In a real app, this would come from the user's session
      const projectId = 1;
      
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/settings`, FETCH_OPTS);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSettings(data);
      setEditForm({
        events: data.retention_days_events,
        referrals: data.retention_days_referrals
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!settings) return;

    try {
      const response = await fetch(`${API_BASE}/api/projects/${settings.project_id}/settings`, {
        ...FETCH_OPTS,
        method: 'PUT',
        body: JSON.stringify({
          retention_days_events: editForm.events,
          retention_days_referrals: editForm.referrals
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Reload settings
      await loadSettings();
      setEditing(false);
    } catch (err) {
      console.error("Failed to save settings:", err);
      // Could show error toast here
    }
  }

  async function handlePurge() {
    if (!settings || !purgeModal) return;

    try {
      setPurging(true);
      
      const response = await fetch(`${API_BASE}/admin/purge`, {
        ...FETCH_OPTS,
        method: 'POST',
        body: JSON.stringify({
          project_id: settings.project_id,
          type: purgeModal.type,
          confirm: "DELETE",
          dry_run: purgeModal.dryRun
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setPurgeResult(result);
      
      if (!purgeModal.dryRun) {
        // Reload settings after actual purge
        await loadSettings();
      }
    } catch (err) {
      console.error("Purge failed:", err);
      // Could show error toast here
    } finally {
      setPurging(false);
    }
  }

  function getPlanTierInfo(tier: string) {
    switch (tier) {
      case 'free':
        return { name: 'Free', color: 'text-gray-600', bgColor: 'bg-gray-100' };
      case 'pro':
        return { name: 'Pro', color: 'text-blue-600', bgColor: 'bg-blue-100' };
      case 'enterprise':
        return { name: 'Enterprise', color: 'text-purple-600', bgColor: 'bg-purple-100' };
      default:
        return { name: tier, color: 'text-gray-600', bgColor: 'bg-gray-100' };
    }
  }

  function getDefaultRetention(tier: string) {
    switch (tier) {
      case 'free':
        return { events: 180, referrals: 365 };
      case 'pro':
        return { events: 365, referrals: 730 };
      case 'enterprise':
        return { events: 730, referrals: 1460 };
      default:
        return { events: 180, referrals: 365 };
    }
  }

  function canEditRetention(tier: string) {
    return tier === 'enterprise';
  }

  function validateRetention(events: number, referrals: number) {
    const errors: string[] = [];
    
    if (events < 7 || events > 3650) {
      errors.push("Events retention must be between 7 and 3650 days");
    }
    
    if (referrals < 30 || referrals > 3650) {
      errors.push("Referrals retention must be between 30 and 3650 days");
    }
    
    return errors;
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-lg">Loading data policy...</div>
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

  if (!settings) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-lg">No project settings found</div>
        </div>
      </Shell>
    );
  }

  const planInfo = getPlanTierInfo(settings.plan_tier);
  const defaultRetention = getDefaultRetention(settings.plan_tier);
  const canEdit = canEditRetention(settings.plan_tier);
  const validationErrors = validateRetention(editForm.events, editForm.referrals);

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Data Policy</h1>
          <p className="mt-2 text-gray-600">
            Manage your data retention policies and storage settings
          </p>
        </div>

        {/* Plan Tier Card */}
        <div className="mb-6">
          <Card title="Current Plan">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${planInfo.bgColor}`}>
                    <Shield className={`h-6 w-6 ${planInfo.color}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{planInfo.name} Plan</h3>
                    <p className="text-sm text-gray-500">
                      {canEdit ? "Customizable retention policies" : "Standard retention policies"}
                    </p>
                  </div>
                </div>
                
                {canEdit && (
                  <button
                    onClick={() => setEditing(!editing)}
                    className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {editing ? <X size={16} /> : <Edit3 size={16} />}
                    <span>{editing ? "Cancel" : "Edit"}</span>
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Retention Settings */}
        <div className="mb-6">
          <Card title="Data Retention Policies">
            <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Events Retention */}
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <Database className="h-5 w-5 text-blue-600" />
                  <h4 className="text-lg font-medium text-gray-900">Interaction Events</h4>
                </div>
                
                {editing && canEdit ? (
                  <div>
                    <input
                      type="number"
                      min="7"
                      max="3650"
                      value={editForm.events}
                      onChange={(e) => setEditForm(prev => ({ ...prev, events: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Days to retain event data (7-3650)
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {settings.retention_days_events} days
                    </div>
                    <p className="text-sm text-gray-500">
                      {settings.retention_days_events === defaultRetention.events 
                        ? "Default for your plan" 
                        : "Custom setting"
                      }
                    </p>
                  </div>
                )}
              </div>

              {/* Referrals Retention */}
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <Clock className="h-5 w-5 text-green-600" />
                  <h4 className="text-lg font-medium text-gray-900">AI Referrals</h4>
                </div>
                
                {editing && canEdit ? (
                  <div>
                    <input
                      type="number"
                      min="30"
                      max="3650"
                      value={editForm.referrals}
                      onChange={(e) => setEditForm(prev => ({ ...prev, referrals: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Days to retain referral data (30-3650)
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {settings.retention_days_referrals} days
                    </div>
                    <p className="text-sm text-gray-500">
                      {settings.retention_days_referrals === defaultRetention.referrals 
                        ? "Default for your plan" 
                        : "Custom setting"
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Validation Errors */}
            {editing && validationErrors.length > 0 && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-start">
                  <AlertTriangle className="text-red-600 mt-0.5 mr-2 flex-shrink-0" size={16} />
                  <div className="text-sm text-red-800">
                    <p className="font-medium mb-1">Please fix the following errors:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            {editing && canEdit && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={validationErrors.length > 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save size={16} className="inline mr-2" />
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </Card>
        </div>

        {/* Data Management */}
        <div className="mb-6">
          <Card title="Data Management">
            <div className="p-6">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <div className="flex items-start">
                <AlertTriangle className="text-blue-600 mt-0.5 mr-2 flex-shrink-0" size={16} />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">About Data Retention</p>
                  <p>
                    Retention applies to raw event rows. Aggregated metrics are recomputed on the fly 
                    and are not affected by retention policies. Data is automatically purged daily at 03:10 UTC.
                  </p>
                </div>
              </div>
            </div>

            {/* Manual Purge Options */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900">Manual Data Purge</h4>
              <p className="text-sm text-gray-600">
                Use these options to manually purge data or preview what would be deleted.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setPurgeModal({ isOpen: true, type: "events", dryRun: true })}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Preview Events Purge
                </button>
                
                <button
                  onClick={() => setPurgeModal({ isOpen: true, type: "referrals", dryRun: true })}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Preview Referrals Purge
                </button>
                
                <button
                  onClick={() => setPurgeModal({ isOpen: true, type: "both", dryRun: true })}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Preview All Purge
                </button>
              </div>
            </div>
          </div>
        </Card>
        </div>

        {/* Purge Modal */}
        {purgeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {purgeModal.dryRun ? "Preview Data Purge" : "Confirm Data Purge"}
                </h3>
                
                <p className="text-sm text-gray-600 mb-6">
                  {purgeModal.dryRun 
                    ? `This will show you how many ${purgeModal.type === "both" ? "events and referrals" : purgeModal.type} would be deleted based on your current retention policy.`
                    : `This will permanently delete ${purgeModal.type === "both" ? "all expired events and referrals" : `expired ${purgeModal.type}`} based on your retention policy. This action cannot be undone.`
                  }
                </p>

                {purgeResult && (
                  <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
                    <h4 className="font-medium text-gray-900 mb-2">Purge Results:</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Events to be deleted: {purgeResult.deleted_events}</p>
                      <p>Referrals to be deleted: {purgeResult.deleted_referrals}</p>
                      <p className="font-medium">{purgeResult.message}</p>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setPurgeModal(null);
                      setPurgeResult(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  
                  {!purgeResult && (
                    <button
                      onClick={handlePurge}
                      disabled={purging}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {purging ? "Processing..." : purgeModal.dryRun ? "Preview" : "Purge Data"}
                    </button>
                  )}
                  
                  {purgeResult && !purgeModal.dryRun && (
                    <button
                      onClick={() => {
                        setPurgeModal(null);
                        setPurgeResult(null);
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
