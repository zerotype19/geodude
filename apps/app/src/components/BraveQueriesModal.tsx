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
      className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-6xl max-h-[90vh] rounded-lg shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-gray-900">🤖 Brave AI Query Log</h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Total: <strong className="text-gray-900">{total}</strong> queries</span>
            <span>•</span>
            <span>Pages cited: <strong className="text-emerald-600">{uniquePaths}</strong></span>
            <span>•</span>
            <span>Web Search: <strong className="text-blue-600">{searchLogs.length}</strong></span>
            {summarizerLogs.length > 0 && (
              <>
                <span>•</span>
                <span>Summarizer: <strong className="text-purple-600">{summarizerLogs.length}</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Run More Section */}
        <div className="border-b border-gray-200 px-6 py-3 bg-white">
          <div className="flex items-center gap-3">
            <input
              value={extraTerms}
              onChange={(e) => setExtraTerms(e.target.value)}
              placeholder="Add custom terms (comma or line separated)"
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-white"
              disabled={running}
            />
            <button
              onClick={() => runMore(10)}
              disabled={running}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 px-4 py-1.5 rounded text-sm font-medium text-white whitespace-nowrap"
            >
              {running ? 'Running...' : 'Run +10 More'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-600">⚠️ {error}</p>
          )}
        </div>

        {/* Query Log Table */}
        <div className="flex-1 overflow-auto bg-white">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
              <p>Loading queries...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">No queries yet</p>
              <p className="text-sm">Add custom terms above and click "Run +10 More" to start</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr className="text-gray-700 text-left text-xs">
                  <th className="py-1.5 px-2 font-medium">Query</th>
                  <th className="py-1.5 px-2 font-medium">API</th>
                  <th className="py-1.5 px-2 font-medium">Status</th>
                  <th className="py-1.5 px-2 font-medium text-right">Duration</th>
                  <th className="py-1.5 px-2 font-medium text-right">Sources</th>
                  <th className="py-1.5 px-2 font-medium text-right">Yours</th>
                  <th className="py-1.5 px-2 font-medium">Your Paths</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr 
                    key={idx} 
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-1.5 px-2 text-gray-900 max-w-xs truncate text-xs" title={log.q}>
                      {log.q}
                    </td>
                    <td className="py-1.5 px-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                        log.api === 'search' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {log.api}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-xs whitespace-nowrap">
                      {log.ok ? (
                        <span className="text-emerald-600 font-medium">{log.status ?? 'OK'}</span>
                      ) : (
                        <span className="text-red-600 font-medium" title={log.error || undefined}>
                          {log.status || 'ERR'}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-600 tabular-nums text-xs whitespace-nowrap">
                      {log.durationMs ? `${log.durationMs}ms` : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-900 tabular-nums text-xs">
                      {log.sourcesTotal ?? 0}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-xs">
                      <span className={log.domainSources && log.domainSources > 0 ? 'text-emerald-600 font-semibold' : 'text-gray-400'}>
                        {log.domainSources ?? 0}
                      </span>
                    </td>
                    <td className="py-1.5 px-2">
                      {log.domainPaths && log.domainPaths.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {log.domainPaths.map((path, pidx) => (
                            <span 
                              key={pidx}
                              className="inline-block bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap"
                            >
                              {path}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 text-sm text-gray-600">
          Using Brave <a href="https://api.search.brave.com" target="_blank" rel="noopener" className="text-blue-600 hover:underline">Web Search API</a> with rate limiting protection
          {total > 0 && ` • ${total} ${total === 1 ? 'query' : 'queries'} executed`}
        </div>
      </div>
    </div>
  );
}

