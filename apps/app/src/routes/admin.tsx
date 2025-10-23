import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiDelete } from '../lib/api';

interface Audit {
  id: string;
  root_url: string;
  status: string;
  started_at: string;
  pages_analyzed: number;
  aeo_score: number | null;
  geo_score: number | null;
}

export default function AdminPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'failed' | 'duplicates'>('all');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [_version] = useState('v2.1'); // Force bundle hash change

  // Simple password check (in production, use proper authentication)
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple check - in production, verify against backend
    if (password === 'optiview-admin-2025') {
      setIsAuthenticated(true);
      setAuthError('');
      localStorage.setItem('admin_auth', 'true');
    } else {
      setAuthError('Invalid password');
    }
  };

  // Define functions before early return
  const fetchAudits = async () => {
    try {
      setLoading(true);
      const data = await apiGet<{ audits: Audit[] }>('/api/audits');
      setAudits(data.audits || []);
    } catch (error) {
      console.error('Failed to fetch audits:', error);
      setMessage({ type: 'error', text: 'Failed to load audits' });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // Check if already authenticated
  useEffect(() => {
    const auth = localStorage.getItem('admin_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch audits when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchAudits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-surface-1 rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold  mb-6 text-center">Admin Access</h1>
          <form onSubmit={handleAuth}>
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium muted mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="Enter admin password"
                autoFocus
              />
            </div>
            {authError && (
              <div className="mb-4 p-3 bg-danger-soft text-danger rounded-lg text-sm">
                {authError}
              </div>
            )}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand transition font-medium"
            >
              Access Admin
            </button>
          </form>
        </div>
      </div>
    );
  }

  const deleteAudit = async (auditId: string) => {
    if (!confirm('Are you sure you want to delete this audit and all its data? This cannot be undone.')) {
      return;
    }

    setDeletingIds(prev => new Set(prev).add(auditId));
    try {
      await apiDelete(`/api/admin/audits/${auditId}`);
      showMessage('success', 'Audit deleted successfully');
      fetchAudits();
    } catch (error) {
      console.error('Failed to delete audit:', error);
      showMessage('error', 'Failed to delete audit');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(auditId);
        return next;
      });
    }
  };

  const regeneratePrompts = async (domain: string) => {
    try {
      showMessage('success', `Regenerating prompts for ${domain}...`);
      const data = await apiGet<any>(`/api/llm/prompts?domain=${domain}&refresh=true`);
      
      if (data.meta) {
        showMessage('success', `✅ ${domain}: ${data.meta.industry || 'unknown'} industry, ${data.branded.length} branded + ${data.nonBranded.length} non-branded queries`);
      } else {
        showMessage('error', `Failed to regenerate prompts for ${domain}`);
      }
    } catch (error) {
      console.error('Failed to regenerate prompts:', error);
      showMessage('error', `Failed to regenerate prompts for ${domain}`);
    }
  };

  const regenerateAllPrompts = async () => {
    if (!confirm('Regenerate prompts for all completed audits? This may take a few minutes.')) {
      return;
    }

    const completedAudits = audits.filter(a => a.status === 'completed');
    showMessage('success', `Regenerating prompts for ${completedAudits.length} domains...`);

    for (const audit of completedAudits) {
      const domain = audit.root_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      await regeneratePrompts(domain);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
    }

    showMessage('success', '✅ All prompts regenerated!');
  };

  const rescoreRecent = async () => {
    if (!confirm('Re-score the last 10 completed audits with new production criteria? This may take a minute.')) {
      return;
    }

    try {
      showMessage('success', 'Re-scoring audits...');
      const data = await apiPost<any>('/api/admin/rescore-recent', { limit: 10 });
      
      if (data.ok) {
        const successCount = data.results.filter((r: any) => r.status === 'success').length;
        const errorCount = data.results.filter((r: any) => r.status === 'error').length;
        showMessage('success', `✅ Re-scored ${successCount} audits (${errorCount} errors)`);
        fetchAudits();
      } else {
        showMessage('error', 'Failed to re-score audits');
      }
    } catch (error) {
      console.error('Failed to re-score:', error);
      showMessage('error', 'Failed to re-score audits');
    }
  };

  const deleteFailedAudits = async () => {
    const failedAudits = audits.filter(a => a.status === 'failed');
    if (failedAudits.length === 0) {
      showMessage('error', 'No failed audits to delete');
      return;
    }

    if (!confirm(`Delete ${failedAudits.length} failed audits? This cannot be undone.`)) {
      return;
    }

    showMessage('success', `Deleting ${failedAudits.length} failed audits...`);

    for (const audit of failedAudits) {
      try {
        await apiDelete(`/api/admin/audits/${audit.id}`);
      } catch (error) {
        console.error(`Error deleting ${audit.id}:`, error);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    showMessage('success', `✅ Deleted ${failedAudits.length} failed audits`);
    // Refresh once at the end
    fetchAudits();
  };

  const getDuplicates = () => {
    const grouped = audits.reduce((acc, audit) => {
      const key = audit.root_url;
      if (!acc[key]) acc[key] = [];
      acc[key].push(audit);
      return acc;
    }, {} as Record<string, Audit[]>);

    return Object.values(grouped).filter(group => group.length > 1);
  };

  const filteredAudits = () => {
    switch (filter) {
      case 'failed':
        return audits.filter(a => a.status === 'failed');
      case 'duplicates':
        return getDuplicates().flat();
      default:
        return audits;
    }
  };

  const stats = {
    total: audits.length,
    completed: audits.filter(a => a.status === 'completed').length,
    running: audits.filter(a => a.status === 'running').length,
    failed: audits.filter(a => a.status === 'failed').length,
    duplicates: getDuplicates().length,
  };

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold ">Admin Dashboard</h1>
          <p className="mt-2 muted">System management and audit cleanup</p>
        </div>

        {/* System Health & Monitoring */}
        <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-bold  mb-4 flex items-center gap-2">
            <span>🏥</span> System Health & Monitoring
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Classifier Health */}
            <a
              href="/admin/health"
              className="block bg-surface-1 p-4 rounded-lg shadow-sm hover:shadow-md transition border border-blue-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">🧠</div>
                <div>
                  <div className="font-semibold ">Classifier Health</div>
                  <div className="text-sm muted">V2 metrics, alerts, cache hit rate</div>
                </div>
              </div>
            </a>

            {/* Classifier Compare */}
            <a
              href="/admin/classifier-compare"
              className="block bg-surface-1 p-4 rounded-lg shadow-sm hover:shadow-md transition border border-blue-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">🔍</div>
                <div>
                  <div className="font-semibold ">Classifier Compare</div>
                  <div className="text-sm muted">Legacy vs V2 side-by-side</div>
                </div>
              </div>
            </a>

            {/* API Health Check */}
            <a
              href="https://api.optiview.ai/api/admin/classifier-health"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-surface-1 p-4 rounded-lg shadow-sm hover:shadow-md transition border border-blue-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">📊</div>
                <div>
                  <div className="font-semibold ">API Health JSON</div>
                  <div className="text-sm muted">Raw metrics endpoint →</div>
                </div>
              </div>
            </a>

            {/* Bot Documentation */}
            <a
              href="https://api.optiview.ai/bot"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-surface-1 p-4 rounded-lg shadow-sm hover:shadow-md transition border border-green-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">🤖</div>
                <div>
                  <div className="font-semibold ">Bot Documentation</div>
                  <div className="text-sm muted">OptiviewAuditBot info →</div>
                </div>
              </div>
            </a>

            {/* Re-score Recent Audits */}
            <button
              onClick={rescoreRecent}
              className="block w-full bg-surface-1 p-4 rounded-lg shadow-sm hover:shadow-md transition border border-purple-100 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">🔄</div>
                <div>
                  <div className="font-semibold ">Re-score Recent</div>
                  <div className="text-sm muted">Re-compute last 10 audits (all criteria live)</div>
                </div>
              </div>
            </button>

            {/* Cloudflare Analytics */}
            <a
              href="https://dash.cloudflare.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-surface-1 p-4 rounded-lg shadow-sm hover:shadow-md transition border border-orange-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">☁️</div>
                <div>
                  <div className="font-semibold ">Cloudflare Dashboard</div>
                  <div className="text-sm muted">Worker logs, D1, KV →</div>
                </div>
              </div>
            </a>

            {/* Worker Logs */}
            <a
              href="https://dash.cloudflare.com/workers/view/optiview-audit-worker"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-surface-1 p-4 rounded-lg shadow-sm hover:shadow-md transition border border-purple-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">📝</div>
                <div>
                  <div className="font-semibold ">Worker Logs</div>
                  <div className="text-sm muted">Real-time logs & errors →</div>
                </div>
              </div>
            </a>

            {/* Prompts Compare (NEW) */}
            <a
              href="/admin/prompts-compare"
              className="block bg-surface-1 p-4 rounded-lg shadow-sm hover:shadow-md transition border border-green-100 ring-2 ring-green-200"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">✨</div>
                <div>
                  <div className="font-semibold  flex items-center gap-2">
                    Prompts Compare
                    <span className="text-xs bg-success-soft text-success px-2 py-0.5 rounded-full font-medium">NEW</span>
                  </div>
                  <div className="text-sm muted">Rules | AI | Blended side-by-side</div>
                </div>
              </div>
            </a>

            {/* System Status API */}
            <a
              href="https://api.optiview.ai/api/admin/system-status"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-surface-1 p-4 rounded-lg shadow-sm hover:shadow-md transition border border-teal-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">💚</div>
                <div>
                  <div className="font-semibold ">System Status JSON</div>
                  <div className="text-sm muted">Full system overview →</div>
                </div>
              </div>
            </a>

            {/* Bot Info */}
            <a
              href="https://api.optiview.ai/.well-known/optiview-bot.json"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-surface-1 p-4 rounded-lg shadow-sm hover:shadow-md transition border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">🔧</div>
                <div>
                  <div className="font-semibold ">Bot Metadata</div>
                  <div className="text-sm muted">Machine-readable info →</div>
                </div>
              </div>
            </a>

            {/* Google Analytics */}
            <a
              href="https://analytics.google.com/analytics/web/#/p467849140"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-surface-1 p-4 rounded-lg shadow-sm hover:shadow-md transition border border-yellow-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">📈</div>
                <div>
                  <div className="font-semibold ">Google Analytics</div>
                  <div className="text-sm muted">Traffic & usage stats →</div>
                </div>
              </div>
            </a>
          </div>
          
          {/* Quick Stats Row */}
          <div className="mt-6 pt-6 border-t border-blue-200">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
              <div>
                <div className="muted">Worker Version</div>
                <div className="font-mono text-xs ">dce747bb</div>
              </div>
              <div>
                <div className="muted">V4 Pipeline</div>
                <div className="font-semibold text-success flex items-center gap-1">
                  ✓ Active
                  <span className="text-xs bg-success-soft text-success px-1.5 py-0.5 rounded">Blended</span>
                </div>
              </div>
              <div>
                <div className="muted">MSS V2 Fallback</div>
                <div className="font-semibold text-success">✓ Live</div>
              </div>
              <div>
                <div className="muted">Industry Detection</div>
                <div className="font-semibold text-success">✓ 18+ Verticals</div>
              </div>
              <div>
                <div className="muted">Cron Jobs</div>
                <div className="font-semibold text-success">✓ Hourly</div>
              </div>
              <div>
                <div className="muted">Citations</div>
                <div className="font-semibold text-success">✓ 3 Sources</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="muted">Auto-Finalize</div>
                <div className="font-mono ">Hourly @ :00</div>
              </div>
              <div>
                <div className="muted">Prompt Refresh</div>
                <div className="font-mono ">Hourly @ :00</div>
              </div>
              <div>
                <div className="muted">Quality Gates</div>
                <div className="font-semibold text-success">Leak=0, Plural=0</div>
              </div>
              <div>
                <div className="muted">Realism Avg</div>
                <div className="font-semibold text-success">0.85-0.95</div>
              </div>
            </div>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
          }`}>
            {message.text}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-surface-1 p-4 rounded-lg shadow">
            <div className="text-2xl font-bold ">{stats.total}</div>
            <div className="text-sm muted">Total Audits</div>
          </div>
          <div className="bg-surface-1 p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-success">{stats.completed}</div>
            <div className="text-sm muted">Completed</div>
          </div>
          <div className="bg-surface-1 p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-brand">{stats.running}</div>
            <div className="text-sm muted">Running</div>
          </div>
          <div className="bg-surface-1 p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-danger">{stats.failed}</div>
            <div className="text-sm muted">Failed</div>
          </div>
          <div className="bg-surface-1 p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-orange-600">{stats.duplicates}</div>
            <div className="text-sm muted">Duplicate Groups</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-8 flex flex-wrap gap-4">
          <button
            onClick={regenerateAllPrompts}
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand transition"
          >
            🔄 Regenerate All Prompts
          </button>
          <button
            onClick={deleteFailedAudits}
            className="btn-primary bg-danger hover:opacity-90"
          >
            🗑️ Delete All Failed Audits
          </button>
          <button
            onClick={fetchAudits}
            className="btn-secondary"
          >
            ↻ Refresh List
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 border-b border-border">
          {(['all', 'failed', 'duplicates'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 font-medium transition ${
                filter === f
                  ? 'text-brand border-b-2 border-blue-600'
                  : 'muted hover:'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Audits Table */}
        <div className="bg-surface-1 rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center muted">Loading audits...</div>
          ) : (
            <div className="table-wrap">
              <table className="ui">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Status</th>
                    <th>Pages</th>
                    <th>AEO / GEO</th>
                    <th>Started</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudits().map(audit => (
                    <tr key={audit.id} className="hover:bg-surface-2">
                      <td className="px-6 py-4">
                        <a
                          href={`/audits/${audit.id}`}
                          className="text-brand hover:underline font-medium"
                        >
                          {audit.root_url}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          audit.status === 'completed' ? 'bg-success-soft text-success' :
                          audit.status === 'running' ? 'bg-brand-soft text-brand' :
                          'bg-danger-soft text-danger'
                        }`}>
                          {audit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm ">{audit.pages_analyzed}</td>
                      <td className="px-6 py-4 text-sm ">
                        {audit.aeo_score !== null && audit.geo_score !== null
                          ? `${Math.round(audit.aeo_score)} / ${Math.round(audit.geo_score)}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm muted">
                        {new Date(audit.started_at + 'Z').toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => deleteAudit(audit.id)}
                          disabled={deletingIds.has(audit.id)}
                          className="text-danger hover:opacity-80 disabled:opacity-50"
                        >
                          {deletingIds.has(audit.id) ? 'Deleting...' : '🗑️ Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

