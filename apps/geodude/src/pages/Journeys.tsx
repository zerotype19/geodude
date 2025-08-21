import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Clock,
  RefreshCw,
  ExternalLink,
  Search,
  Activity,
  Bot,
  User,
  ArrowRight,
  MoreVertical,
  X,
  AlertCircle,
  Info
} from "lucide-react";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE, FETCH_OPTS } from '../config';

interface SessionSummary {
  totals: {
    sessions: number;
    ai_influenced: number;
    avg_events_per_session: number;
  };
  by_source: Array<{
    slug: string;
    name: string;
    count: number;
  }>;
  entry_pages: Array<{
    content_id: number;
    url: string;
    count: number;
  }>;
  timeseries: Array<{
    ts: string;
    count: number;
  }>;
  // AI-Lite fields
  tracking_mode?: string;
  ai_lite?: boolean;
}

interface SessionItem {
  id: number;
  started_at: string;
  ended_at: string | null;
  duration_sec: number;
  events_count: number;
  ai_influenced: boolean;
  primary_ai_source: {
    slug: string;
    name: string;
  } | null;
  entry: {
    content_id?: number;
    url?: string;
  };
  exit: {
    content_id?: number;
    url?: string;
  } | null;
}

interface SessionsRecent {
  items: SessionItem[];
  page: number;
  pageSize: number;
  total: number;
}

interface JourneyEvent {
  id: number;
  occurred_at: string;
  event_type: string;
  event_class: string;
  content: {
    id: number;
    url: string;
  } | null;
  ai_source: {
    slug: string;
    name: string;
  } | null;
  debug?: string[];
}

interface Journey {
  session: SessionItem;
  events: JourneyEvent[];
}

// Simple SVG chart component
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

