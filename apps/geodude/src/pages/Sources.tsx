import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";

interface AISource {
  id: number;
  name: string;
  category: string;
  fingerprint: string;
  created_at: string;
}

export default function Sources() {
  const { project } = useAuth();
  const [sources, setSources] = useState<AISource[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSource, setNewSource] = useState({ name: "", category: "search", fingerprint: "" });

  useEffect(() => {
    if (project?.id) {
      loadSources();
    }
  }, [project]);

  async function loadSources() {
    if (!project?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/sources?project_id=${project.id}`, FETCH_OPTS);
      if (response.ok) {
        const data = await response.json();
        setSources(data.sources || []);
      } else {
        console.error("Failed to load sources:", response.status);
      }
    } catch (error) {
      console.error("Error loading sources:", error);
    } finally {
      setLoading(false);
    }
  }

  async function addSource() {
    if (!project?.id || !newSource.name || !newSource.category) return;
    
    try {
      const sourceData = { ...newSource, project_id: project.id };
      const response = await fetch(`${API_BASE}/api/sources`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sourceData)
      });
      
      if (response.ok) {
        setNewSource({ name: "", category: "search", fingerprint: "" });
        await loadSources();
      } else {
        console.error("Failed to add source");
      }
    } catch (error) {
      console.error("Error adding source:", error);
    }
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">AI Sources</h1>
          <p className="text-slate-600 mt-2">
            Manage and monitor AI platforms that reference your {project?.name || 'project'} content
          </p>
        </div>

        {/* Add New Source */}
        <Card title="Add AI Source">
          <form onSubmit={(e) => { e.preventDefault(); addSource(); }} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Source Name
                </label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  placeholder="ChatGPT, Claude, Gemini..."
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Category
                </label>
                <select
                  value={newSource.category}
                  onChange={(e) => setNewSource({ ...newSource, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="search">Search Engine</option>
                  <option value="chat">Chat Assistant</option>
                  <option value="commerce">E-commerce</option>
                  <option value="assistant">Productivity Assistant</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fingerprint (Optional)
                </label>
                <input
                  type="text"
                  value={newSource.fingerprint}
                  onChange={(e) => setNewSource({ ...newSource, fingerprint: e.target.value })}
                  placeholder="JSON pattern for detection"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={!newSource.name || !newSource.category}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Add Source
            </button>
          </form>
        </Card>

        {/* Sources List */}
        <Card title="AI Sources">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading sources...</div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No AI sources found. Add your first source above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Category</th>
                    <th className="py-3 pr-4">Fingerprint</th>
                    <th className="py-3 pr-4">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.id} className="border-b">
                      <td className="py-3 pr-4 font-medium">{source.name}</td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          source.category === 'search' ? 'bg-blue-100 text-blue-800' :
                          source.category === 'chat' ? 'bg-green-100 text-green-800' :
                          source.category === 'commerce' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {source.category}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-gray-600 font-mono">
                        {source.fingerprint || "—"}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {new Date(source.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
