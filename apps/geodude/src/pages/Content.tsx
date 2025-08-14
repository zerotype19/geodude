import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";

interface ContentAsset {
  id: number;
  url: string;
  type: string;
  metadata: string;
  created_at: string;
  domain: string;
}

export default function Content() {
  const { project } = useAuth();
  const [content, setContent] = useState<ContentAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState({ 
    project_id: project?.id || "", 
    domain: "", 
    url: "", 
    type: "page", 
    metadata: "" 
  });

  useEffect(() => {
    if (project?.id) {
      setNewContent(prev => ({ ...prev, project_id: project.id }));
      loadContent();
    }
  }, [project]);

  async function loadContent() {
    if (!project?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/content?project_id=${project.id}`, FETCH_OPTS);
      if (response.ok) {
        const data = await response.json();
        setContent(data.content || []);
      } else {
        console.error("Failed to load content:", response.status);
      }
    } catch (error) {
      console.error("Error loading content:", error);
    } finally {
      setLoading(false);
    }
  }

  async function addContent() {
    if (!project?.id || !newContent.domain || !newContent.url) return;
    
    try {
      const contentData = { ...newContent, project_id: project.id };
      const response = await fetch(`${API_BASE}/api/content`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contentData)
      });
      
      if (response.ok) {
        setNewContent({ project_id: project.id, domain: "", url: "", type: "page", metadata: "" });
        await loadContent();
      } else {
        console.error("Failed to add content");
      }
    } catch (error) {
      console.error("Error adding content:", error);
    }
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Content Assets</h1>
          <p className="text-slate-600 mt-2">
            Manage your {project?.name || 'project'} content that AI platforms can reference and recommend
          </p>
        </div>

        {/* Add New Content */}
        <Card title="Add Content Asset">
          <form onSubmit={(e) => { e.preventDefault(); addContent(); }} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Domain
                </label>
                <input
                  type="text"
                  value={newContent.domain}
                  onChange={(e) => setNewContent({ ...newContent, domain: e.target.value })}
                  placeholder="example.com"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  URL
                </label>
                <input
                  type="url"
                  value={newContent.url}
                  onChange={(e) => setNewContent({ ...newContent, url: e.target.value })}
                  placeholder="https://example.com/page"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Type
                </label>
                <select
                  value={newContent.type}
                  onChange={(e) => setNewContent({ ...newContent, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="page">Page</option>
                  <option value="article">Article</option>
                  <option value="product">Product</option>
                  <option value="faq">FAQ</option>
                  <option value="guide">Guide</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Metadata (Optional)
              </label>
              <textarea
                value={newContent.metadata}
                onChange={(e) => setNewContent({ ...newContent, metadata: e.target.value })}
                placeholder="JSON metadata or description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={!newContent.project_id || !newContent.domain || !newContent.url}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Add Content
            </button>
          </form>
        </Card>

        {/* Content List */}
        <Card title="Content Assets">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading content...</div>
          ) : content.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No content assets found. Add your first content above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-4">URL</th>
                    <th className="py-3 pr-4">Type</th>
                    <th className="py-3 pr-4">Domain</th>
                    <th className="py-3 pr-4">Metadata</th>
                    <th className="py-3 pr-4">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {content.map((asset) => (
                    <tr key={asset.id} className="border-b">
                      <td className="py-3 pr-4">
                        <a 
                          href={asset.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate block max-w-xs"
                        >
                          {asset.url}
                        </a>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          asset.type === 'page' ? 'bg-blue-100 text-blue-800' :
                          asset.type === 'article' ? 'bg-green-100 text-green-800' :
                          asset.type === 'product' ? 'bg-purple-100 text-purple-800' :
                          asset.type === 'faq' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {asset.type}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-medium">{asset.domain}</td>
                      <td className="py-3 pr-4 text-xs text-gray-600 font-mono max-w-xs truncate">
                        {asset.metadata || "—"}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {new Date(asset.created_at).toLocaleDateString()}
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
