import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  Activity, 
  RefreshCw, 
  ExternalLink, 
  Search, 
  Clock, 
  Bot, 
  User, 
  Zap,
  MoreVertical,
  Copy,
  AlertCircle
} from "lucide-react";
// Simple SVG chart component instead of recharts
function SimpleLineChart({ data, formatTime }: { data: any[], formatTime: (ts: string) => string }) {
  if (!data || data.length === 0) return null;
  
  const maxValue = Math.max(...data.map(d => d.count));
  const minValue = Math.min(...data.map(d => d.count));
  const range = Math.max(1, maxValue - minValue);
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 300;
    const y = 100 - ((d.count - minValue) / range) * 80;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <div className="relative h-64 w-full">
      <svg viewBox="0 0 300 120" className="w-full h-full">
        <polyline
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2"
          points={points}
        />
        {data.map((d, i) => (
          <circle
            key={i}
            cx={(i / (data.length - 1)) * 300}
            cy={100 - ((d.count - minValue) / range) * 80}
            r="3"
            fill="#3B82F6"
          />
        ))}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 px-2">
        {data.length > 0 && (
          <>
            <span>{formatTime(data[0].ts)}</span>
            {data.length > 1 && <span>{formatTime(data[data.length - 1].ts)}</span>}
          </>
        )}
      </div>
    </div>
  );
}
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE, FETCH_OPTS } from '../config';

interface EventItem {
  id: number;
  occurred_at: string;
  event_type: "pageview" | "click" | "custom";
  class: "direct_human" | "human_via_ai" | "ai_agent_crawl" | "search";
  source?: { id: number; slug: string; name: string } | null;
  url?: string;
  content_id?: number;
  property_id?: number;
  metadata_preview?: Record<string, unknown>;
}

interface EventsSummary {
  totals: { events: number; ai_influenced: number; active_sources: number };
  by_class: Array<{ class: string; count: number }>;
  by_source_top: Array<{ ai_source_id: number; slug: string; name: string; count: number }>;
  timeseries: Array<{ ts: string; count: number }>;
}

interface EventsRecent {
  items: EventItem[];
  page: number;
  pageSize: number;
  total: number;
}

interface HasAnyResponse {
  has_any: boolean;
}

