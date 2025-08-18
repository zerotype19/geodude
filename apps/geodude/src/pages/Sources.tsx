import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";

// Data contracts as specified
type SourceRow = {
  id: number;
  slug: string;
  name: string;
  category: "chat_assistant" | "search_engine" | "crawler" | "browser_ai" | "model_api" | "other";
  enabled: boolean;
  last_seen: string | null;
  events_15m: number;
  events_24h: number;
  referrals_24h: number;
  top_content?: { content_url: string; count: number }[];
};

type CategoryOption = {
  value: SourceRow["category"];
  label: string;
  description: string;
};

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "chat_assistant", label: "Chat Assistant", description: "AI chat tools like ChatGPT, Claude" },
  { value: "search_engine", label: "Search Engine", description: "AI-powered search like Perplexity" },
  { value: "crawler", label: "Crawler", description: "AI web crawlers and scrapers" },
  { value: "browser_ai", label: "Browser AI", description: "Browser-based AI assistants" },
  { value: "model_api", label: "Model API", description: "Direct AI model API calls" },
  { value: "other", label: "Other", description: "Other AI platforms and tools" }
];

export default function Sources() {
  const { project, user } = useAuth();
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<"last_seen" | "events_24h" | "name">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState<"all" | "enabled" | "has_activity" | "no_activity">("all");

  // Modal state
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState<SourceRow | null>(null);

  // Form state
  const [newSource, setNewSource] = useState({
    name: "",
    slug: "",
    category: "chat_assistant" as SourceRow["category"],
    is_active: true
  });

  const [suggestPattern, setSuggestPattern] = useState({
    ai_source_id: 0,
    pattern: ""
  });

  useEffect(() => {
    if (project?.id) {
      loadSources();
    }
  }, [project]);

  async function loadSources() {
    if (!project?.id) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/sources?project_id=${project.id}&includeTop=false`, FETCH_OPTS);
      if (response.ok) {
        const data = await response.json();
        console.log('Sources API response:', data); // Debug logging
        
        // Handle both response formats: direct array or { sources: [...] }
        let sourcesArray = data;
        if (data && typeof data === 'object' && Array.isArray(data.sources)) {
          sourcesArray = data.sources;
        }
        
        // Ensure each source has required fields with defaults
        const normalizedSources = (sourcesArray || []).map((source: any) => ({
          id: source.id,
          slug: source.slug || source.name?.toLowerCase().replace(/\s+/g, '_') || 'unknown',
          name: source.name || 'Unknown',
          category: source.category || 'other',
          enabled: Boolean(source.enabled), // Explicitly convert to boolean
          last_seen: source.last_seen || null,
          events_15m: source.events_15m || 0,
          events_24h: source.events_24h || 0,
          referrals_24h: source.referrals_24h || 0,
          top_content: source.top_content || []
        }));
        
        setSources(normalizedSources);
      } else {
        const errorText = await response.text();
        setError(`Failed to load sources: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      setError("Error loading sources");
      console.error("Error loading sources:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTopContent(sourceId: number) {
    if (!project?.id) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/sources?project_id=${project.id}&includeTop=true`, FETCH_OPTS);
      if (response.ok) {
        const data = await response.json();
        const sourceWithTopContent = data.find((s: SourceRow) => s.id === sourceId);
        if (sourceWithTopContent?.top_content) {
          setSources(prev => prev.map(s => 
            s.id === sourceId ? { ...s, top_content: sourceWithTopContent.top_content } : s
          ));
        }
      }
    } catch (error) {
      console.error("Error loading top content:", error);
    }
  }

  async function toggleSource(source: SourceRow, enabled: boolean) {
    if (!project?.id) return;

    // Optimistic update
    const originalSources = [...sources];
    setSources(prev => prev.map(s => 
      s.id === source.id ? { ...s, enabled } : s
    ));

    try {
      if (enabled) {
        // Enable source
        const response = await fetch(`${API_BASE}/api/sources/enable`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: project.id,
            ai_source_id: source.id,
            enabled: true
          })
        });
        
        if (!response.ok) {
          throw new Error("Failed to enable source");
        }
      } else {
        // Disable source
        const response = await fetch(`${API_BASE}/api/sources/enable`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: project.id,
            ai_source_id: source.id
          })
        });
        
        if (!response.ok) {
          throw new Error("Failed to disable source");
        }
      }

      // TODO: Track metrics events
      // sources_enable_clicked or sources_disable_clicked

    } catch (error) {
      // Revert on error
      setSources(originalSources);
      setError(`Failed to ${enabled ? 'enable' : 'disable'} source`);
      console.error(`Error ${enabled ? 'enabling' : 'disabling'} source:`, error);
    }
  }

  async function createGlobalSource() {
    if (!project?.id) return;

    try {
      const response = await fetch(`${API_BASE}/admin/sources`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSource)
      });
      
      if (response.ok) {
        setShowAdminModal(false);
        setNewSource({ name: "", slug: "", category: "chat_assistant", is_active: true });
        await loadSources();
      } else {
        throw new Error("Failed to create global source");
      }
    } catch (error) {
      setError("Failed to create global source");
      console.error("Error creating global source:", error);
    }
  }

  async function submitPatternSuggestion() {
    if (!project?.id || !suggestPattern.pattern) return;

    try {
      const patternJson = JSON.parse(suggestPattern.pattern);
      
      if (JSON.stringify(patternJson).length > 2048) {
        setError("Pattern too large (max 2KB)");
        return;
      }

      const response = await fetch(`${API_BASE}/api/sources/enable`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          ai_source_id: suggestPattern.ai_source_id,
          enabled: true,
          suggested_pattern_json: patternJson
        })
      });
      
      if (response.ok) {
        setShowSuggestModal(false);
        setSuggestPattern({ ai_source_id: 0, pattern: "" });
        await loadSources();
        // TODO: Success toast: "Suggestion submitted. We'll review it soon."
      } else {
        throw new Error("Failed to submit suggestion");
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        setError("Invalid JSON pattern");
      } else {
        setError("Failed to submit suggestion");
      }
      console.error("Error submitting suggestion:", error);
    }
  }

  function toggleRowExpansion(sourceId: number) {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(sourceId)) {
      newExpanded.delete(sourceId);
    } else {
      newExpanded.add(sourceId);
      // Load top content when expanding
      loadTopContent(sourceId);
    }
    setExpandedRows(newExpanded);
  }

  function getSortedAndFilteredSources() {
    let filtered = [...sources];
    
    // Apply filters
    switch (filter) {
      case "enabled":
        filtered = filtered.filter(s => s.enabled);
        break;
      case "has_activity":
        filtered = filtered.filter(s => s.events_24h > 0);
        break;
      case "no_activity":
        filtered = filtered.filter(s => s.events_24h === 0);
        break;
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case "last_seen":
          aVal = a.last_seen || "0000-01-01";
          bVal = b.last_seen || "0000-01-01";
          break;
        case "events_24h":
          aVal = a.events_24h;
          bVal = b.events_24h;
          break;
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        default:
          aVal = a.last_seen || "0000-01-01";
          bVal = b.last_seen || "0000-01-01";
      }
      
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    return filtered;
  }

  const sortedSources = getSortedAndFilteredSources();
  const hasActivity = sources.some(s => s.events_24h > 0);
  const hasEnabled = sources.some(s => s.enabled);

  if (!project?.id) {
    return (
      <Shell>
        <div className="text-center py-8 text-gray-500">
          No project selected. Please select a project to view sources.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">AI Sources</h1>
            <p className="text-slate-600 mt-2">
              Manage and monitor AI platforms that reference your {project.name} content
            </p>
          </div>
          <a 
            href="/docs/sources" 
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            Docs →
          </a>
        </div>

        {/* Header Actions */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-slate-600">
              Enable or disable AI sources to track which platforms reference your content. 
              All sources are available globally - just toggle them on or off for this project.
            </p>
          </div>
          
          <div className="flex gap-3">
            {!user?.is_admin && (
              <button
                onClick={() => setShowSuggestModal(true)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Suggest New Source
              </button>
            )}
            
            {user?.is_admin && (
              <button
                onClick={() => setShowAdminModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Add New Source
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sources List */}
        <Card title="Available AI Sources">
          {/* Controls */}
          <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Sort Controls */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="name">Name</option>
                  <option value="last_seen">Last Activity</option>
                  <option value="events_24h">24h Events</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  {sortOrder === "asc" ? "↑" : "↓"}
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex space-x-2">
              {["all", "enabled", "has_activity", "no_activity"].map((filterOption) => (
                <button
                  key={filterOption}
                  onClick={() => setFilter(filterOption as any)}
                  className={`px-3 py-1 text-xs rounded-full ${
                    filter === filterOption
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {filterOption === "all" && "All Sources"}
                  {filterOption === "enabled" && "Enabled Only"}
                  {filterOption === "has_activity" && "With Activity"}
                  {filterOption === "no_activity" && "No Activity"}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-12 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : sortedSources.length === 0 ? (
            <div className="text-center py-12">
              {filter === "all" ? (
                <div>
                  <p className="text-lg text-gray-900 font-medium">No AI sources available</p>
                  <p className="text-gray-600 mt-1">Contact your administrator to add new AI sources to the system.</p>
                </div>
              ) : (
                <div>
                  <p className="text-lg text-gray-900 font-medium">No sources match your filters</p>
                  <p className="text-gray-600 mt-1">Try selecting "All Sources" to see all available options.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                      <th className="py-3 pr-4">AI Source</th>
                      <th className="py-3 pr-4 text-center">Enabled for Project</th>
                      <th className="py-3 pr-4">
                        <span className="cursor-help" title="Last time this source was detected referencing your content">
                          Last Activity
                        </span>
                      </th>
                      <th className="py-3 pr-4">
                        <span className="cursor-help" title="Events from this source in the last 15 minutes">
                          15m Events
                        </span>
                      </th>
                      <th className="py-3 pr-4">
                        <span className="cursor-help" title="Events from this source in the last 24 hours">
                          24h Events
                        </span>
                      </th>
                      <th className="py-3 pr-4">
                        <span className="cursor-help" title="AI referrals detected from this source in the last 24 hours">
                          24h Referrals
                        </span>
                      </th>
                      <th className="py-3 pr-4">Actions</th>
                    </tr>
                </thead>
                <tbody>
                  {sortedSources.map((source) => (
                    <>
                      <tr key={source.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center space-x-3">
                            <div>
                              <div className="font-medium text-gray-900">{source.name}</div>
                              <div className="text-xs text-gray-500">{source.slug}</div>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              source.category === 'chat_assistant' ? 'bg-green-100 text-green-800' :
                              source.category === 'search_engine' ? 'bg-blue-100 text-blue-800' :
                              source.category === 'crawler' ? 'bg-purple-100 text-purple-800' :
                              source.category === 'browser_ai' ? 'bg-yellow-100 text-yellow-800' :
                              source.category === 'model_api' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {source.category.replace('_', ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => toggleSource(source, !source.enabled)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                source.enabled ? 'bg-blue-600' : 'bg-gray-200'
                              }`}
                              title={source.enabled ? `Disable ${source.name} for this project` : `Enable ${source.name} for this project`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  source.enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {source.last_seen ? (
                            <span title={new Date(source.last_seen).toLocaleString()}>
                              {new Date(source.last_seen).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">Never</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {source.events_15m}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {source.events_24h}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {source.referrals_24h}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => toggleRowExpansion(source.id)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              {expandedRows.has(source.id) ? "Hide Details" : "View Details"}
                            </button>
                            {!source.enabled && source.events_24h > 0 && (
                              <button
                                onClick={() => toggleSource(source, true)}
                                className="text-green-600 hover:text-green-800 text-sm"
                              >
                                Enable
                              </button>
                            )}
                            {user?.is_admin && (
                              <a
                                href={`/admin/rules?s=${source.slug}`}
                                className="text-gray-600 hover:text-gray-800 text-sm"
                              >
                                Edit Global
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Row with Top Content */}
                      {expandedRows.has(source.id) && (
                        <tr key={`${source.id}-expanded`} className="bg-gray-50">
                          <td colSpan={7} className="py-4 px-4">
                            <div className="space-y-3">
                              <h4 className="font-medium text-gray-900">Top Content (Last 24h)</h4>
                              {source.top_content && source.top_content.length > 0 ? (
                                <div className="space-y-2">
                                  {source.top_content.map((content, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                      <span className="text-gray-700 truncate max-w-md">
                                        {content.content_url}
                                      </span>
                                      <span className="text-gray-500 font-mono">
                                        {content.count} views
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-500 text-sm">No content data available</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>



      {/* Suggest New Source Modal */}
      {showSuggestModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Suggest New AI Source</h3>
              <p className="text-sm text-gray-600 mb-4">
                Request a new AI source to be added to the system. Provide detection patterns to help identify traffic from this source.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Source
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => setSuggestPattern(prev => ({ ...prev, ai_source_id: parseInt(e.target.value) }))}
                  >
                    <option value="">Choose a source...</option>
                    {sources.map(source => (
                      <option key={source.id} value={source.id}>
                        {source.name} ({source.category.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pattern JSON
                  </label>
                  <textarea
                    value={suggestPattern.pattern}
                    onChange={(e) => setSuggestPattern(prev => ({ ...prev, pattern: e.target.value }))}
                    placeholder='{"ua_regex": ["pattern"], "referer_domains": ["domain.com"]}'
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter JSON pattern (max 2KB). See docs for schema.
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowSuggestModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitPatternSuggestion}
                    disabled={!suggestPattern.ai_source_id || !suggestPattern.pattern}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Add New Source Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New AI Source</h3>
              <p className="text-sm text-gray-600 mb-4">
                Add a new AI source that will be available to all projects in the system.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newSource.name}
                    onChange={(e) => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="ChatGPT"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={newSource.slug}
                    onChange={(e) => setNewSource(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="chatgpt"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={newSource.category}
                    onChange={(e) => setNewSource(prev => ({ ...prev, category: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newSource.is_active}
                    onChange={(e) => setNewSource(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Active
                  </label>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowAdminModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createGlobalSource}
                    disabled={!newSource.name || !newSource.slug}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Add Source
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
