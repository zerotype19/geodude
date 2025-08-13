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

  // Project handle and custom hosts state
  const [projectHandle, setProjectHandle] = useState("");
  const [customHosts, setCustomHosts] = useState<string[]>([]);
  const [newCustomHost, setNewCustomHost] = useState("");
  const [projectInfo, setProjectInfo] = useState<any>(null);

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

  // Load project info (handle, custom hosts, etc.)
  async function loadProjectInfo() {
    if (!me?.current?.project_id) return;
    
    try {
      const response = await fetch(`${API_BASE}/admin/project/info`, FETCH_OPTS);
      
      if (response.ok) {
        const data = await response.json();
        setProjectInfo(data);
        setProjectHandle(data.public_handle || "");
        setCustomHosts(data.custom_hosts ? data.custom_hosts.split(',') : []);
      } else {
        console.error("Failed to load project info:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("Error loading project info:", error);
    }
  }

  // Set project handle
  async function setProjectHandleSubmit(handle: string) {
    if (!handle || !/^[a-z0-9-]{3,50}$/.test(handle)) {
      alert("Handle must be 3-50 characters, lowercase letters, numbers, and hyphens only");
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/project/handle`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle })
      });
      
      if (response.ok) {
        setProjectHandle(handle);
        await loadProjectInfo();
        alert("Project handle set successfully!");
      } else {
        const errorText = await response.text();
        alert(`Failed to set handle: ${errorText}`);
      }
    } catch (error) {
      console.error("Error setting project handle:", error);
      alert("Error setting project handle");
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

  // Add custom host
  async function addCustomHost() {
    if (!newCustomHost || !newCustomHost.includes(".")) {
      alert("Please enter a valid domain (e.g., go.yourbrand.com)");
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/custom-hosts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: newCustomHost })
      });
      
      if (response.ok) {
        setNewCustomHost("");
        await loadProjectInfo();
        alert("Custom host added successfully!");
      } else {
        const errorText = await response.text();
        alert(`Failed to add custom host: ${errorText}`);
      }
    } catch (error) {
      console.error("Error adding custom host:", error);
      alert("Error adding custom host");
    } finally {
      setLoading(false);
    }
  }

  // Handle Access KV button click
  function handleAccessKv() {
    setShowKvInterface(true);
    loadKvMappings();
    loadProjectInfo();
  }

  // Load project info on component mount
  useEffect(() => {
    if (me?.current?.project_id) {
      loadProjectInfo();
    }
  }, [me?.current?.project_id]);

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

            {/* Built Links - Test Your Redirects */}
            <Card title="Built Links - Test Your Redirects">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h3 className="font-medium text-blue-900 mb-2">🚀 New Project-Scoped Redirects</h3>
                  <p className="text-sm text-blue-700 mb-3">
                    Your redirects now work with the new secure architecture. Set up a project handle to get public, testable URLs.
                  </p>
                  
                  {/* Project Handle Setup */}
                  <div className="bg-white border border-blue-300 rounded-md p-3 mb-3">
                    <h4 className="font-medium text-blue-900 mb-2">
                      1. Set Project Handle {projectHandle && <span className="text-green-600">✓ Set to: @{projectHandle}</span>}
                    </h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="your-brand-name"
                        value={projectHandle}
                        onChange={(e) => setProjectHandle(e.target.value)}
                        className="flex-1 px-3 py-2 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        pattern="[a-z0-9-]{3,50}"
                        title="Use lowercase letters, numbers, and hyphens (3-50 characters)"
                      />
                      <button 
                        onClick={() => setProjectHandleSubmit(projectHandle)}
                        disabled={loading || !projectHandle}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {loading ? "Setting..." : projectHandle ? "Update Handle" : "Set Handle"}
                      </button>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      This creates URLs like: <code>/p/@{projectHandle || 'your-handle'}/pid</code>
                    </p>
                  </div>

                  {/* Test Links */}
                  <div className="bg-white border border-blue-300 rounded-md p-3">
                    <h4 className="font-medium text-blue-900 mb-2">2. Test Your Redirects</h4>
                    {!projectHandle ? (
                      <div className="text-center py-4 text-gray-500">
                        Set a project handle above to see test links here.
                      </div>
                    ) : kvMappings.length > 0 ? (
                      <div className="space-y-2">
                        {kvMappings.map((mapping) => (
                          <div key={mapping.pid} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-900">{mapping.pid}</div>
                              <div className="text-xs text-gray-600">Redirects to: {mapping.url}</div>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={`${API_BASE.replace('/admin', '')}/p/@${projectHandle}/${mapping.pid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Test Handle URL
                              </a>
                              <a
                                href={`${API_BASE.replace('/admin', '')}/p/${mapping.pid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                                title="Only works with custom domains"
                              >
                                Test Direct URL
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">Add mappings above to see test links here.</div>
                    )}
                  </div>
                </div>

                {/* Custom Hosts Management */}
                <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
                  <h3 className="font-medium text-purple-900 mb-2">🌐 Custom Domain Setup</h3>
                  <p className="text-sm text-purple-700 mb-3">
                    Use your own domain for even cleaner URLs (e.g., go.yourbrand.com/p/pricing).
                  </p>
                  
                  {/* Add Custom Host */}
                  <div className="bg-white border border-purple-300 rounded-md p-3 mb-3">
                    <h4 className="font-medium text-purple-900 mb-2">Add Custom Domain</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="go.yourbrand.com"
                        value={newCustomHost}
                        onChange={(e) => setNewCustomHost(e.target.value)}
                        className="flex-1 px-3 py-2 border border-purple-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button 
                        onClick={addCustomHost}
                        disabled={loading || !newCustomHost}
                        className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                      >
                        {loading ? "Adding..." : "Add Domain"}
                      </button>
                    </div>
                  </div>

                  {/* Current Custom Hosts */}
                  {customHosts.length > 0 && (
                    <div className="bg-white border border-purple-300 rounded-md p-3">
                      <h4 className="font-medium text-purple-900 mb-2">Current Custom Domains</h4>
                      <div className="space-y-2">
                        {customHosts.map((host) => (
                          <div key={host} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                            <span className="text-sm font-medium text-gray-900">{host}</span>
                            <span className="text-xs text-green-600">✓ Active</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-purple-600 mt-2">
                        Use URLs like: <code>https://{customHosts[0]}/p/pricing</code>
                      </p>
                    </div>
                  )}

                  {/* Setup Instructions */}
                  <div className="bg-white border border-purple-300 rounded-md p-3">
                    <h4 className="font-medium text-purple-900 mb-2">Setup Steps</h4>
                    <ol className="text-sm text-purple-700 space-y-1 list-decimal list-inside">
                      <li>Add your domain above</li>
                      <li>Point your domain to Cloudflare</li>
                      <li>Use URLs like: <code>https://{customHosts[0] || 'go.yourbrand.com'}/p/pricing</code></li>
                    </ol>
                  </div>
                </div>

                {/* Legacy Token URLs */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <h3 className="font-medium text-gray-900 mb-2">🔑 Legacy Token URLs</h3>
                  <p className="text-sm text-gray-700 mb-3">
                    Generate tokens in the Token Lab above, then use them for campaign-specific redirects.
                  </p>
                  <div className="bg-white border border-gray-300 rounded-md p-3">
                    <h4 className="font-medium text-gray-900 mb-2">Token Format</h4>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {API_BASE.replace('/admin', '')}/r/[generated-token]
                    </code>
                    <p className="text-xs text-gray-600 mt-1">
                      These work for everyone and include tracking parameters.
                    </p>
                  </div>
                </div>
              </div>
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
