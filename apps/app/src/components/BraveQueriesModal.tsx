/**
 * Brave AI Queries Modal (Phase F+)
 * Shows detailed query logs with run-more functionality
 */

import { useEffect, useState } from 'react';
import { getBraveQueries, runMoreBrave, BraveQueryLog, getAudit } from '../services/api';

interface Props {
  auditId: string;
  onClose: () => void;
  onUpdate?: () => void; // Callback to refresh parent audit data
}

export default function BraveQueriesModal({ auditId, onClose, onUpdate }: Props) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<BraveQueryLog[]>([]);
  const [extraTerms, setExtraTerms] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getBraveQueries(auditId);
      setLogs(res.queries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queries');
    } finally {
      setLoading(false);
    }
  }

  async function runMore(count: number = 10) {
    if (running) return;
    
    setRunning(true);
    setError(null);
    
    try {
      const terms = extraTerms
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(Boolean);
      
      await runMoreBrave(auditId, count, terms);
      setExtraTerms('');
      await load();
      
      // Notify parent to refresh audit data (updates header chip)
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run more queries');
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    load();
  }, [auditId]);

  const total = logs.length;
  const uniquePaths = Array.from(new Set(logs.flatMap(l => l.domainPaths ?? []))).length;
  const searchLogs = logs.filter(l => l.api === 'search');
  const summarizerLogs = logs.filter(l => l.api === 'summarizer');

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 w-full max-w-6xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-zinc-700 p-6 bg-gradient-to-r from-zinc-900 to-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🤖</span>
              <h2 className="text-2xl font-bold text-white">Brave AI Query Log</h2>
            </div>
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors text-3xl leading-none w-10 h-10 flex items-center justify-center rounded-lg hover:bg-zinc-800"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
              <span className="text-zinc-400">Total:</span>
              <strong className="text-white text-base">{total}</strong>
              <span className="text-zinc-500">queries</span>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <span className="text-emerald-400">Pages cited:</span>
              <strong className="text-emerald-300 text-base">{uniquePaths}</strong>
            </div>
            <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
              <span className="text-blue-400">Web Search:</span>
              <strong className="text-blue-300 text-base">{searchLogs.length}</strong>
            </div>
            {summarizerLogs.length > 0 && (
              <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20">
                <span className="text-purple-400">Summarizer:</span>
                <strong className="text-purple-300 text-base">{summarizerLogs.length}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Run More Section */}
        <div className="border-b border-zinc-800 p-4 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <input
              value={extraTerms}
              onChange={(e) => setExtraTerms(e.target.value)}
              placeholder="Add custom terms (comma or line separated)"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              disabled={running}
            />
            <button
              onClick={() => runMore(10)}
              disabled={running}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 disabled:text-zinc-500 px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors whitespace-nowrap"
            >
              {running ? 'Running...' : 'Run +10 More'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-rose-400">⚠️ {error}</p>
          )}
        </div>

        {/* Query Log Table */}
        <div className="flex-1 overflow-auto p-6 bg-zinc-950">
          {loading ? (
            <div className="text-center py-16 text-zinc-400">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mb-4"></div>
              <p className="text-lg">Loading queries...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-zinc-400">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-xl mb-2 text-white">No queries yet</p>
              <p className="text-sm text-zinc-500">Add custom terms above and click "Run +10 More" to start</p>
            </div>
          ) : (
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-800 backdrop-blur">
                  <tr className="text-zinc-300 text-left border-b border-zinc-700">
                    <th className="py-4 px-4 font-semibold text-xs uppercase tracking-wider">Query</th>
                    <th className="py-4 px-4 font-semibold text-xs uppercase tracking-wider">API</th>
                    <th className="py-4 px-4 font-semibold text-xs uppercase tracking-wider">Status</th>
                    <th className="py-4 px-4 font-semibold text-xs uppercase tracking-wider text-right">Duration</th>
                    <th className="py-4 px-4 font-semibold text-xs uppercase tracking-wider text-right">Sources</th>
                    <th className="py-4 px-4 font-semibold text-xs uppercase tracking-wider text-right">Yours</th>
                    <th className="py-4 px-4 font-semibold text-xs uppercase tracking-wider">Your Paths</th>
                  </tr>
                </thead>
                <tbody>
                {logs.map((log, idx) => (
                  <tr 
                    key={idx} 
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="text-zinc-100 font-medium max-w-sm truncate" title={log.q}>
                        {log.q}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`
                        inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold
                        ${log.api === 'search' 
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'}
                      `}>
                        {log.api}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {log.ok ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                          <span className="text-emerald-400 font-semibold tabular-nums">{log.status ?? 'OK'}</span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-400 mt-1"></div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-rose-400 font-semibold tabular-nums">
                              {log.status || 'ERR'}
                            </span>
                            {log.error && (
                              <span className="text-rose-300/80 text-xs max-w-[180px] truncate" title={log.error}>
                                {log.error}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-zinc-300 tabular-nums font-mono text-xs">
                        {log.durationMs ? `${log.durationMs}ms` : '—'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-zinc-300 tabular-nums font-medium">
                        {log.sourcesTotal ?? 0}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={`tabular-nums font-bold ${
                        log.domainSources && log.domainSources > 0
                          ? 'text-emerald-400' 
                          : 'text-zinc-600'
                      }`}>
                        {log.domainSources ?? 0}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {log.domainPaths && log.domainPaths.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {log.domainPaths.map((path, pidx) => (
                            <span 
                              key={pidx}
                              className="inline-flex items-center bg-emerald-500/10 text-emerald-300 px-2 py-1 rounded-md text-xs font-medium border border-emerald-500/20"
                            >
                              {path}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-700 px-6 py-4 bg-zinc-900 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-zinc-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>
              Using Brave <span className="text-blue-400 font-medium">Web Search API</span> with rate limiting protection
            </span>
          </div>
          {total > 0 && (
            <div className="text-zinc-500">
              {total} {total === 1 ? 'query' : 'queries'} • {uniquePaths} {uniquePaths === 1 ? 'page' : 'pages'} cited
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

