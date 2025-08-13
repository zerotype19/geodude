import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import { useAuth } from "../useAuth";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";

interface KvMapping {
  pid: string;
  url: string;
}

export default function Admin() {
  const { me } = useAuth();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [tokenData, setTokenData] = useState({
    adminToken: "",
    src: "chatgpt",
    model: "",
    pid: "",
    geo: "",
    ttl: "60"
  });

  const [generatedToken, setGeneratedToken] = useState("");
  
  // KV Management state
  const [kvMappings, setKvMappings] = useState<KvMapping[]>([]);
  const [showKvInterface, setShowKvInterface] = useState(false);
  const [newMapping, setNewMapping] = useState({ pid: "", url: "" });
  const [editingMapping, setEditingMapping] = useState<KvMapping | null>(null);
  const [loading, setLoading] = useState(false);

  // Load KV mappings
  async function loadKvMappings() {
    if (!me?.current?.org_id || !me?.current?.project_id) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/admin/kv?org_id=${me.current.org_id}&project_id=${me.current.project_id}`,
        FETCH_OPTS
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log("KV API response:", data); // Debug logging
        // API returns { items: [...] } not { mappings: [...] }
        setKvMappings(data.items || []);
      } else {
        console.error("Failed to load KV mappings:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("Error loading KV mappings:", error);
    } finally {
      setLoading(false);
    }
  }

  // Add new KV mapping
  async function addKvMapping() {
    if (!newMapping.pid || !newMapping.url) return;
    if (!me?.current?.org_id || !me?.current?.project_id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/kv`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid: newMapping.pid,
          url: newMapping.url,
          org_id: me.current.org_id,
          project_id: me.current.project_id
        })
      });
      
      if (response.ok) {
        setNewMapping({ pid: "", url: "" });
        await loadKvMappings();
      } else {
        console.error("Failed to add KV mapping");
      }
    } catch (error) {
      console.error("Error adding KV mapping:", error);
    } finally {
      setLoading(false);
    }
  }

  // Update KV mapping
  async function updateKvMapping() {
    if (!editingMapping) return;
    if (!me?.current?.org_id || !me?.current?.project_id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/kv`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid: editingMapping.pid,
          url: editingMapping.url,
          org_id: me.current.org_id,
          project_id: me.current.project_id
        })
      });
      
      if (response.ok) {
        setEditingMapping(null);
        await loadKvMappings();
      } else {
        console.error("Failed to update KV mapping");
      }
    } catch (error) {
      console.error("Error updating KV mapping:", error);
    } finally {
      setLoading(false);
    }
  }

  // Delete KV mapping
  async function deleteKvMapping(pid: string) {
    if (!me?.current?.org_id || !me?.current?.project_id) return;
    
    if (!confirm(`Are you sure you want to delete the mapping for PID "${pid}"?`)) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/kv`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid,
          org_id: me.current.org_id,
          project_id: me.current.project_id
        })
      });
      
      if (response.ok) {
        await loadKvMappings();
      } else {
        console.error("Failed to delete KV mapping");
      }
    } catch (error) {
      console.error("Error deleting KV mapping:", error);
    } finally {
      setLoading(false);
    }
  }

  // Handle Access KV button click
  function handleAccessKv() {
    setShowKvInterface(true);
    loadKvMappings();
  }

  async function generateToken() {
    try {
      // Prepare headers - use Bearer token if provided, otherwise use session
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (showAdvanced && adminToken) {
        headers["authorization"] = `Bearer ${adminToken}`;
      }

      // Prepare body - include org/project context for session auth
      const body = { ...tokenData };
      if (!showAdvanced || !adminToken) {
        // Session auth: must include org/project context
        if (me?.current?.org_id && me?.current?.project_id) {
          body.org_id = me.current.org_id;
          body.project_id = me.current.project_id;
        } else {
          console.error("No current org/project context");
          return;
        }
      }

      const response = await fetch(`${API_BASE}/admin/token`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedToken(data.token);
      } else {
        console.error("Failed to generate token");
      }
    } catch (error) {
      console.error("Error generating token:", error);
    }
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
          <p className="text-slate-600 mt-2">Manage KV mappings and generate tokens</p>
        </div>

        {!showKvInterface ? (
          <div className="grid md:grid-cols-2 gap-6">
            <Card title="KV Admin">
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  {showAdvanced ? "Hide Advanced" : "Show Advanced"} → Use Bearer Token
                </button>
              </div>
              
              <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                {/* Hidden username field for accessibility */}
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  style={{ display: 'none' }}
                  aria-hidden="true"
                />
                
                {showAdvanced && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Admin Token (INGEST_API_KEY)
                    </label>
                    <input
                      type="password"
                      value={adminToken}
                      onChange={(e) => setAdminToken(e.target.value)}
                      placeholder="Bearer token"
                      autoComplete="new-password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    />
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={handleAccessKv}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Access KV
                </button>
              </form>
            </Card>

            <Card title="Token Lab">
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  {showAdvanced ? "Hide Advanced" : "Show Advanced"} → Use Bearer Token
                </button>
              </div>
              
              <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                {/* Hidden username field for accessibility */}
                <input
                  type="text"
                  name="text"
                  autoComplete="username"
                  style={{ display: 'none' }}
                  aria-hidden="true"
                />
                
                {showAdvanced && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Admin Token (once)
                    </label>
                    <input
                      type="password"
                      value={tokenData.adminToken}
                      onChange={(e) => setTokenData({ ...tokenData, adminToken: e.target.value })}
                      placeholder="Bearer token"
                      autoComplete="new-password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Source
                  </label>
                  <select
                    value={tokenData.src}
                    onChange={(e) => setTokenData({ ...tokenData, src: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  >
                    <option value="chatgpt">chatgpt</option>
                    <option value="perplexity">perplexity</option>
                    <option value="claude">claude</option>
                    <option value="gemini">gemini</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Model (optional)
                  </label>
                  <input
                    type="text"
                    value={tokenData.model}
                    onChange={(e) => setTokenData({ ...tokenData, model: e.target.value })}
                    placeholder="gpt-4, claude-3, etc."
                    autoComplete="off"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    PID (slug)
                  </label>
                  <input
                    type="text"
                    value={tokenData.pid}
                    onChange={(e) => setTokenData({ ...tokenData, pid: e.target.value })}
                    placeholder="pricing_faq_us"
                    autoComplete="off"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Geo (optional)
                  </label>
                  <input
                    type="text"
                    value={tokenData.geo}
                    onChange={(e) => setTokenData({ ...tokenData, geo: e.target.value })}
                    placeholder="us, eu, asia"
                    autoComplete="off"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    TTL (seconds)
                  </label>
                  <input
                    type="number"
                    value={tokenData.ttl}
                    onChange={(e) => setTokenData({ ...tokenData, ttl: e.target.value })}
                    autoComplete="off"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  />
                </div>

                <button
                  type="submit"
                  onClick={generateToken}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Generate Token
                </button>

                {generatedToken && (
                  <div className="mt-4 p-3 bg-gray-100 rounded-md">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Generated Token
                    </label>
                    <input
                      type="text"
                      value={generatedToken}
                      readOnly
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md font-mono text-sm"
                    />
                  </div>
                )}
              </form>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Back to Admin Panel */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => setShowKvInterface(false)}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                ← Back to Admin Panel
              </button>
              <button
                onClick={loadKvMappings}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {/* Add New Mapping */}
            <Card title="Add New Mapping">
              <form onSubmit={(e) => { e.preventDefault(); addKvMapping(); }} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      PID (slug)
                    </label>
                    <input
                      type="text"
                      value={newMapping.pid}
                      onChange={(e) => setNewMapping({ ...newMapping, pid: e.target.value })}
                      placeholder="pricing_faq_us"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Destination URL
                    </label>
                    <input
                      type="url"
                      value={newMapping.url}
                      onChange={(e) => setNewMapping({ ...newMapping, url: e.target.value })}
                      placeholder="https://example.com/page"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !newMapping.pid || !newMapping.url}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  {loading ? "Adding..." : "Add Mapping"}
                </button>
              </form>
            </Card>

            {/* Existing Mappings */}
            <Card title="Existing Mappings">
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading mappings...</div>
              ) : kvMappings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No mappings found. Add your first mapping above.</div>
              ) : (
                <div className="space-y-3">
                  {kvMappings.map((mapping) => (
                    <div key={mapping.pid} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{mapping.pid}</div>
                        <div className="text-sm text-slate-600 break-all">{mapping.url}</div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => setEditingMapping(mapping)}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteKvMapping(mapping.pid)}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Edit Mapping Modal */}
            {editingMapping && (
              <Card title="Edit Mapping">
                <form onSubmit={(e) => { e.preventDefault(); updateKvMapping(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      PID (slug)
                    </label>
                    <input
                      type="text"
                      value={editingMapping.pid}
                      onChange={(e) => setEditingMapping({ ...editingMapping, pid: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Destination URL
                    </label>
                    <input
                      type="url"
                      value={editingMapping.url}
                      onChange={(e) => setEditingMapping({ ...editingMapping, url: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      {loading ? "Updating..." : "Update"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMapping(null)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </Card>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
