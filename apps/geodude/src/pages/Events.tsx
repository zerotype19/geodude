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
  AlertCircle,
  Info,
  ChevronRight,
  ChevronDown,
  Download
} from "lucide-react";
// Simple SVG chart component instead of recharts
function SimpleLineChart({ data, formatTime }: { data: any[], formatTime: (ts: string) => string }) {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.count));
  const minValue = Math.min(...data.map(d => d.count));
  const range = Math.max(1, maxValue - minValue);

  // Handle edge case where data.length === 1
  if (data.length === 1) {
    return (
      <div className="relative h-64 w-full">
        <svg viewBox="0 0 300 120" className="w-full h-full">
          <circle
            cx="150"
            cy="20"
            r="3"
            fill="#3B82F6"
          />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 px-2">
          <span>{formatTime(data[0].ts)}</span>
        </div>
      </div>
    );
  }

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 300;
    const y = 100 - ((d.count - minValue) / range) * 80;
    // Ensure we have valid numbers
    if (isNaN(x) || isNaN(y)) return null;
    return `${x},${y}`;
  }).filter(Boolean).join(' ');

  return (
    <div className="relative h-64 w-full">
      <svg viewBox="0 0 300 120" className="w-full h-full">
        {points && (
          <polyline
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
            points={points}
          />
        )}
        {data.map((d, i) => {
          const cx = (i / (data.length - 1)) * 300;
          const cy = 100 - ((d.count - minValue) / range) * 80;
          // Skip rendering if coordinates are invalid
          if (isNaN(cx) || isNaN(cy)) return null;
          
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="3"
              fill="#3B82F6"
            />
          );
        })}
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
import { getIncludeTrainingFromURL, syncIncludeTrainingFromURL } from '../lib/prefs';

interface EventItem {
  id: number;
  occurred_at: string;
  event_type: "pageview" | "click" | "custom";
  event_class: "direct_human" | "human_via_ai" | "crawler" | "search" | "unknown";
  source_name?: string | null;
  url?: string;
  content_id?: number;
  property_id?: number;
  metadata_preview?: Record<string, unknown>;
  debug?: string[]; // Classification debug trail
  classification_reason?: string; // New audit field
  classification_confidence?: number; // New audit field
  bot_category?: string | null; // New bot category field
  // CF Signal fields
  cf_verified_bot?: boolean;
  cf_verified_bot_category?: string | null;
  cf_asn?: number | null;
  cf_org?: string | null;
  signals?: string[]; // CF debug signals array
}

interface EventsSummary {
  totals: { events: number; ai_influenced: number; active_sources: number };
  by_class: Array<{ class: string; count: number }>;
  by_bot_category?: Array<{ category: string; count: number }>;
  by_source_top: Array<{ ai_source_id: number; slug: string; name: string; count: number }>;
  timeseries: Array<{ ts: string; count: number }>;
  // AI-Lite fields
  baseline?: {
    direct_events: number;
    search_events: number;
    sampled_rows_retained: number;
    sample_pct: number;
  };
  tracking_mode?: string;
  ai_lite?: boolean;
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

