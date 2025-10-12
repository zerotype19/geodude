/**
 * Phase F+ Brave Queries Modal
 * Shows all Brave AI queries with diagnostics, filtering, and pagination
 */

import { useEffect, useState, useRef } from 'react';
import { getBraveQueries, type BraveQueryLog, type QueryBucket, type QueryStatus, type BraveQueriesResponse } from '../services/api';

type Props = {
  auditId: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function BraveQueriesModal({ auditId, isOpen, onClose }: Props) {
  const [data, setData] = useState<BraveQueriesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [bucket, setBucket] = useState<QueryBucket | null>(null);
  const [status, setStatus] = useState<QueryStatus | null>(null);
  
  // Phase F++: Custom queries & rate limit detection
  const [customQueries, setCustomQueries] = useState('');
  const recentRateLimits = data?.items.filter(q => 
    q.queryStatus === 'rate_limited' && Date.now() - (q.ts || 0) < 3600000
  ).length || 0;
  const isRateLimited = recentRateLimits > 5;
  
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch queries when modal opens or filters change
  useEffect(() => {
    if (!isOpen) return;
    
    setLoading(true);
    setError(null);
    
    getBraveQueries(auditId, {
      page,
      pageSize: 50,
      bucket,
      status,
    })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [auditId, isOpen, page, bucket, status]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    
    const focusableEls = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];
    
    firstEl?.focus();
    
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
        }
      }
    };
    
    window.addEventListener('keydown', handleTab);
    return () => window.removeEventListener('keydown', handleTab);
  }, [isOpen, loading]);

  if (!isOpen) return null;

  const buckets: Array<{ value: QueryBucket | null; label: string }> = [
    { value: null, label: 'All' },
    { value: 'brand_core', label: 'Brand' },
    { value: 'product_how_to', label: 'How-to' },
    { value: 'jobs_to_be_done', label: 'Jobs' },
    { value: 'schema_probes', label: 'Schema' },
    { value: 'content_seeds', label: 'Content' },
    { value: 'competitive', label: 'Competitive' },
  ];

  const statuses: Array<{ value: QueryStatus | null; label: string }> = [
    { value: null, label: 'All' },
    { value: 'ok', label: 'OK' },
    { value: 'empty', label: 'No Answer' },
    { value: 'rate_limited', label: 'Rate-Limited' },
    { value: 'error', label: 'Error' },
    { value: 'timeout', label: 'Timeout' },
  ];

  const getStatusColor = (s?: QueryStatus) => {
    switch (s) {
      case 'ok':
        return 'bg-emerald-100 text-emerald-700';
      case 'empty':
        return 'bg-gray-100 text-gray-600';
      case 'rate_limited':
        return 'bg-yellow-100 text-yellow-700';
      case 'error':
        return 'bg-red-100 text-red-700';
      case 'timeout':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getBucketColor = (b?: string) => {
    switch (b) {
      case 'brand_core':
        return 'bg-blue-100 text-blue-700';
      case 'product_how_to':
        return 'bg-purple-100 text-purple-700';
      case 'jobs_to_be_done':
        return 'bg-green-100 text-green-700';
      case 'schema_probes':
        return 'bg-indigo-100 text-indigo-700';
      case 'content_seeds':
        return 'bg-pink-100 text-pink-700';
      case 'competitive':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{ margin: '20px' }}
      >
        {/* Header */}
        <div className="border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Brave AI Queries</h2>
          <div className="flex items-center gap-2">
            {/* Phase F++: Export buttons */}
            <div className="flex gap-2 mr-4">
              <a
                href={`https://api.optiview.ai/v1/audits/${auditId}/brave/queries.csv${bucket ? `?bucket=${bucket}` : ''}${status ? `${bucket ? '&' : '?'}status=${status}` : ''}`}
                download
                className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
              >
                Export CSV
              </a>
              <a
                href={`https://api.optiview.ai/v1/audits/${auditId}/brave/queries.json${bucket ? `?bucket=${bucket}` : ''}${status ? `${bucket ? '&' : '?'}status=${status}` : ''}`}
                download
                className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
              >
                Export JSON
              </a>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Phase F++: Metrics Bar */}
        {data && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-700">Answer Rate:</span>
                <span className="ml-2 font-bold text-emerald-600">
                  {Math.round((data.diagnostics.ok / data.total) * 100)}%
                </span>
              </div>
              <div>
                <span className="text-gray-700">Domain-Hit Rate:</span>
                <span className="ml-2 font-bold text-blue-600">
                  {Math.round((data.items.filter(q => (q.domainSources || 0) > 0).length / data.total) * 100)}%
                </span>
              </div>
              <div>
                <span className="text-gray-700">Pages Cited:</span>
                <span className="ml-2 font-bold text-purple-600">
                  {new Set(data.items.flatMap(q => q.domainPaths || [])).size}
                </span>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {['brand_core','product_how_to','jobs_to_be_done','schema_probes','content_seeds','competitive'].map(b => {
                const bucketItems = data.items.filter(q => q.bucket === b);
                const answered = bucketItems.filter(q => q.queryStatus === 'ok').length;
                if (!bucketItems.length) return null;
                return (
                  <span key={b} className="text-xs px-2 py-1 rounded font-medium bg-gray-100 text-gray-700">
                    {b.replace(/_/g,' ')}: {answered}/{bucketItems.length}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="border-b border-gray-200 p-4 bg-gray-50">
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Bucket</label>
              <div className="flex flex-wrap gap-1">
                {buckets.map((b) => (
                  <button
                    key={b.value || 'all'}
                    onClick={() => {
                      setBucket(b.value);
                      setPage(1);
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      bucket === b.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
              <div className="flex flex-wrap gap-1">
                {statuses.map((s) => (
                  <button
                    key={s.value || 'all'}
                    onClick={() => {
                      setStatus(s.value);
                      setPage(1);
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      status === s.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Diagnostics summary */}
          {data?.diagnostics && (
            <div className="mt-3 flex gap-4 text-xs text-gray-600">
              <span>
                <strong className="text-emerald-600">{data.diagnostics.ok}</strong> OK
              </span>
              <span>•</span>
              <span>
                <strong className="text-gray-600">{data.diagnostics.empty}</strong> No Answer
              </span>
              <span>•</span>
              <span>
                <strong className="text-yellow-600">{data.diagnostics.rate_limited}</strong> RL
              </span>
              <span>•</span>
              <span>
                <strong className="text-red-600">{data.diagnostics.error}</strong> Error
              </span>
              <span>•</span>
              <span>
                <strong className="text-orange-600">{data.diagnostics.timeout}</strong> Timeout
              </span>
            </div>
          )}
        </div>

        {/* Phase F++: Run +10 More & Custom Queries */}
        <div className="border-b border-gray-200 p-4 bg-blue-50">
          <div className="flex items-start gap-4">
            <button
              onClick={async () => {
                try {
                  setLoading(true);
                  const res = await fetch(`https://api.optiview.ai/v1/audits/${auditId}/brave/run-more`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      add: 10,
                      extraTerms: customQueries.split('\n').map(q => q.trim()).filter(Boolean)
                    })
                  });
                  const out = await res.json();
                  if (out.ok) {
                    setPage(1); // refresh
                    alert(`✓ Added ${out.added} new queries`);
                  } else {
                    alert(`⚠ ${out.error || 'Failed to run more queries'}`);
                  }
                } catch (e: any) {
                  alert(`✗ ${e.message}`);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading || isRateLimited}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={isRateLimited ? `Rate limit detected (${recentRateLimits} recent 429s)` : 'Run 10 additional smart queries'}
            >
              {loading ? 'Running...' : isRateLimited ? '⚠ Rate Limited' : 'Run +10 More'}
            </button>

            <div className="flex-1">
              <label className="text-xs font-medium text-gray-700 block mb-1">Custom queries (one per line):</label>
              <textarea
                value={customQueries}
                onChange={e => setCustomQueries(e.target.value)}
                rows={3}
                placeholder="cologuard insurance coverage&#10;cologuard Medicare&#10;cologuard doctor recommendation"
                className="w-full p-2 text-xs border border-gray-300 rounded resize-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-12 text-gray-500">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full"></div>
              <p className="mt-2">Loading queries...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!loading && !error && data && data.items.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {data.total === 0 ? (
                <p>No Brave queries ran for this audit.</p>
              ) : (
                <p>No queries match your filters.</p>
              )}
            </div>
          )}

          {!loading && !error && data && data.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 pr-3 font-semibold text-gray-700">Query</th>
                    <th className="pb-2 px-3 font-semibold text-gray-700">Bucket</th>
                    <th className="pb-2 px-3 font-semibold text-gray-700">Mode</th>
                    <th className="pb-2 px-3 font-semibold text-gray-700 text-right">Results</th>
                    <th className="pb-2 px-3 font-semibold text-gray-700">Status</th>
                    <th className="pb-2 px-3 font-semibold text-gray-700 text-right">ms</th>
                    <th className="pb-2 pl-3 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((query, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-3 text-gray-900">{query.q}</td>
                      <td className="py-2 px-3">
                        {query.bucket && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getBucketColor(query.bucket)}`}>
                            {query.bucket.replace(/_/g, ' ')}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-gray-600 text-xs">{query.api}</td>
                      <td className="py-2 px-3 text-right text-gray-700 tabular-nums">{query.sourcesTotal ?? 0}</td>
                      <td className="py-2 px-3">
                        <span 
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(query.queryStatus)}`}
                          title={
                            query.queryStatus === 'rate_limited' ? `Brave free tier limit hit. Lower queries to 20-30 or upgrade to paid plan. (${recentRateLimits} recent 429s)` :
                            query.queryStatus === 'empty' ? 'Brave returned no answer block for this query. Try broader or how-to variants.' :
                            query.queryStatus === 'timeout' ? `Query exceeded 7s timeout. Check network or increase BRAVE_TIMEOUT_MS.` :
                            query.queryStatus === 'error' ? `HTTP error: ${query.error || 'Unknown'}` :
                            'Query succeeded and returned results'
                          }
                        >
                          {query.queryStatus || 'unknown'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-gray-600 text-xs tabular-nums">{query.durationMs ?? '—'}</td>
                      <td className="py-2 pl-3">
                        {(query.domainSources ?? 0) > 0 ? (
                          <a
                            href={`/a/${auditId}?tab=citations&provider=Brave&query=${encodeURIComponent(query.q)}`}
                            className="text-xs text-blue-600 hover:underline"
                            title={`View ${query.domainSources} citation${query.domainSources === 1 ? '' : 's'} from this query`}
                          >
                            View ({query.domainSources})
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400" title={`This query returned ${query.sourcesTotal ?? 0} sources, but none cited your domain`}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer with pagination */}
        {data && data.total > 0 && (
          <div className="border-t border-gray-200 p-4 flex items-center justify-between bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of {data.total}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  page === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  page === data.totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
