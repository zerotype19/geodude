import { useState, useEffect } from "react";
import { Link, Quote, ExternalLink, Search, Filter, Calendar, BarChart3, Info } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Shell from "../components/Shell";
import { API_BASE, FETCH_OPTS } from '../config';

interface Citation {
  id: number;
  detected_at: string;
  event_class: string;
  source: {
    slug: string;
    name: string;
  };
  content: {
    id: number;
    url: string;
  } | null;
  ref_url: string | null;
  classification_reason?: string;
  classification_confidence?: number;
  debug?: string[];
}

interface CitationSummary {
  totals: {
    citations: number;
    by_source: Array<{ slug: string; name: string; count: number }>;
  };
  top_content: Array<{ content_id: number; url: string; count: number }>;
  timeseries: Array<{ day: string; count: number }>;
}

interface CitationDetail {
  citation: Citation;
  related: {
    recent_for_content: Array<{
      id: number;
      detected_at: string;
      source: { slug: string; name: string };
    }>;
    recent_referrals: Array<{
      id: number;
      detected_at: string;
      ref_url: string | null;
      source: { slug: string; name: string };
    }>;
  };
}

// Traffic classification helper functions
function getTrafficClassColor(className: string): string {
  switch (className) {
    case "ai_agent_crawl": return "bg-orange-100 text-orange-800 border-orange-200";
    case "human_via_ai": return "bg-blue-100 text-blue-800 border-blue-200";
    case "search": return "bg-green-100 text-green-800 border-green-200";
    case "direct_human": return "bg-gray-100 text-gray-800 border-gray-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
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

export default function Citations() {
  const { project } = useAuth();
  const [summary, setSummary] = useState<CitationSummary | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<CitationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filters
  const [window, setWindow] = useState("7d");
  const [sourceFilter, setSourceFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const pageSize = 50;

  useEffect(() => {
    if (project?.id) {
      loadSummary();
      loadCitations();
    }
  }, [project?.id, window, sourceFilter, searchQuery, page]);

  const loadSummary = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/citations/summary?project_id=${project?.id}&window=${window}`, FETCH_OPTS);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to load citations summary:', error);
    }
  };

  const loadCitations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        project_id: project?.id || '',
        window,
        page: page.toString(),
        pageSize: pageSize.toString()
      });

      if (sourceFilter) params.append('source', sourceFilter);
      if (searchQuery.trim()) params.append('q', searchQuery.trim());

      const response = await fetch(`${API_BASE}/api/citations?${params}`, FETCH_OPTS);

      if (response.ok) {
        const data = await response.json();
        setCitations(data.items);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to load citations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCitationDetail = async (citationId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/citations/detail?id=${citationId}`, FETCH_OPTS);

      if (response.ok) {
        const data = await response.json();
        setSelectedCitation(data);
        setDrawerOpen(true);
      }
    } catch (error) {
      console.error('Failed to load citation detail:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getWindowLabel = (w: string) => {
    switch (w) {
      case '15m': return 'Last 15 minutes';
      case '24h': return 'Last 24 hours';
      case '7d': return 'Last 7 days';
      default: return 'Last 7 days';
    }
  };

  if (!project) {
    return (
      <Shell>
        <div className="p-6">
          <div className="text-center py-8">
            <h2 className="text-lg font-medium text-gray-900">No project selected</h2>
            <p className="text-gray-500">Please select a project to view citations.</p>
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
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Quote className="h-6 w-6" />
              Citations & Mentions
            </h1>
            <p className="text-gray-600">Track where your content is referenced in AI tools</p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Hardened AI Detection System Badge */}
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
              Hardened AI Detection System
            </div>
          </div>
        </div>

        {/* KPI Row */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-600">Total Citations</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{summary.totals.citations}</div>
              <div className="text-xs text-gray-500">{getWindowLabel(window)}</div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-gray-600">AI Sources</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{summary.totals.by_source.length}</div>
              <div className="text-xs text-gray-500">Active sources</div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center gap-2">
                <Quote className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-600">Top Content</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{summary.top_content.length}</div>
              <div className="text-xs text-gray-500">Different URLs cited</div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-gray-600">Recent Activity</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {summary.timeseries.slice(-1)[0]?.count || 0}
              </div>
              <div className="text-xs text-gray-500">Citations today</div>
            </div>
          </div>
        )}

        {/* Source Breakdown Chips */}
        {summary && summary.totals.by_source.length > 0 && (
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Sources breakdown</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSourceFilter("");
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-sm ${sourceFilter === ""
                    ? "bg-blue-100 text-blue-800 border-blue-200"
                    : "bg-gray-100 text-gray-700 border-gray-200"
                  } border hover:bg-blue-50`}
              >
                All ({summary.totals.citations})
              </button>
              {summary.totals.by_source.map((source) => (
                <button
                  key={source.slug}
                  onClick={() => {
                    setSourceFilter(source.slug);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-sm ${sourceFilter === source.slug
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : "bg-gray-100 text-gray-700 border-gray-200"
                    } border hover:bg-blue-50`}
                >
                  {source.name} ({source.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search URLs or referrer URLs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-md w-full"
                />
              </div>
            </div>
            <div>
              <select
                value={window}
                onChange={(e) => setWindow(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="15m">Last 15 minutes</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
              </select>
            </div>
            {(sourceFilter || searchQuery.trim()) && (
              <button
                onClick={() => {
                  setSourceFilter("");
                  setSearchQuery("");
                  setPage(1);
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Clear Filters
              </button>
            )}
          </div>
          {(sourceFilter || searchQuery.trim()) && (
            <div className="mt-3 text-sm text-gray-600">
              Active filters: 
              {sourceFilter && <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">{sourceFilter}</span>}
              {searchQuery.trim() && <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">"{searchQuery.trim()}"</span>}
            </div>
          )}
        </div>

        {/* Citations Table */}
        <div className="bg-white rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Detected
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Traffic Class
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Content URL
                  </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Classification
                      </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ref URL
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                    </td>
                  </tr>
                ) : citations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <div className="text-gray-500">
                        <Quote className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <h3 className="text-lg font-medium mb-1">No citations yet</h3>
                        <p className="text-sm">
                          Citations appear when AI tools reference your content. Check our{" "}
                          <a href="/docs/citations" className="text-blue-600 hover:text-blue-800">
                            documentation
                          </a>{" "}
                          to learn how mentions are detected.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  citations.map((citation) => (
                    <tr
                      key={citation.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => loadCitationDetail(citation.id)}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(citation.detected_at)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {citation.source.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${getTrafficClassColor(citation.event_class)}`}>
                            {getTrafficClassLabel(citation.event_class)}
                          </span>
                          {citation.event_class !== 'unknown' && (
                            <div className="relative group">
                              <Info className="h-3 w-3 text-gray-400 cursor-help" />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                                {getTrafficClassDescription(citation.event_class)}
                                {citation.classification_reason && (
                                  <div className="mt-1 pt-1 border-t border-gray-700">
                                    <strong>Reason:</strong> {citation.classification_reason}
                                  </div>
                                )}
                                {citation.classification_confidence && (
                                  <div className="mt-1 pt-1 border-t border-gray-700">
                                    <strong>Confidence:</strong> {(citation.classification_confidence * 100).toFixed(0)}%
                                  </div>
                                )}
                                {citation.debug && citation.debug.length > 0 && (
                                  <div className="mt-1 pt-1 border-t border-gray-700">
                                    <strong>Debug:</strong> {citation.debug.join(', ')}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {citation.content ? (
                          <a
                            href={citation.content.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 truncate max-w-xs block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {citation.content.url}
                          </a>
                        ) : (
                          <span className="text-gray-400">No content linked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                        {citation.classification_reason ? (
                          <span className="truncate block" title={citation.classification_reason}>
                            {citation.classification_reason}
                          </span>
                        ) : (
                          <span className="text-gray-400">No classification reason</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {citation.ref_url ? (
                          <a
                            href={citation.ref_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                            View
                          </a>
                        ) : (
                          <span className="text-gray-400">No link</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} citations
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page * pageSize >= total}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Drawer */}
        {drawerOpen && selectedCitation && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setDrawerOpen(false)} />
            <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl">
              <div className="p-6 space-y-6 h-full overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Citation Details</h2>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Source</h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {selectedCitation.citation.source.name}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Detected</h3>
                    <p className="text-sm text-gray-900">{formatDate(selectedCitation.citation.detected_at)}</p>
                  </div>

                  {selectedCitation.citation.content && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700">Content URL</h3>
                      <a
                        href={selectedCitation.citation.content.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 break-all"
                      >
                        {selectedCitation.citation.content.url}
                      </a>
                    </div>
                  )}

                  {selectedCitation.citation.ref_url && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700">AI Reference URL</h3>
                      <a
                        href={selectedCitation.citation.ref_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 break-all flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {selectedCitation.citation.ref_url}
                      </a>
                    </div>
                  )}

                  {selectedCitation.citation.classification_reason && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700">Classification Reason</h3>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                        {selectedCitation.citation.classification_reason}
                      </p>
                    </div>
                  )}

                  {selectedCitation.citation.classification_confidence && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700">Classification Confidence</h3>
                      <p className="text-sm text-gray-900">{(selectedCitation.citation.classification_confidence * 100).toFixed(1)}%</p>
                    </div>
                  )}

                  {selectedCitation.citation.event_class && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700">Traffic Class</h3>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${getTrafficClassColor(selectedCitation.citation.event_class)}`}>
                          {getTrafficClassLabel(selectedCitation.citation.event_class)}
                        </span>
                        <span className="text-sm text-gray-600">
                          {getTrafficClassDescription(selectedCitation.citation.event_class)}
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedCitation.related.recent_for_content.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700">Recent Citations for This Content</h3>
                      <div className="space-y-2">
                        {selectedCitation.related.recent_for_content.map((item) => (
                          <div key={item.id} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded">
                            <span>{formatDate(item.detected_at)}</span>
                            <span className="font-medium">{item.source.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedCitation.related.recent_referrals.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700">Related Referrals</h3>
                      <div className="space-y-2">
                        {selectedCitation.related.recent_referrals.map((item) => (
                          <div key={item.id} className="text-xs bg-gray-50 p-2 rounded space-y-1">
                            <div className="flex justify-between">
                              <span>{formatDate(item.detected_at)}</span>
                              <span className="font-medium">{item.source.name}</span>
                            </div>
                            {item.ref_url && (
                              <a
                                href={item.ref_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 break-all"
                              >
                                {item.ref_url}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
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