  // EventRow component for expandable rows (defined inside Events component for access to utilities)
  function EventRow({ event, debugMode, summary }: {
    event: EventItem;
    debugMode: boolean;
    summary: EventsSummary | null;
  }) {
    const [open, setOpen] = useState<boolean>(!!debugMode);
    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState<any | null>(null);

    const toggle = async () => {
      const next = !open;
      setOpen(next);
      if (next && !detail) {
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE}/api/events/detail?id=${event.id}`, FETCH_OPTS);
          if (res.ok) {
            const data = await res.json();
            setDetail(data);
          }
        } catch (err) {
          console.error('Failed to fetch event detail:', err);
        } finally {
          setLoading(false);
        }
      }
    };

    return (
      <>
        <tr className="border-b hover:bg-gray-50">
          <td className="py-3 pr-4 w-6">
            <button onClick={toggle} className="p-1 hover:bg-gray-100 rounded">
              {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
          </td>
          <td className="py-3 pr-4">
            <span
              className="text-gray-600 cursor-help"
              title={new Date(event.occurred_at).toLocaleString()}
            >
              {formatRelativeTime(event.occurred_at)}
            </span>
          </td>
          <td className="py-3 pr-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-900">
                {event.event_type === 'pageview' ? 'view' : event.event_type === 'click' ? 'click' : event.event_type}
              </span>
              <span className="text-xs text-gray-500">
                {event.event_type}
              </span>
            </div>
          </td>
          <td className="py-3 pr-4">
            <div className="flex flex-col gap-1">
              <span className={`px-2 py-1 text-xs rounded-full ${getTrafficClassColor(event.event_class)}`}>
                {getTrafficClassLabel(event.event_class)}
              </span>
              
              {/* Bot Category as sublabel */}
              {event.bot_category && event.event_class === 'crawler' && (
                <span className="text-xs text-gray-500">
                  {getBotCategoryLabel(event.bot_category)}
                </span>
              )}
              
              {/* AI-Lite sampled indicator */}
              {['direct_human', 'search'].includes(event.event_class) && summary?.ai_lite && (
                <span className="text-xs text-gray-500">ⓘ sampled</span>
              )}
            </div>
          </td>
          <td className="py-3 pr-4">
            {event.source_name ? (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                {event.source_name}
              </span>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </td>
          
          {/* CF Column - Icon Only */}
          <td className="py-3 pr-4">
            <div className="flex items-center justify-center text-muted-foreground">
              {event.cf_verified_bot ? (
                <span className="text-green-600" title="CF Verified Bot">🛡️</span>
              ) : (
                <span className="text-gray-400" title="No CF Signal">—</span>
              )}
            </div>
          </td>
          
          <td className="py-3 pr-4">
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 max-w-xs"
              >
                <span className="truncate">{truncateUrl(event.url)}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </td>

        </tr>

        {open && (
          <tr className="bg-gray-50/50">
            <td colSpan={6}>
              {loading && <div className="p-4 text-sm text-gray-500">Loading classification details...</div>}

              {detail && (
                <div className="p-4">
                  {/* Top-right buttons */}
                  <div className="flex justify-end gap-2 mb-4">
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(detail, null, 2))}
                      className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded border"
                    >
                      <Copy size={12} className="inline mr-1" />
                      Copy JSON
                    </button>
                    <button
                      onClick={() => {
                        const params = new URLSearchParams({
                          ua: detail.user_agent || '',
                          referrer: detail.referrer || '',
                          url: detail.url || ''
                        });
                        const cURL = `curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://api.optiview.ai/admin/debug/classify?${params.toString()}"`;
                        navigator.clipboard.writeText(cURL);
                      }}
                      className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 rounded border"
                      title="Copy cURL command to reproduce classification"
                    >
                      <Copy size={12} className="inline mr-1" />
                      Copy cURL
                    </button>
                  </div>
                  
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs uppercase text-gray-500 font-medium mb-2">Classification</div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Class:</span>
                          <span className={`px-2 py-1 text-xs rounded-full ${getTrafficClassColor(detail.classification.class)}`}>
                            {getTrafficClassLabel(detail.classification.class)}
                          </span>
                        </div>
                        {detail.classification.aiSourceSlug && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">AI Source:</span>
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              {detail.classification.aiSourceSlug}
                            </span>
                          </div>
                        )}
                        {detail.classification.botCategory && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">Bot Category:</span>
                            <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                              {detail.classification.botCategory}
                            </span>
                          </div>
                        )}
                        {detail.classification.referralChain && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">Referral Chain:</span>
                            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                              {detail.classification.referralChain}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CF Signals Section */}
                    <div>
                      <div className="text-xs uppercase text-gray-500 font-medium mb-2">Cloudflare Signals</div>
                      <div className="space-y-2">
                        {detail.cf?.verifiedBot ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">Status:</span>
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                              ✓ Verified Bot
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">Status:</span>
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                              Not Verified
                            </span>
                          </div>
                        )}
                        
                        {detail.cf?.verifiedBotCategory && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">Category:</span>
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              {detail.cf.verifiedBotCategory}
                            </span>
                          </div>
                        )}
                        
                        {detail.cf?.asn && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">ASN:</span>
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                              {detail.cf.asn}
                            </span>
                          </div>
                        )}
                        
                        {detail.cf?.org && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">Organization:</span>
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded max-w-32 truncate" title={detail.cf.org}>
                              {detail.cf.org}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-gray-500 font-medium mb-2">Rule Trace</div>
                      <div className="space-y-2">
                        <div className="text-xs">
                          <span className="text-gray-600">Matched Rule:</span>
                          <code className="ml-1 px-1 py-0.5 bg-gray-100 rounded text-xs">
                            {detail.debug?.matchedRule || '—'}
                          </code>
                        </div>
                        <div className="text-xs text-gray-500">
                          Precedence: {detail.debug?.precedenceOrder?.join(' > ')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Signals Section - Only visible in debug mode */}
                  {debugMode && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs uppercase text-gray-500 font-medium mb-2">Signals</div>
                        <ul className="space-y-1">
                          {(detail.debug?.signals || []).map((signal: string, i: number) => (
                            <li key={i} className="text-xs text-gray-600">
                              • {signal}
                            </li>
                          ))}
                          {(!detail.debug?.signals || detail.debug.signals.length === 0) && (
                            <li className="text-xs text-gray-400">No signals recorded</li>
                          )}
                        </ul>
                        
                        {/* CF Precedence Indicator */}
                        {detail.cf?.verifiedBot && (
                          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                            <div className="text-xs text-green-800 font-medium">
                              🛡️ CF Precedence Applied
                            </div>
                            <div className="text-xs text-green-700 mt-1">
                              Cloudflare verification overrode all other classification signals
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs uppercase text-gray-500 font-medium mb-2">Raw Inputs</div>
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-gray-600">Referrer:</span>
                            <code className="ml-1 px-1 py-0.5 bg-gray-100 rounded">
                              {detail.referrer || '—'}
                            </code>
                          </div>
                          <div>
                            <span className="text-gray-600">User Agent:</span>
                            <code className="ml-1 px-1 py-0.5 bg-gray-100 rounded max-w-xs truncate block">
                              {detail.user_agent || '—'}
                            </code>
                          </div>
                          <div>
                            <span className="text-gray-600">CF Bot Verified:</span>
                            <code className="ml-1 px-1 py-0.5 bg-gray-100 rounded">
                              {String(detail.debug?.cfBot || false)}
                            </code>
                          </div>
                          {detail.cf?.verifiedBot && (
                            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                              <div className="text-xs text-green-800 font-medium">
                                ⚡ CF Precedence: This bot was classified as crawler because Cloudflare verified it, 
                                regardless of user agent or referrer patterns.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs uppercase text-gray-500 font-medium mb-2">Raw JSON</div>
                    <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                      {JSON.stringify(detail, null, 2)}
                    </pre>
                  </div>
                    </div>
                </div>
              )}
            </td>
          </tr>
        )}
      </>
    );
  }

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

  // AI-Lite state
  const [includeBaseline, setIncludeBaseline] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [includeTraining] = useState(true); // Always include AI training bots by default

  // Debug mode state
  const [debugMode, setDebugMode] = useState(false);
  const [showClassificationDetails, setShowClassificationDetails] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showCfOverview, setShowCfOverview] = useState(false);
  
  // Dropdown state
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showBotCategoryDropdown, setShowBotCategoryDropdown] = useState(false);
  const [showCfDropdown, setShowCfDropdown] = useState(false);

  // URL params and filters
  const timeWindow = searchParams.get("window") || getStoredWindow() || "24h";
  const classFilter = searchParams.get("class") || "";
  const sourceFilter = searchParams.get("source") || "";
  const botCategoryFilter = searchParams.get("bot_category") || "";
  const searchQuery = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1");
  
  // CF Signal filters
  const cfVerifiedFilter = searchParams.get("cf_verified") || "";
  const cfCategoryFilter = searchParams.get("cf_category") || "";
  const cfAsnFilter = searchParams.get("cf_asn") || "";
  const cfOrgFilter = searchParams.get("cf_org") || "";

  // Check for include_training URL param
  const includeTrainingFromURL = getIncludeTrainingFromURL(searchParams);

  // Refs for auto-refresh
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  const refreshCount = useRef(0);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setShowSourceDropdown(false);
        setShowBotCategoryDropdown(false);
        setShowCfDropdown(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Initialize includeTraining from URL params (localStorage no longer needed)
  useEffect(() => {
    if (project?.id && includeTrainingFromURL) {
      syncIncludeTrainingFromURL(project.id, searchParams);
    }
  }, [project?.id, includeTrainingFromURL, searchParams]);

  // AI training bots are now always included by default
  // No initialization needed since includeTraining is always true

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

  // Handle include training toggle
  // AI training toggle is no longer needed - bots are always included
  function handleIncludeTrainingToggle(checked: boolean) {
    // This function is kept for compatibility but no longer functional
    // AI training bots are always included by default
  }

  // Calculate correct % AI-Influenced with breakout counts
  function computeAIInfluencedPercent(summary: EventsSummary, includeTraining: boolean) {
    if (!summary) return { percent: 0, humanViaAI: 0, aiTrainingBots: 0 };

    const humanViaAI = summary.by_class.find(c => c.class === 'human_via_ai')?.count || 0;

    // Always count AI training bots (no longer optional)
    let aiTrainingBots = 0;
    if (summary.by_bot_category) {
      aiTrainingBots = summary.by_bot_category.find(c => c.category === 'ai_training')?.count || 0;
    }

    const numerator = humanViaAI + aiTrainingBots;
    const denominator = Math.max(1, summary.totals.events);
    const percent = Math.round((numerator / denominator) * 1000) / 10; // 1 decimal

    return { percent, humanViaAI, aiTrainingBots };
  }

  // API calls
  async function fetchSummary() {
    if (!project?.id) return;

    setSummaryLoading(true);
    try {
      const params = new URLSearchParams({ project_id: project.id, window: timeWindow });
      const response = await fetch(`${API_BASE}/api/events/summary?${params}`, FETCH_OPTS);

      if (response.ok) {
        const data = await response.json();
        console.log('Summary data loaded:', data);
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
        window: timeWindow,
        page: page.toString(),
        pageSize: "200"
      });

      if (classFilter) params.append("class", classFilter);
      if (sourceFilter) params.append("source", sourceFilter);
      if (botCategoryFilter) params.append("botCategory", botCategoryFilter);
      if (searchQuery) params.append("q", searchQuery);
      
      // Add CF signal filters
      if (cfVerifiedFilter) params.append("cf_verified", cfVerifiedFilter);
      if (cfCategoryFilter) params.append("cf_category", cfCategoryFilter);
      if (cfAsnFilter) params.append("cf_asn", cfAsnFilter);
      if (cfOrgFilter) params.append("cf_org", cfOrgFilter);

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
      const params = new URLSearchParams({ project_id: project.id, window: timeWindow });
      const response = await fetch(`${API_BASE}/api/events/has-any?${params}`, FETCH_OPTS);

      if (response.ok) {
        const data = await response.json();
        setHasAny(data.has_any);
      }
    } catch (err) {
      console.error('Failed to fetch has-any:', err);
    }
  }

  // CSV Export function
  async function handleExportCSV(limit: number) {
    if (!project?.id) return;

    try {
      setShowExportDropdown(false);

      const params = new URLSearchParams({
        project_id: project.id,
        limit: limit.toString()
      });

      const response = await fetch(`${API_BASE}/api/events/export.csv?${params}`, FETCH_OPTS);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `events-${project.id}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error(`Export failed: ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to export CSV:', err);
      alert('Failed to export CSV. Please try again.');
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
        });
    }
  }, [project?.id, timeWindow, classFilter, sourceFilter, botCategoryFilter, searchQuery, page, cfVerifiedFilter, cfCategoryFilter, cfAsnFilter, cfOrgFilter]);

  useEffect(() => {
    if (timeWindow && timeWindow !== getStoredWindow()) {
      setStoredWindow(timeWindow);
    }
  }, [timeWindow, project?.id]);

  // Set default AI-only filter for AI-Lite mode
  useEffect(() => {
    if (summary?.ai_lite && !classFilter) {
      // Default to AI-only view in AI-Lite mode
      const aiClasses = ['human_via_ai', 'crawler', 'citation'];
      if (summary.by_class.some(cls => aiClasses.includes(cls.class))) {
        // Set a default AI filter if available
        const firstAIClass = summary.by_class.find(cls => aiClasses.includes(cls.class));
        if (firstAIClass) {
          handleClassFilter(firstAIClass.class);
        }
      }
    }
  }, [summary, classFilter]);

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

  function handleBotCategoryFilter(category: string) {
    updateParams({ bot_category: category === botCategoryFilter ? null : category, page: null });
  }

  // CF Signal filter handlers
  function handleCfVerifiedFilter(verified: string) {
    updateParams({ cf_verified: verified === cfVerifiedFilter ? null : verified, page: null });
  }

  function handleCfCategoryFilter(category: string) {
    updateParams({ cf_category: category === cfCategoryFilter ? null : category, page: null });
  }

  function handleCfAsnFilter(asn: string) {
    updateParams({ cf_asn: asn === cfAsnFilter ? null : asn, page: null });
  }

  function handleCfOrgFilter(org: string) {
    updateParams({ cf_org: org === cfOrgFilter ? null : org, page: null });
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
      case "crawler": return "bg-orange-100 text-orange-800";
      case "search": return "bg-green-100 text-green-800";
      case "human_via_ai": return "bg-violet-100 text-violet-800";
      case "direct_human": return "bg-gray-100 text-gray-600";
      case "unknown": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-600";
    }
  }

  function getTrafficClassLabel(className: string): string {
    switch (className) {
      case "direct_human": return "Direct Human";
      case "human_via_ai": return "Human via AI";
      case "crawler": return "Crawler";
      case "search": return "Search";
      case "unknown": return "Unknown";
      default: return className;
    }
  }

  function getTrafficClassDescription(className: string): string {
    switch (className) {
      case "direct_human": return "No referrer, direct visits";
      case "human_via_ai": return "AI assistant referrers (ChatGPT, Claude, etc.)";
      case "crawler": return "Cloudflare verified bots and crawlers";
      case "search": return "Search engine referrers (Google, Bing, etc.)";
      case "unknown": return "Unclassified traffic";
      default: return "Traffic classification";
    }
  }

  function getBotCategoryLabel(category: string): string {
    switch (category) {
      case "ai_training": return "AI Training";
      case "search_crawler": return "Search Crawler";
      case "preview_bot": return "Preview Bot";
      case "uptime_monitor": return "Uptime Monitor";
      case "seo_tool": return "SEO Tool";
      case "archiver": return "Archiver";
      case "security": return "Security";
      case "marketing": return "Marketing";
      case "accessibility": return "Accessibility";
      case "research": return "Research";
      case "other": return "Other";
      default: return category;
    }
  }

  function getBotCategoryColor(category: string): string {
    switch (category) {
      case "ai_training": return "bg-purple-100 text-purple-800 border-purple-200";
      case "search_crawler": return "bg-blue-100 text-blue-800 border-blue-200";
      case "preview_bot": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "uptime_monitor": return "bg-green-100 text-green-800 border-green-200";
      case "seo_tool": return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "archiver": return "bg-gray-100 text-gray-800 border-gray-200";
      case "security": return "bg-red-100 text-red-800 border-red-200";
      case "marketing": return "bg-pink-100 text-pink-800 border-pink-200";
      case "accessibility": return "bg-teal-100 text-teal-800 border-teal-200";
      case "research": return "bg-cyan-100 text-cyan-800 border-cyan-200";
      case "other": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
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
    if (timeWindow === "15m") return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (timeWindow === "24h") return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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
            <p className="text-gray-600">Monitor real-time traffic with hardened AI classification</p>
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
            <p className="text-gray-600">Monitor real-time traffic with hardened AI classification</p>
            {summary?.tracking_mode && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                  {summary.tracking_mode === 'ai-lite' ? 'AI-Lite Mode' : 'Full Tracking Mode'}
                </span>
                {summary.ai_lite && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Info className="h-3 w-3" />
                    <span>Baseline traffic sampled at {summary.baseline?.sample_pct || 2}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Debug Mode Toggle (Admin only) */}
            <div className="flex items-center gap-2">
              <label className={`flex items-center gap-2 text-sm ${debugMode ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Debug Mode
                {debugMode && (
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                    Active
                  </span>
                )}
              </label>
              <div className="relative group">
                <Info className="h-3 w-3 text-gray-400 cursor-help" />
                <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  Auto-expand all rows and show raw classification data
                </div>
              </div>
            </div>

            {/* Classification Details Button */}
            <button
              onClick={() => setShowClassificationDetails(true)}
              className="px-3 py-1 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
            >
              Show Classification Details
            </button>

            {/* CSV Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="px-3 py-1 text-sm text-gray-700 bg-blue-100 hover:bg-blue-200 rounded-md border border-blue-300 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
                <ChevronDown className="h-4 w-4" />
              </button>

              {showExportDropdown && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowExportDropdown(false)}
                  />

                  {/* Dropdown */}
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      <button
                        onClick={() => handleExportCSV(500)}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export 500 most recent
                      </button>
                      <button
                        onClick={() => handleExportCSV(1000)}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export 1000 most recent
                      </button>
                      <button
                        onClick={() => handleExportCSV(1500)}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export 1500 most recent
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* AI-Lite Baseline Toggle */}
            {summary?.ai_lite && (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeBaseline}
                    onChange={(e) => setIncludeBaseline(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Include baseline
                </label>
                <div className="relative group">
                  <Info className="h-4 w-4 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    Baseline (rollup)
                    <br />
                    Totals include all direct/search activity via hourly rollups. For performance, only a small sampled subset of baseline events is retained for detail view (sample: {summary.baseline?.sample_pct || 2}%). AI activity retains full detail.
                  </div>
                </div>
              </div>
            )}

            {/* Refresh Button */}
            <button
              onClick={() => {
                refreshData();
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

        {/* Simplified Hero - AI Detection System */}
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  Classification precedence: CF verified → AI referrer → Params → Search → Direct.
                </span>
                {(summary?.by_class?.find(cls => cls.class === 'crawler')?.count || 0) > 0 && (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                    CF Signals Active
                  </span>
                )}
              </div>
              
              <button
                onClick={() => setShowClassificationDetails(true)}
                className="px-3 py-1 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
              >
                Details
              </button>
            </div>
          </div>
        </Card>

        {/* Compact Filters Toolbar - Sticky */}
        <div className="sticky top-14 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border border-gray-200 rounded-lg p-4 shadow-sm">
          {/* Row 1: Time, Traffic Class, Search */}
          <div className="flex items-center gap-4 mb-3">
            {/* Time segmented control */}
            <div className="flex rounded-lg border border-gray-300">
              {["15m", "24h", "7d"].map((w) => (
                <button
                  key={w}
                  onClick={() => handleWindowChange(w)}
                  className={`px-3 py-2 text-sm font-medium ${timeWindow === w
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                    } ${w === "15m" ? "rounded-l-md" : w === "7d" ? "rounded-r-md" : ""}`}
                >
                  {w}
                </button>
              ))}
            </div>

            {/* Traffic Class segmented */}
            <div className="flex rounded-lg border border-gray-300">
              {["", "crawler", "search", "human_via_ai", "direct_human"].map((cls) => (
                <button
                  key={cls}
                  onClick={() => handleClassFilter(cls)}
                  className={`px-3 py-2 text-sm font-medium ${classFilter === cls
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                    } ${cls === "" ? "rounded-l-md" : cls === "direct_human" ? "rounded-r-md" : ""}`}
                >
                  {cls === "" ? "All" : cls === "crawler" ? "Crawler" : cls === "search" ? "Search" : cls === "human_via_ai" ? "Human via AI" : "Direct"}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search URLs & event types..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Dropdowns */}
          <div className="flex items-center gap-4">
            {/* AI Sources multi-select dropdown */}
            <div className="relative dropdown-container">
              <button 
                onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-2"
              >
                AI Sources {sourceFilter && `• ${sourceFilter.split(',').length}`}
                <ChevronDown className={`h-4 w-4 transition-transform ${showSourceDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showSourceDropdown && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowSourceDropdown(false)}
                  />
                  
                  {/* Dropdown */}
                  <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-40 max-h-60 overflow-y-auto">
                    <div className="py-2">
                      <button
                        onClick={() => {
                          handleSourceFilter("");
                          setShowSourceDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        All Sources
                      </button>
                      {summary?.by_source_top?.map((source) => (
                        <button
                          key={source.slug}
                          onClick={() => {
                            handleSourceFilter(source.slug);
                            setShowSourceDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between"
                        >
                          <span>{source.name}</span>
                          <span className="text-xs text-gray-500">({formatNumber(source.count)})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bot Categories multi-select dropdown */}
            <div className="relative dropdown-container">
              <button 
                onClick={() => setShowBotCategoryDropdown(!showBotCategoryDropdown)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-2"
              >
                Bot Categories {botCategoryFilter && `• ${botCategoryFilter.split(',').length}`}
                <ChevronDown className={`h-4 w-4 transition-transform ${showBotCategoryDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showBotCategoryDropdown && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowBotCategoryDropdown(false)}
                  />
                  
                  {/* Dropdown */}
                  <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-40">
                    <div className="py-2">
                      <button
                        onClick={() => {
                          handleBotCategoryFilter("");
                          setShowBotCategoryDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        All Categories
                      </button>
                      <button
                        onClick={() => {
                          handleBotCategoryFilter("ai_training");
                          setShowBotCategoryDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        AI Training
                      </button>
                      <button
                        onClick={() => {
                          handleBotCategoryFilter("search_crawler");
                          setShowBotCategoryDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Search Crawler
                      </button>
                      <button
                        onClick={() => {
                          handleBotCategoryFilter("preview_bot");
                          setShowBotCategoryDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Preview Bot
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Cloudflare dropdown */}
            <div className="relative dropdown-container">
              <button 
                onClick={() => setShowCfDropdown(!showCfDropdown)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-2"
              >
                Cloudflare {cfVerifiedFilter && "• Active"}
                <ChevronDown className={`h-4 w-4 transition-transform ${showCfDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showCfDropdown && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowCfDropdown(false)}
                  />
                  
                  {/* Dropdown */}
                  <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-40">
                    <div className="py-2">
                      <div className="px-4 py-2 text-sm text-gray-500 border-b">
                        CF Category
                      </div>
                      <button
                        onClick={() => {
                          updateParams({ cf_category: null });
                          setShowCfDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        All Categories
                      </button>
                      <button
                        onClick={() => {
                          updateParams({ cf_category: 'search_crawler' });
                          setShowCfDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Search Crawler
                      </button>
                      <button
                        onClick={() => {
                          updateParams({ cf_category: 'ai_training' });
                          setShowCfDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        AI Training
                      </button>
                      
                      <div className="px-4 py-2 text-sm text-gray-500 border-b mt-2">
                        ASN / Organization
                      </div>
                      <div className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="ASN (e.g., 15169)"
                          value={cfAsnFilter}
                          onChange={(e) => updateParams({ cf_asn: e.target.value || null })}
                          className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Organization"
                          value={cfOrgFilter}
                          onChange={(e) => updateParams({ cf_org: e.target.value || null })}
                          className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* CF Verified Only toggle */}
            <button
              onClick={() => handleCfVerifiedFilter(cfVerifiedFilter === 'true' ? '' : 'true')}
              className={`px-3 py-2 text-sm border rounded-lg ${
                cfVerifiedFilter === 'true' 
                  ? 'bg-green-100 text-green-800 border-green-300' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              🛡️ CF Verified Only
            </button>
          </div>
        </div>

        {/* KPI Row - Essential Stats Only */}
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Bot className="h-5 w-5 text-blue-400" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">AI-Influenced</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatNumber(summary.totals.ai_influenced)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 text-green-600">✓ AI training included</span>
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
                      {(() => {
                        const { percent } = computeAIInfluencedPercent(summary, includeTraining);
                        return `${percent}%`;
                      })()}
                    </p>
                    <div className="text-xs text-gray-500 mt-1">
                      {(() => {
                        const { humanViaAI, aiTrainingBots } = computeAIInfluencedPercent(summary, includeTraining);
                        return `Human: ${humanViaAI} + AI Training: ${aiTrainingBots}`;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* CF Verified Bots - Only show when > 0 */}
            {(() => {
              const cfVerifiedCount = summary?.by_class?.find(cls => cls.class === 'crawler')?.count || 0;
              return cfVerifiedCount > 0;
            })() && (
              <Card>
                <button 
                  onClick={() => handleCfVerifiedFilter('true')}
                  className="w-full p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="h-5 w-5 text-green-600">🛡️</div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">CF Verified Bots</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {summary.by_class.find(cls => cls.class === 'crawler')?.count || 0}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Cloudflare verified • Click to filter</p>
                    </div>
                  </div>
                </button>
              </Card>
            )}
          </div>
        )}

        {/* Baseline Information (AI-Lite Mode) */}
        {summary?.ai_lite && summary.baseline && (
          <Card>
            <div className="p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Baseline Traffic</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500">Direct</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatNumber(summary?.baseline?.direct_events || 0)}
                  </p>
                  <p className="text-xs text-gray-500">rollup data</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500">Search</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatNumber(summary?.baseline?.search_events || 0)}
                  </p>
                  <p className="text-xs text-gray-500">rollup data</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500">Sampled</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatNumber(summary?.baseline?.sampled_rows_retained || 0)}
                  </p>
                  <p className="text-xs text-gray-500">detail rows</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Timeseries Chart */}
        {summary && (
          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Events Over Time</h3>
                {summary?.ai_lite && summary?.baseline && (
                  <div className="text-xs text-gray-500">
                    {includeBaseline ? (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        AI traffic
                        <span className="w-2 h-2 bg-gray-400 rounded-full ml-2"></span>
                        Baseline
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        AI traffic only
                      </span>
                    )}
                  </div>
                )}
              </div>
              {summary?.timeseries.length > 0 ? (
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

        {/* CF Signals Overview - Collapsible by Default */}
        {(() => {
          const cfVerifiedCount = summary?.by_class?.find(cls => cls.class === 'crawler')?.count || 0;
          return cfVerifiedCount > 0;
        })() && (
          <Card>
            <div className="p-4">
              <button
                onClick={() => setShowCfOverview(!showCfOverview)}
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">🛡️</span>
                    <span className="text-lg font-medium text-gray-900">CF Verified: {summary?.by_class?.find(cls => cls.class === 'crawler')?.count || 0} • Precedence: 100%</span>
                  </div>
                </div>
                <span className="text-sm text-gray-500">
                  {showCfOverview ? 'Hide' : 'Show'}
                </span>
              </button>
              
              {showCfOverview && (
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-4">
                    Cloudflare verified bots automatically get classified as crawlers with highest priority, overriding all other signals.
                  </div>
                  {/* TODO: Add category chips and other CF details here */}
                </div>
              )}
            </div>
          </Card>
        )}



        {/* Filter Chips */}
        {summary && (
          <div className="space-y-4">
            {/* Class Chips */}
            {summary?.by_class.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Traffic Classes</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleClassFilter("")}
                    className={`px-3 py-1 rounded-full text-sm border ${!classFilter
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                  >
                    All ({formatNumber(summary?.totals.events || 0)})
                  </button>
                  {summary?.by_class.map((cls) => {
                    const isAIClass = ['human_via_ai', 'crawler', 'citation'].includes(cls.class);
                    const isBaselineClass = ['direct_human', 'search'].includes(cls.class);
                    const showClass = !summary?.ai_lite || isAIClass || (isBaselineClass && includeBaseline);

                    if (!showClass) return null;

                    return (
                      <button
                        key={cls.class}
                        onClick={() => handleClassFilter(cls.class)}
                        className={`px-3 py-1 rounded-full text-sm border ${classFilter === cls.class
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          } ${isBaselineClass ? 'opacity-75' : ''}`}
                        title={getTrafficClassDescription(cls.class)}
                      >
                        {getTrafficClassLabel(cls.class)} ({formatNumber(cls.count)})
                        {isBaselineClass && summary.ai_lite && (
                          <span className="ml-1 text-xs text-gray-500">ⓘ sampled</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* AI-Lite Mode Note */}
                {summary?.ai_lite && (
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    <span>
                      AI-Lite: Baseline sampled at {summary?.baseline?.sample_pct || 2}%
                    </span>
                  </div>
                )}

                {/* Classification Debug Toggle */}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setShowDebugInfo(!showDebugInfo)}
                    className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1 px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                  >
                    <Info className="h-3 w-3" />
                    {showDebugInfo ? 'Hide' : 'Show'} Details
                  </button>
                  {showDebugInfo && (
                    <span className="text-xs text-gray-500">
                      ℹ️ Hover over traffic class badges to see classification reasoning
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Source Chips */}
            {summary?.by_source_top.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">AI Sources</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSourceFilter("")}
                    className={`px-3 py-1 rounded-full text-sm border ${!sourceFilter
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                  >
                    All sources
                  </button>
                  {summary?.by_source_top.slice(0, 6).map((source) => (
                    <button
                      key={source.slug}
                      onClick={() => handleSourceFilter(source.slug)}
                      className={`px-3 py-1 rounded-full text-sm border ${sourceFilter === source.slug
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

            {/* Bot Category Chips */}
            {summary?.by_class.some(cls => cls.class === 'crawler') && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Bot Categories</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleBotCategoryFilter("")}
                    className={`px-3 py-1 rounded-full text-sm border ${!botCategoryFilter
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                  >
                    All bot types
                  </button>
                  {/* We'll populate this dynamically based on available bot categories */}
                  <button
                    onClick={() => handleBotCategoryFilter("ai_training")}
                    className={`px-3 py-1 rounded-full text-sm border ${botCategoryFilter === "ai_training"
                      ? "bg-purple-100 text-purple-800 border-purple-200"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                  >
                    AI Training
                  </button>
                  <button
                    onClick={() => handleBotCategoryFilter("search_crawler")}
                    className={`px-3 py-1 rounded-full text-sm border ${botCategoryFilter === "search_crawler"
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                  >
                    Search Crawler
                  </button>
                  <button
                    onClick={() => handleBotCategoryFilter("preview_bot")}
                    className={`px-3 py-1 rounded-full text-sm border ${botCategoryFilter === "preview_bot"
                      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                  >
                    Preview Bot
                  </button>
                </div>
              </div>
            )}

            {/* CF Signal Filter Chips */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Cloudflare Signals</h4>
              <div className="flex flex-wrap gap-2">
                {/* CF Verification Filter */}
                <button
                  onClick={() => handleCfVerifiedFilter("")}
                  className={`px-3 py-1 rounded-full text-sm border ${!cfVerifiedFilter
                    ? "bg-blue-100 text-blue-800 border-blue-200"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  All CF Status
                </button>
                <button
                  onClick={() => handleCfVerifiedFilter("true")}
                  className={`px-3 py-1 rounded-full text-sm border ${cfVerifiedFilter === "true"
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  ✓ CF Verified Only
                </button>
                <button
                  onClick={() => handleCfVerifiedFilter("false")}
                  className={`px-3 py-1 rounded-full text-sm border ${cfVerifiedFilter === "false"
                    ? "bg-red-100 text-red-800 border-red-200"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  ✗ CF Not Verified
                </button>
              </div>

              {/* CF Category Filter */}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => handleCfCategoryFilter("")}
                  className={`px-3 py-1 rounded-full text-sm border ${!cfCategoryFilter
                    ? "bg-blue-100 text-blue-800 border-blue-200"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  All CF Categories
                </button>
                <button
                  onClick={() => handleCfCategoryFilter("Search Engine Crawler")}
                  className={`px-3 py-1 rounded-full text-sm border ${cfCategoryFilter === "Search Engine Crawler"
                    ? "bg-orange-100 text-orange-800 border-orange-200"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  Search Crawler
                </button>
                <button
                  onClick={() => handleCfCategoryFilter("AI Model Training")}
                  className={`px-3 py-1 rounded-full text-sm border ${cfCategoryFilter === "AI Model Training"
                    ? "bg-purple-100 text-purple-800 border-purple-200"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  AI Training
                </button>
                <button
                  onClick={() => handleCfCategoryFilter("Page Preview")}
                  className={`px-3 py-1 rounded-full text-sm border ${cfCategoryFilter === "Page Preview"
                    ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  Preview Bot
                </button>
              </div>

              {/* CF ASN/Org Filters */}
              <div className="mt-2 flex flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Filter by ASN (e.g., 15169)"
                    value={cfAsnFilter}
                    onChange={(e) => handleCfAsnFilter(e.target.value)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md w-32"
                  />
                  <button
                    onClick={() => handleCfAsnFilter("")}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Filter by Organization"
                    value={cfOrgFilter}
                    onChange={(e) => handleCfOrgFilter(e.target.value)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md w-40"
                  />
                  <button
                    onClick={() => handleCfOrgFilter("")}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

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
              
              {/* CF Filter Status Indicator */}
              {(cfVerifiedFilter || cfCategoryFilter || cfAsnFilter || cfOrgFilter) && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                  <span className="text-xs text-blue-700 font-medium">🛡️ CF Filters Active:</span>
                  <div className="flex flex-wrap gap-1">
                    {cfVerifiedFilter && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {cfVerifiedFilter === 'true' ? '✓ Verified' : '✗ Not Verified'}
                      </span>
                    )}
                    {cfCategoryFilter && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {cfCategoryFilter}
                      </span>
                    )}
                    {cfAsnFilter && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        ASN: {cfAsnFilter}
                      </span>
                    )}
                    {cfOrgFilter && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded max-w-24 truncate" title={cfOrgFilter}>
                        Org: {cfOrgFilter}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Trust Cues - Show breakdown that equals Total Events */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
              <div className="text-xs text-gray-600 mb-2 font-medium">Traffic Breakdown (must equal Total Events)</div>
              <div className="flex flex-wrap gap-3 text-sm">
                {summary?.by_class.map((cls) => {
                  const isAIClass = ['human_via_ai', 'crawler', 'citation'].includes(cls.class);
                  const isBaselineClass = ['direct_human', 'search'].includes(cls.class);
                  const showClass = !summary?.ai_lite || isAIClass || (isBaselineClass && includeBaseline);

                  if (!showClass) return null;

                  return (
                    <div key={cls.class} className="flex items-center gap-1">
                      <span className={`w-3 h-3 rounded-full ${getTrafficClassColor(cls.class).replace('bg-', 'bg-').split(' ')[0]}`}></span>
                      <span className="text-gray-700">{getTrafficClassLabel(cls.class)}:</span>
                      <span className="font-medium">{formatNumber(cls.count)}</span>
                      {isBaselineClass && summary.ai_lite && (
                        <span className="text-xs text-gray-500">(sampled)</span>
                      )}
                      {cls.class === 'crawler' && (
                        <span className="text-xs text-green-600 font-medium">(CF verified)</span>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-gray-700 font-medium">Total:</span>
                  <span className="font-bold">{formatNumber(summary.totals.events)}</span>
                </div>
              </div>
              
              {/* CF Signals Summary */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-600 mb-2 font-medium">Cloudflare Signals Summary</div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <span className="text-gray-700">CF Verified Bots:</span>
                    <span className="font-medium">{summary?.by_class.find(cls => cls.class === 'crawler')?.count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    <span className="text-gray-700">Other Traffic:</span>
                    <span className="font-medium">{summary?.totals.events - (summary?.by_class.find(cls => cls.class === 'crawler')?.count || 0)}</span>
                  </div>
                </div>
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
                        <th className="py-3 pr-4 w-6"></th>
                        <th className="py-3 pr-4">Time</th>
                        <th className="py-3 pr-4">Event</th>
                        <th className="py-3 pr-4">Class</th>
                        <th className="py-3 pr-4">AI Source</th>
                        <th className="py-3 pr-4">CF</th>
                        <th className="py-3 pr-4">URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.items.map((item) => (
                        <EventRow
                          key={item.id}
                          event={item}
                          debugMode={debugMode}
                          summary={summary}
                        />
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

        {/* AI Classification Debug Information */}
        {showDebugInfo && recent && recent.items.length > 0 && (
          <Card>
            <div className="p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">AI Detection System Details</h4>
              <div className="text-xs text-gray-600 space-y-2">
                <p><strong>AI Classification System:</strong> Automatically detects and classifies AI training bots, AI assistant referrers, and search engines with strict precedence order.</p>
                <p><strong>Classification Precedence:</strong> 1) <strong>Cloudflare verified bots (always wins)</strong> → 2) AI referrers → 3) Search engines → 4) Direct human</p>
                <p><strong>AI Source Management:</strong> Automatically creates and maps AI sources for accurate attribution and rollup tracking.</p>
                <p><strong>Debug Trail:</strong> Hover over ℹ️ icons to see classification reasoning for each event.</p>
                <div className="mt-2 p-2 bg-white border border-gray-200 rounded text-xs">
                  <strong>Example classifications:</strong><br />
                  • <code>cf.verifiedBotCategory=Search Engine Crawler</code> → <strong>Crawler (1st priority, CF wins)</strong><br />
                  • <code>ref:chat.openai.com</code> → Human via AI (2nd priority, if no CF)<br />
                  • <code>ref:www.google.com</code> → Search (3rd priority, if no CF/AI)<br />
                  • <code>no referrer</code> → Direct Human (4th priority, default fallback)
                </div>
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                  <strong>System Features:</strong><br />
                  • <strong>Cloudflare bot verification with highest precedence</strong><br />
                  • Automatic CF signal extraction and normalization<br />
                  • Preview bot detection (Slack, Discord, Telegram, etc.)<br />
                  • Automatic AI source creation and mapping<br />
                  • Rollup-based deduplication for crawler events<br />
                  • Comprehensive CF filtering by verification, category, ASN, and organization
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* AI-Lite Baseline Note */}
        {summary?.ai_lite && (
          <Card>
            <div className="p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-1">AI-Lite Mode</p>
                  <p>
                    Baseline events sampled at {summary?.baseline?.sample_pct || 2}% for performance. See rollup data above for totals.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}



        {/* Classification Details Modal */}
        {showClassificationDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Classification Details</h2>
                  <button
                    onClick={() => setShowClassificationDetails(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>

                <div className="prose prose-sm max-w-none">
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Precedence Order</h4>
                  <p className="text-gray-700 mb-4">
                    <code className="px-2 py-1 bg-gray-100 rounded text-sm">
                      CF Verified Bot → Human via AI → Search → Direct Human
                    </code>
                  </p>
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm text-green-800">
                      <strong>Cloudflare Precedence:</strong> CF verified bots get highest priority, overriding all other signals.
                    </p>
                  </div>

                  <h4 className="text-lg font-medium text-gray-900 mb-3">AI Sources (examples)</h4>
                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-100 rounded text-sm">chat.openai.com</code>
                      <span className="text-gray-500">→</span>
                      <strong className="text-blue-600">chatgpt</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-100 rounded text-sm">gemini.google.com</code>
                      <span className="text-gray-500">→</span>
                      <strong className="text-blue-600">google_gemini</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-100 rounded text-sm">www.bing.com/chat</code>
                      <span className="text-gray-500">→</span>
                      <strong className="text-blue-600">microsoft_copilot</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-100 rounded text-sm">www.perplexity.ai</code>
                      <span className="text-gray-500">→</span>
                      <strong className="text-blue-600">perplexity</strong>
                    </li>
                  </ul>

                  <h4 className="text-lg font-medium text-gray-900 mb-3">Bot Categories</h4>
                  <ul className="space-y-2 mb-4">
                    <li><strong className="text-orange-600">AI Training</strong> (e.g., GPTBot, PerplexityBot)</li>
                    <li><strong className="text-orange-600">Search Crawler</strong> (Googlebot, bingbot)</li>
                    <li><strong className="text-orange-600">Preview Bot</strong> (Slack/Discord unfurlers)</li>
                    <li><strong className="text-orange-600">Uptime Monitor</strong> (Pingdom, UptimeRobot)</li>
                    <li><strong className="text-orange-600">SEO Tool</strong> (Ahrefs, SEMrush)</li>
                  </ul>

                  <h4 className="text-lg font-medium text-gray-900 mb-3">Cloudflare Signals</h4>
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800 mb-2">
                      <strong>CF Verification:</strong> Cloudflare provides bot verification signals:
                    </p>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• <strong>Category:</strong> "Search Engine Crawler", "AI Model Training", "Page Preview"</li>
                      <li>• <strong>ASN:</strong> Autonomous System Number</li>
                      <li>• <strong>Organization:</strong> Company name</li>
                    </ul>
                  </div>

                  <p className="text-gray-700">
                    Use Debug Mode to expand rows and see classification details.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
