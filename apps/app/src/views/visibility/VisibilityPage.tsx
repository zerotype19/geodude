import { useEffect, useMemo, useState } from "react";
import { VisibilityAPI, RankingRow, CitationRow } from "@/lib/api";

const assistants = ["perplexity", "chatgpt_search", "claude"] as const;
type Assistant = typeof assistants[number];

export default function VisibilityPage() {
  const [assistant, setAssistant] = useState<Assistant>("perplexity");
  const [rankings, setRankings] = useState<RankingRow[]>([]);
  const [citations, setCitations] = useState<CitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("prj_UHoetismrowc"); // TODO: bind to project switcher
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [rankingsPage, setRankingsPage] = useState(1);
  const [citationsPage, setCitationsPage] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false); // TODO: bind to user role

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    
    Promise.all([
      VisibilityAPI.rankings(assistant, "7d"),
      VisibilityAPI.recentCitations(projectId, 50),
    ]).then(([rankingsRes, citationsRes]) => {
      if (!mounted) return;
      
      // Handle rankings response
      if (rankingsRes && 'rankings' in rankingsRes) {
        setRankings(rankingsRes.rankings || []);
      } else {
        setRankings([]);
      }
      
      // Handle citations response
      if (Array.isArray(citationsRes)) {
        setCitations(citationsRes || []);
      } else {
        setCitations([]);
      }
    }).catch(error => {
      console.error('Error fetching visibility data:', error);
      if (mounted) {
        setError('Failed to load visibility data. Please try again.');
        setRankings([]);
        setCitations([]);
      }
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    
    return () => { mounted = false; };
  }, [assistant, projectId]);

  const kpi = useMemo(() => {
    const domains = new Set(rankings.map(r => r.domain));
    const totalMentions = rankings.reduce((s, r) => s + (r.mentions || 0), 0);
    return { uniqueDomains: domains.size, totalMentions };
  }, [rankings]);

  const handleRollup = async () => {
    try {
      setLoading(true);
      const result = await VisibilityAPI.rollupToday();
      if (result.success) {
        // Refresh data
        window.location.reload();
      } else {
        setError('Failed to run rollup. Please try again.');
      }
    } catch (error) {
      setError('Failed to run rollup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI Visibility Intelligence</h1>
        <div className="flex gap-2">
          {assistants.map(a => (
            <button
              key={a}
              onClick={() => setAssistant(a)}
              className={`px-3 py-1 rounded-full border ${
                assistant === a 
                  ? "bg-black text-white" 
                  : "bg-white hover:bg-gray-50"
              }`}
              title={a}
            >
              {a.replace("_", " ")}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={handleRollup}
              disabled={loading}
              className="px-3 py-1 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Running...' : 'Run Rollup'}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI title="Unique Domains (7d)" value={kpi.uniqueDomains} />
        <KPI title="Mentions (7d)" value={kpi.totalMentions} />
        <KPI title="Assistants" value={assistants.length} />
      </section>

      {/* Rankings + Citations */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Top Domains — {assistant.replace("_", " ")}</h2>
            <button
              onClick={() => {
                const url = `${import.meta.env.VITE_API_BASE}/api/visibility/rankings/export?assistant=${assistant}&period=7d&format=csv&limit=100`;
                window.open(url, '_blank');
              }}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border"
            >
              📥 CSV
            </button>
          </div>
          {loading ? <Skeleton rows={8} /> : <RankingsTable rows={rankings} onDomainClick={setSelectedDomain} page={rankingsPage} onPageChange={setRankingsPage} />}
        </div>

        <div className="border rounded-2xl p-4 shadow-sm">
          <h2 className="font-medium mb-3">Recent Citations</h2>
          {loading ? <Skeleton rows={8} /> : <CitationsList rows={citations} />}
        </div>
      </section>

      {/* Domain Score Drawer */}
      {selectedDomain && (
        <DomainScoreDrawer 
          domain={selectedDomain} 
          open={!!selectedDomain}
          onClose={() => setSelectedDomain(null)}
        />
      )}
    </div>
  );
}

function KPI({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="border rounded-2xl p-4 shadow-sm bg-white">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function RankingsTable({ 
  rows, 
  onDomainClick,
  page = 1,
  onPageChange
}: { 
  rows: RankingRow[]; 
  onDomainClick: (domain: string) => void;
  page?: number;
  onPageChange?: (page: number) => void;
}) {
  if (!rows.length) return <EmptyState text="No rankings yet. Try running a rollup or wait for tonight's rollup." />;
  
  const itemsPerPage = 25;
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRows = rows.slice(startIndex, endIndex);
  const totalPages = Math.ceil(rows.length / itemsPerPage);
  
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Domain</th>
            <th className="py-2 pr-2">Mentions</th>
            <th className="py-2 pr-2">% Share</th>
          </tr>
        </thead>
        <tbody>
          {paginatedRows.map(r => (
            <tr key={`${r.week_start || r.week}-${r.assistant}-${r.domain}`} className="border-t hover:bg-gray-50">
              <td className="py-2 pr-2">{r.domain_rank}</td>
              <td className="py-2 pr-2">
                <button 
                  onClick={() => onDomainClick(r.domain)}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  {r.domain}
                </button>
              </td>
              <td className="py-2 pr-2">{r.mentions || r.mentions_count}</td>
              <td className="py-2 pr-2">{r.share_pct?.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {totalPages > 1 && onPageChange && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-500">
            Showing {startIndex + 1}-{Math.min(endIndex, rows.length)} of {rows.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CitationsList({ rows }: { rows: CitationRow[] }) {
  if (!rows.length) return <EmptyState text="No recent citations yet for this project." />;
  
  const getAssistantColor = (assistant: string) => {
    switch (assistant) {
      case 'perplexity': return 'bg-purple-100 text-purple-800';
      case 'chatgpt_search': return 'bg-green-100 text-green-800';
      case 'claude': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceTypeColor = (sourceType?: string) => {
    switch (sourceType) {
      case 'native': return 'bg-blue-100 text-blue-800';
      case 'heuristic': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <ul className="divide-y max-h-96 overflow-y-auto">
      {rows.map((c, i) => (
        <li key={`${c.assistant}-${i}`} className="py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {c.title || c.source_domain}
              </div>
              <a 
                href={c.url} 
                target="_blank" 
                rel="noreferrer" 
                className="text-xs text-blue-600 hover:text-blue-800 truncate block mt-1"
              >
                {c.url}
              </a>
              {c.snippet && (
                <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {c.snippet}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 items-end">
              <span className={`text-xs px-2 py-1 rounded-full ${getAssistantColor(c.assistant)}`}>
                {c.assistant.replace('_', ' ')}
              </span>
              {c.source_type && (
                <span className={`text-xs px-2 py-1 rounded-full ${getSourceTypeColor(c.source_type)}`}>
                  {c.source_type}
                </span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-gray-500 mt-2">
            {new Date(c.occurred_at).toLocaleString()}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 rounded" />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-gray-500 text-sm">{text}</div>;
}

// Domain Score Drawer Component
function DomainScoreDrawer({ 
  domain, 
  open, 
  onClose 
}: { 
  domain: string; 
  open: boolean; 
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !domain) return;
    
    setLoading(true);
    VisibilityAPI.score(domain)
      .then((d: any) => {
        setData(d && !('error' in d) ? d : null);
      })
      .catch(error => {
        console.error('Error fetching domain score:', error);
        setData(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [domain, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white border-l p-4 overflow-y-auto z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Visibility Score</h3>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      {loading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      ) : !data ? (
        <div className="mt-2 text-sm text-gray-500">
          No score yet for {domain} today.
        </div>
      ) : (
        <div className="mt-3">
          <div className="text-4xl font-bold">{data.scores?.[0]?.score_0_100 || 'N/A'}</div>
          <div className="text-xs text-gray-500 mt-1">
            Assistant: {data.scores?.[0]?.assistant || 'N/A'} • Day: {data.day}
          </div>
          {data.scores?.[0]?.drift_pct !== undefined && (
            <div className="text-xs mt-1">
              Drift: {(data.scores[0].drift_pct || 0).toFixed(2)}%
            </div>
          )}
          {data.scores?.[0]?.citations_count && (
            <div className="text-xs mt-1">
              Citations: {data.scores[0].citations_count}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
