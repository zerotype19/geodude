import { useState } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import { useAuth } from "../useAuth";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";

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
                type="submit"
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
      </div>
    </Shell>
  );
}