// Traffic classification helper functions
function getTrafficClassColor(className: string): string {
  switch (className) {
    case "ai_agent_crawl": return "bg-orange-100 text-orange-800";
    case "human_via_ai": return "bg-blue-100 text-blue-800";
    case "search": return "bg-green-100 text-green-800";
    case "direct_human": return "bg-gray-100 text-gray-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function getTrafficClassLabel(className: string): string {
  switch (className) {
    case "direct_human": return "Direct Human";
    case "human_via_ai": return "Human via AI";
    case "ai_agent_crawl": return "AI Agent Crawl";
    case "search": return "Search";
    case "unknown": return "Unknown";
    default: return className;
  }
}

function getTrafficClassDescription(className: string): string {
  switch (className) {
    case "direct_human": return "No referrer, direct visits";
    case "human_via_ai": return "AI assistant referrers (ChatGPT, Claude, etc.)";
    case "ai_agent_crawl": return "Cloudflare verified bots and crawlers";
    case "search": return "Search engine referrers (Google, Bing, etc.)";
    case "unknown": return "Unclassified traffic";
    default: return "Traffic classification";
  }
}

export default function Journeys() {
  const { project } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [recent, setRecent] = useState<SessionsRecent | null>(null);
  const [hasAnySessions, setHasAnySessions] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshCount, setAutoRefreshCount] = useState(0);
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);

  // URL params and filters
  const window = searchParams.get("window") || getStoredWindow() || "24h";
  const aiFilter = searchParams.get("ai") || "all";
  const searchQuery = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1");

  // Refs for auto-refresh
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  const refreshCount = useRef(0);

  // Local storage for window preference
  function getStoredWindow(): string | null {
    if (!project?.id) return null;
    return localStorage.getItem(`ov:journeys:${project.id}`);
  }

  function setStoredWindow(win: string) {
    if (!project?.id) return;
    localStorage.setItem(`ov:journeys:${project.id}`, win);
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
      const params = new URLSearchParams({
        project_id: project.id,
        window,
        _t: Date.now().toString() // Cache buster
      });
      const response = await fetch(`${API_BASE}/api/sessions/summary?${params}`, FETCH_OPTS);

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
        pageSize: "50",
        ai: aiFilter,
        _t: Date.now().toString() // Cache buster
      });
      
      if (searchQuery) params.append("q", searchQuery);

      const response = await fetch(`${API_BASE}/api/sessions/recent?${params}`, FETCH_OPTS);
      
      if (response.ok) {
        const data = await response.json();
        setRecent(data);
        
        // Set hasAnySessions based on whether we have any sessions at all
        if (data.total > 0) {
          setHasAnySessions(true);
        } else if (hasAnySessions === null) {
          // Only check events if we haven't determined this yet
          checkHasAnyEvents();
        }
      } else {
        throw new Error(`Recent API failed: ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to fetch recent sessions:', err);
    } finally {
      setRecentLoading(false);
    }
  }

  async function checkHasAnyEvents() {
    if (!project?.id) return;
    
    try {
      const params = new URLSearchParams({ 
        project_id: project.id, 
        window: "15m",
        _t: Date.now().toString() // Cache buster
      });
      const response = await fetch(`${API_BASE}/api/events/has-any?${params}`, FETCH_OPTS);
      
      if (response.ok) {
        const data = await response.json();
        setHasAnySessions(data.has_any);
      }
    } catch (err) {
      console.error('Failed to check has any events:', err);
    }
  }

  async function fetchJourney(sessionId: number) {
    if (!project?.id) return;
    
    setJourneyLoading(true);
    try {
      const params = new URLSearchParams({ 
        project_id: project.id, 
        session_id: sessionId.toString(),
        _t: Date.now().toString() // Cache buster
      });
      const response = await fetch(`${API_BASE}/api/sessions/journey?${params}`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedJourney(data);
      } else {
        throw new Error(`Journey API failed: ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to fetch journey:', err);
    } finally {
      setJourneyLoading(false);
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
      Promise.all([fetchSummary(), fetchRecent()])
        .finally(() => {
          setLoading(false);
          setLastUpdated(new Date());
          startAutoRefresh();
        });
    }

    return stopAutoRefresh;
  }, [project?.id, window, aiFilter, searchQuery, page]);

  useEffect(() => {
    if (window && window !== getStoredWindow()) {
      setStoredWindow(window);
    }
  }, [window, project?.id]);

  // Set default AI-only filter for AI-Lite mode
  useEffect(() => {
    if (summary?.ai_lite && aiFilter === "all") {
      // Default to AI-only view in AI-Lite mode
      handleAIFilter("only");
    }
  }, [summary, aiFilter]);

  // Handlers
  function handleWindowChange(newWindow: string) {
    updateParams({ window: newWindow, page: null });
  }

  function handleAIFilter(newAIFilter: string) {
    updateParams({ ai: newAIFilter === "all" ? null : newAIFilter, page: null });
  }

  function handleSearch(query: string) {
    updateParams({ q: query || null, page: null });
  }

  function handlePageChange(newPage: number) {
    updateParams({ page: newPage > 1 ? newPage.toString() : null });
  }

  function handleViewJourney(sessionId: number) {
    fetchJourney(sessionId);
  }

  // Utility functions
  function formatNumber(num: number): string {
    return num.toLocaleString();
  }

  function formatPercentage(value: number, total: number): string {
    if (total === 0) return "0.0%";
    return ((value / total) * 100).toFixed(1) + "%";
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    if (!url || url.length <= maxLength) return url || "";
    const start = Math.floor((maxLength - 3) / 2);
    const end = Math.ceil((maxLength - 3) / 2);
    return url.slice(0, start) + "..." + url.slice(-end);
  }

  function getEventIcon(eventType: string) {
    switch (eventType) {
      case 'pageview':
        return <Activity className="h-4 w-4" />;
      case 'click':
        return <User className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  }

  // Smart empty state check
  if (!project) {
    return (
      <Shell>
        <div className="p-6">
          <div className="text-center py-8">
            <h2 className="text-lg font-medium text-gray-900">No project selected</h2>
            <p className="text-gray-500">Please select a project to view journeys.</p>
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
            <p className="text-gray-500 mt-2">Loading journeys...</p>
          </div>
        </div>
      </Shell>
    );
  }

  // Show install CTA if no sessions and no events at all
  if (hasAnySessions === false) {
    return (
      <Shell>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Journeys</h1>
            <p className="text-gray-600">Monitor visitor sessions and user journeys</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="h-8 w-8 text-blue-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-blue-800">No sessions yet</h3>
                  <p className="text-blue-700 mt-1">
                    Install the tracking tag to start monitoring visitor journeys and sessions.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <a
                  href={`/install?project_id=${project.id}`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Install Tag
                </a>
                <a
                  href="/sources"
                  className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  View Sources
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
            <h1 className="text-2xl font-bold text-gray-900">Journeys</h1>
            <p className="text-gray-600">Monitor visitor sessions and user journeys</p>
            {summary?.tracking_mode && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                  {summary.tracking_mode === 'ai-lite' ? 'AI-Lite Mode' : 'Full Tracking Mode'}
                </span>
                {summary.ai_lite && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Info className="h-3 w-3" />
                    <span>Non-AI sessions not retained in detail view</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Window Selector */}
            <div className="flex rounded-lg border border-gray-300">
              {["15m", "24h", "7d"].map((w) => (
                <button
                  key={w}
                  onClick={() => handleWindowChange(w)}
                  className={`px-3 py-1 text-sm font-medium ${window === w
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
                    <p className="text-sm font-medium text-gray-500">Total Sessions</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatNumber(summary.totals.sessions)}
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
                  <User className="h-5 w-5 text-green-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">% AI Sessions</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatPercentage(summary.totals.ai_influenced, summary.totals.sessions)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-purple-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Avg Events/Session</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {summary.totals.avg_events_per_session.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            {/* Timeseries Chart */}
            {summary && (
              <Card>
                <div className="p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Sessions Over Time</h3>
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

            {/* Filters */}
            <div className="space-y-4">
              {/* AI Filter */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">AI Traffic</h4>
                <div className="flex flex-wrap gap-2">
                  {["all", "only", "none"].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => handleAIFilter(filter)}
                      className={`px-3 py-1 rounded-full text-sm border ${aiFilter === filter || (aiFilter === "all" && filter === "all")
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                      {filter === "all" ? "All" : filter === "only" ? "AI only" : "Non-AI"}
                    </button>
                  ))}
                </div>
                
                {/* AI-Lite Mode Note */}
                {summary?.ai_lite && (
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    <span>
                      AI-Lite mode: Non-AI sessions are not retained as detailed journeys. Baseline counts are available on Events page.
                    </span>
                  </div>
                )}
              </div>

              {/* Search Input */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by URL..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-9 pr-3 py-2 border border-gray-300 rounded-md w-full text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Recent Sessions Table */}
            <Card>
              <div className="p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Sessions</h3>

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
                    No sessions in this window
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="py-3 pr-4">Started</th>
                            <th className="py-3 pr-4">Duration</th>
                            <th className="py-3 pr-4">Events</th>
                            <th className="py-3 pr-4">AI</th>
                            <th className="py-3 pr-4">Entry URL</th>
                            <th className="py-3 pr-4">Exit URL</th>
                            <th className="py-3 pr-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recent.items.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 pr-4">
                                <span
                                  className="text-gray-600 cursor-help"
                                  title={new Date(item.started_at).toLocaleString()}
                                >
                                  {formatRelativeTime(item.started_at)}
                                </span>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="text-gray-900">
                                  {formatDuration(item.duration_sec)}
                                </span>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="text-gray-900">
                                  {item.events_count}
                                </span>
                              </td>
                              <td className="py-3 pr-4">
                                {item.ai_influenced ? (
                                  <div className="flex items-center gap-1">
                                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                      AI
                                    </span>
                                    {item.primary_ai_source && (
                                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                        {item.primary_ai_source.name}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="py-3 pr-4">
                                {item.entry?.url ? (
                                  <a
                                    href={item.entry.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 max-w-xs"
                                  >
                                    <span className="truncate">{truncateUrl(item.entry.url)}</span>
                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                  </a>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="py-3 pr-4">
                                {item.exit?.url ? (
                                  <a
                                    href={item.exit.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 max-w-xs"
                                  >
                                    <span className="truncate">{truncateUrl(item.exit.url)}</span>
                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                  </a>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="py-3 pr-4">
                                <button
                                  onClick={() => handleViewJourney(item.id)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  View Journey
                                </button>
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
                          Showing {((page - 1) * recent.pageSize) + 1} to {Math.min(page * recent.pageSize, recent.total)} of {formatNumber(recent.total)} sessions
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
          </div>

          {/* Side Panel - Entry Pages */}
          <div className="space-y-6">
            {summary && summary.entry_pages.length > 0 && (
              <Card>
                <div className="p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Top Entry Pages</h3>
                  <div className="space-y-3">
                    {summary.entry_pages.slice(0, 8).map((page, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          {page.content_id ? (
                            <a
                              href={`/content?content_id=${page.content_id}`}
                              className="text-blue-600 hover:text-blue-800 text-sm truncate block"
                            >
                              {truncateUrl(page.url, 30)}
                            </a>
                          ) : (
                            <span className="text-gray-900 text-sm truncate block">
                              {truncateUrl(page.url, 30)}
                            </span>
                          )}
                        </div>
                        <span className="text-gray-500 text-xs ml-2">
                          {formatNumber(page.count)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* AI-Lite Mode Note */}
        {summary?.ai_lite && (
          <Card>
            <div className="p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-1">AI-Lite Mode Active</p>
                  <p>
                    Non-AI sessions are not retained as detailed journeys in AI-Lite mode. 
                    Only AI-influenced sessions appear in the table above. For baseline traffic counts, 
                    see the Events page which shows rollup data for direct human and search traffic.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

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

      {/* Journey Drawer */}
      {selectedJourney && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setSelectedJourney(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Journey Details</h2>
                  <p className="text-sm text-gray-500">Session #{selectedJourney.session.id}</p>
                </div>
                <button
                  onClick={() => setSelectedJourney(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {journeyLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading journey...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Session Summary */}
                    <div>
                      <h3 className="text-md font-medium text-gray-900 mb-3">Session Summary</h3>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Duration:</span>
                          <span className="text-sm text-gray-900">{formatDuration(selectedJourney.session.duration_sec)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Events:</span>
                          <span className="text-sm text-gray-900">{selectedJourney.session.events_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">AI Influenced:</span>
                          <span className="text-sm text-gray-900">
                            {selectedJourney.session.ai_influenced ? "Yes" : "No"}
                          </span>
                        </div>
                        {selectedJourney.session.primary_ai_source && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Primary Source:</span>
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              {selectedJourney.session.primary_ai_source.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div>
                      <h3 className="text-md font-medium text-gray-900 mb-3">Actions</h3>
                      <div className="flex gap-2">
                        {selectedJourney.session.entry?.content_id && (
                          <a
                            href={`/content?content_id=${selectedJourney.session.entry.content_id}`}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200"
                          >
                            Open in Content
                          </a>
                        )}
                        {selectedJourney.session.entry?.url && (
                          <a
                            href={`/events?window=24h&q=${encodeURIComponent(selectedJourney.session.entry.url)}`}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
                          >
                            Open in Events
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Event Timeline */}
                    <div>
                      <h3 className="text-md font-medium text-gray-900 mb-3">Event Timeline</h3>
                      <div className="space-y-3">
                        {selectedJourney.events.map((event, index) => (
                          <div key={event.id} className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              {getEventIcon(event.event_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {event.event_type}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-1 text-xs rounded-full ${getTrafficClassColor(event.event_class)}`}>
                                    {getTrafficClassLabel(event.event_class)}
                                  </span>
                                  {event.event_class !== 'unknown' && (
                                    <div className="relative group">
                                      <Info className="h-3 w-3 text-gray-400 cursor-help" />
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                                        {getTrafficClassDescription(event.event_class)}
                                        {event.debug && event.debug.length > 0 && (
                                          <div className="mt-1 pt-1 border-t border-gray-700">
                                            <strong>Debug:</strong> {event.debug.join(', ')}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {event.ai_source && (
                                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                    {event.ai_source.name}
                                  </span>
                                )}
                              </div>
                              {event.content?.url && (
                                <a
                                  href={event.content.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                                >
                                  <span className="truncate max-w-xs">{event.content.url}</span>
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {formatRelativeTime(event.occurred_at)}
                              </p>
                            </div>
                            {index < selectedJourney.events.length - 1 && (
                              <div className="absolute left-4 mt-8 w-0.5 h-6 bg-gray-200" style={{ marginLeft: '15px' }} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
