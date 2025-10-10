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
      className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 w-full max-w-5xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-2xl font-bold text-white">🤖 Brave AI Query Log</h2>
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors text-2xl leading-none px-2"
            >
              ×
            </button>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span>
              Total: <strong className="text-white">{total}</strong> queries
            </span>
            <span>•</span>
            <span>
              Pages cited: <strong className="text-white">{uniquePaths}</strong>
            </span>
            <span>•</span>
            <span>
              Web Search: <strong className="text-indigo-400">{searchLogs.length}</strong>
            </span>
            {summarizerLogs.length > 0 && (
              <>
                <span>•</span>
                <span>
                  Summarizer: <strong className="text-purple-400">{summarizerLogs.length}</strong>
                </span>
              </>
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
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-12 text-zinc-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3"></div>
              <p>Loading queries...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <p className="text-lg mb-2">No queries yet</p>
              <p className="text-sm">Add custom terms above and click "Run +10 More" to start</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
                <tr className="text-zinc-400 text-left border-b border-zinc-800">
                  <th className="py-3 px-3 font-medium">Query</th>
                  <th className="py-3 px-3 font-medium">API</th>
                  <th className="py-3 px-3 font-medium">Status</th>
                  <th className="py-3 px-3 font-medium text-right">Duration</th>
                  <th className="py-3 px-3 font-medium text-right">Sources</th>
                  <th className="py-3 px-3 font-medium text-right">Yours</th>
                  <th className="py-3 px-3 font-medium">Your Paths</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr 
                    key={idx} 
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-3 text-zinc-200 max-w-xs truncate" title={log.q}>
                      {log.q}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`
                        inline-block px-2 py-0.5 rounded text-xs font-medium
                        ${log.api === 'search' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}
                      `}>
                        {log.api}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {log.ok ? (
                        <span className="text-emerald-400 font-medium tabular-nums">{log.status ?? 'OK'}</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-rose-400 font-medium tabular-nums">
                            {log.status || 'ERR'}
                          </span>
                          {log.error && (
                            <span className="text-rose-300 text-xs max-w-[200px] truncate" title={log.error}>
                              {log.error}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-400 tabular-nums">
                      {log.durationMs ? `${log.durationMs}ms` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-300 tabular-nums">
                      {log.sourcesTotal ?? 0}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      <span className={log.domainSources ? 'text-indigo-400 font-medium' : 'text-zinc-600'}>
                        {log.domainSources ?? 0}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs max-w-md">
                      {log.domainPaths && log.domainPaths.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {log.domainPaths.map((path, pidx) => (
                            <span 
                              key={pidx}
                              className="bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20"
                            >
                              {path}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 p-4 bg-zinc-900/50 text-xs text-zinc-500 text-center">
          Using Brave <span className="text-blue-400">Web Search API</span> with AI summary enabled.
          {total > 0 && ` ${total} ${total === 1 ? 'query' : 'queries'} executed.`}
        </div>
      </div>
    </div>
  );
}