export default function Events() {
  const { project } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [summary, setSummary] = useState<EventsSummary | null>(null);
  const [recent, setRecent] = useState<EventsRecent | null>(null);
  const [hasAny, setHasAny] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshCount, setAutoRefreshCount] = useState(0);
  const [metadataPopover, setMetadataPopover] = useState<{ id: number; metadata: any } | null>(null);

  // URL params and filters
  const window = searchParams.get("window") || getStoredWindow() || "24h";
  const classFilter = searchParams.get("class") || "";
  const sourceFilter = searchParams.get("source") || "";
  const searchQuery = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1");

  // Refs for auto-refresh
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  const refreshCount = useRef(0);

  // Local storage for window preference
  function getStoredWindow(): string | null {
    if (!project?.id) return null;
    return localStorage.getItem(`ov:events:${project.id}`);
  }

  function setStoredWindow(win: string) {
    if (!project?.id) return;
    localStorage.setItem(`ov:events:${project.id}`, win);
  }

  // Update URL params
  function updateParams(updates: Record<string, string | null>) {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    setSearchParams(newParams);
  }

  // API calls
  async function fetchSummary() {
    if (!project?.id) return;
    
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams({ project_id: project.id, window });
      const response = await fetch(`${API_BASE}/api/events/summary?${params}`, FETCH_OPTS);
      
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
        setError(null);
      } else {
        throw new Error(`Summary API failed: ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to fetch summary:', err);
      setError('Failed to load summary data');
    } finally {
      setSummaryLoading(false);
    }
  }

  async function fetchRecent() {
    if (!project?.id) return;
    
    setRecentLoading(true);
    try {
      const params = new URLSearchParams({
        project_id: project.id,
        window,
        page: page.toString(),
        pageSize: "50"
      });
      
      if (classFilter) params.append("class", classFilter);
      if (sourceFilter) params.append("source", sourceFilter);
      if (searchQuery) params.append("q", searchQuery);

      const response = await fetch(`${API_BASE}/api/events/recent?${params}`, FETCH_OPTS);
      
      if (response.ok) {
        const data = await response.json();
        setRecent(data);
      } else {
        throw new Error(`Recent API failed: ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to fetch recent events:', err);
    } finally {
      setRecentLoading(false);
    }
  }

  async function fetchHasAny() {
    if (!project?.id) return;
    
    try {
      const params = new URLSearchParams({ project_id: project.id, window });
      const response = await fetch(`${API_BASE}/api/events/has-any?${params}`, FETCH_OPTS);
      
      if (response.ok) {
        const data = await response.json();
        setHasAny(data.has_any);
      }
    } catch (err) {
      console.error('Failed to fetch has-any:', err);
    }
  }

  async function refreshData() {
    setLastUpdated(new Date());
    await Promise.all([fetchSummary(), fetchRecent()]);
  }

  // Auto-refresh logic
  function startAutoRefresh() {
    if (refreshInterval.current) clearInterval(refreshInterval.current);
    refreshCount.current = 0;
    
    refreshInterval.current = setInterval(() => {
      refreshCount.current++;
      setAutoRefreshCount(refreshCount.current);
      
      if (refreshCount.current >= 12) { // 12 * 10s = 2 minutes
        clearInterval(refreshInterval.current!);
        refreshInterval.current = null;
        return;
      }
      
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    }, 10000); // 10 seconds
  }

  function stopAutoRefresh() {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
      refreshInterval.current = null;
    }
  }

  // Effects
  useEffect(() => {
    if (project?.id) {
      setLoading(true);
      Promise.all([fetchHasAny(), fetchSummary(), fetchRecent()])
        .finally(() => {
          setLoading(false);
          setLastUpdated(new Date());
          startAutoRefresh();
        });
    }
    
    return stopAutoRefresh;
  }, [project?.id, window, classFilter, sourceFilter, searchQuery, page]);

  useEffect(() => {
    if (window && window !== getStoredWindow()) {
      setStoredWindow(window);
    }
  }, [window, project?.id]);

  // Handlers
  function handleWindowChange(newWindow: string) {
    updateParams({ window: newWindow, page: null });
  }

  function handleClassFilter(className: string) {
    updateParams({ class: className === classFilter ? null : className, page: null });
  }

  function handleSourceFilter(slug: string) {
    updateParams({ source: slug === sourceFilter ? null : slug, page: null });
  }

  function handleSearch(query: string) {
    updateParams({ q: query || null, page: null });
  }

  function handlePageChange(newPage: number) {
    updateParams({ page: newPage > 1 ? newPage.toString() : null });
  }

  // Utility functions
  function getTrafficClassColor(className: string): string {
    switch (className) {
      case "direct_human": return "bg-gray-100 text-gray-800";
      case "human_via_ai": return "bg-blue-100 text-blue-800";
      case "ai_agent_crawl": return "bg-orange-100 text-orange-800";
      case "search": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  }

  function getEventTypeColor(eventType: string): string {
    switch (eventType) {
      case "pageview": return "bg-blue-100 text-blue-800";
      case "click": return "bg-green-100 text-green-800";
      case "custom": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  }

  function formatNumber(num: number): string {
    return num.toLocaleString();
  }

  function formatPercentage(value: number, total: number): string {
    if (total === 0) return "0.0%";
    return ((value / total) * 100).toFixed(1) + "%";
  }

  function formatRelativeTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  function formatChartTime(isoString: string): string {
    const date = new Date(isoString);
    if (window === "15m") return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (window === "24h") return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function truncateUrl(url: string, maxLength: number = 40): string {
    if (url.length <= maxLength) return url;
    const start = Math.floor((maxLength - 3) / 2);
    const end = Math.ceil((maxLength - 3) / 2);
    return url.slice(0, start) + "..." + url.slice(-end);
  }

  // Render helpers
  function renderMetadataPopover(item: EventItem) {
    if (!metadataPopover || metadataPopover.id !== item.id) return null;
    
    const metadata = item.metadata_preview || {};
    const jsonString = JSON.stringify(metadata, null, 2);
    
    return (
      <div className="absolute top-8 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-md">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-medium">Event Metadata</h4>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(jsonString)}
              className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
            <button
              onClick={() => setMetadataPopover(null)}
              className="text-xs text-gray-600 hover:text-gray-800"
            >
              ×
            </button>
          </div>
        </div>
        <pre className="text-xs bg-gray-50 p-2 rounded border max-h-32 overflow-auto">
          {jsonString}
        </pre>
      </div>
    );
  }

  // Smart empty state check
  if (!project) {
    return (
      <Shell>
        <div className="p-6">
          <div className="text-center py-8">
            <h2 className="text-lg font-medium text-gray-900">No project selected</h2>
            <p className="text-gray-500">Please select a project to view events.</p>
          </div>
        </div>
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell>
        <div className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading events...</p>
          </div>
        </div>
      </Shell>
    );
  }

  // Show install CTA if no events at all
  if (hasAny === false) {
    return (
      <Shell>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Events</h1>
            <p className="text-gray-600">Monitor AI traffic and user interactions</p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="h-8 w-8 text-blue-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-blue-800">No events yet</h3>
                  <p className="text-blue-700 mt-1">
                    Add a Property, create an API Key, and install the hosted tag.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <a
                  href={`/install?project_id=${project.id}`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Install
                </a>
                <a
                  href="/api-keys"
                  className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  API Keys
                </a>
              </div>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Events</h1>
            <p className="text-gray-600">Monitor AI traffic and user interactions</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Window Selector */}
            <div className="flex rounded-lg border border-gray-300">
              {["15m", "24h", "7d"].map((w) => (
                <button
                  key={w}
                  onClick={() => handleWindowChange(w)}
                  className={`px-3 py-1 text-sm font-medium ${
                    window === w
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  } ${w === "15m" ? "rounded-l-md" : w === "7d" ? "rounded-r-md" : ""}`}
                >
                  {w}
                </button>
              ))}
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={() => {
                refreshData();
                setAutoRefreshCount(0);
                startAutoRefresh();
              }}
              disabled={summaryLoading || recentLoading}
              className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${(summaryLoading || recentLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span className="text-red-700">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}

        {/* KPI Row */}
        {summary && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <Activity className="h-5 w-5 text-gray-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Total Events</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatNumber(summary.totals.events)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <Bot className="h-5 w-5 text-blue-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">AI-Influenced</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatNumber(summary.totals.ai_influenced)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <Zap className="h-5 w-5 text-green-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">% AI-Influenced</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatPercentage(summary.totals.ai_influenced, summary.totals.events)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <User className="h-5 w-5 text-purple-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Active Sources</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {summary.totals.active_sources}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Timeseries Chart */}
        {summary && (
          <Card>
            <div className="p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Events Over Time</h3>
              {summary.timeseries.length > 0 ? (
                <SimpleLineChart 
                  data={summary.timeseries} 
                  formatTime={formatChartTime}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No data in this time window
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Filter Chips */}
        {summary && (
          <div className="space-y-4">
            {/* Class Chips */}
            {summary.by_class.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Traffic Classes</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleClassFilter("")}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      !classFilter 
                        ? "bg-blue-100 text-blue-800 border-blue-200" 
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    All ({formatNumber(summary.totals.events)})
                  </button>
                  {summary.by_class.map((cls) => (
                    <button
                      key={cls.class}
                      onClick={() => handleClassFilter(cls.class)}
                      className={`px-3 py-1 rounded-full text-sm border ${
                        classFilter === cls.class
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {cls.class} ({formatNumber(cls.count)})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Source Chips */}
            {summary.by_source_top.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">AI Sources</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSourceFilter("")}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      !sourceFilter 
                        ? "bg-blue-100 text-blue-800 border-blue-200" 
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    All sources
                  </button>
                  {summary.by_source_top.slice(0, 6).map((source) => (
                    <button
                      key={source.slug}
                      onClick={() => handleSourceFilter(source.slug)}
                      className={`px-3 py-1 rounded-full text-sm border ${
                        sourceFilter === source.slug
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {source.name} ({formatNumber(source.count)})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Input */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search URLs and event types..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-md w-full text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Recent Events Table */}
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Events</h3>
            
            {recentLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="rounded bg-gray-200 h-4 w-16"></div>
                    <div className="rounded bg-gray-200 h-4 w-20"></div>
                    <div className="rounded bg-gray-200 h-4 w-24"></div>
                    <div className="rounded bg-gray-200 h-4 w-32"></div>
                    <div className="rounded bg-gray-200 h-4 w-48"></div>
                  </div>
                ))}
              </div>
            ) : !recent || recent.items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No events in this window
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-3 pr-4">Time</th>
                        <th className="py-3 pr-4">Event</th>
                        <th className="py-3 pr-4">Class</th>
                        <th className="py-3 pr-4">Source</th>
                        <th className="py-3 pr-4">URL</th>
                        <th className="py-3 pr-4">Metadata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.items.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 pr-4">
                            <span 
                              className="text-gray-600 cursor-help"
                              title={new Date(item.occurred_at).toLocaleString()}
                            >
                              {formatRelativeTime(item.occurred_at)}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${getEventTypeColor(item.event_type)}`}>
                              {item.event_type}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${getTrafficClassColor(item.class)}`}>
                              {item.class}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            {item.source ? (
                              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                {item.source.name}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 max-w-xs"
                              >
                                <span className="truncate">{truncateUrl(item.url)}</span>
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 relative">
                            {item.metadata_preview && Object.keys(item.metadata_preview).length > 0 ? (
                              <button
                                onClick={() => setMetadataPopover({ id: item.id, metadata: item.metadata_preview })}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                            {renderMetadataPopover(item)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {recent.total > recent.pageSize && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing {((page - 1) * recent.pageSize) + 1} to {Math.min(page * recent.pageSize, recent.total)} of {formatNumber(recent.total)} events
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page * recent.pageSize >= recent.total}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Auto-refresh status */}
        {autoRefreshCount > 0 && autoRefreshCount < 12 && (
          <div className="text-center">
            <span className="text-xs text-gray-500">
              Auto-refreshing... ({autoRefreshCount}/12)
            </span>
            <button
              onClick={stopAutoRefresh}
              className="ml-2 text-xs text-blue-600 hover:text-blue-800"
            >
              Stop
            </button>
          </div>
        )}

        {/* Manual recheck button after auto-refresh ends */}
        {autoRefreshCount >= 12 && (
          <div className="text-center">
            <button
              onClick={() => {
                refreshData();
                setAutoRefreshCount(0);
                startAutoRefresh();
              }}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Recheck
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
