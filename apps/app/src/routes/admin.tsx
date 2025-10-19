import { useState, useEffect, useCallback } from 'react';

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
      const response = await fetch('https://api.optiview.ai/api/audits');
      const data = await response.json();
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Admin Access</h1>
          <form onSubmit={handleAuth}>
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter admin password"
                autoFocus
              />
            </div>
            {authError && (
              <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
                {authError}
              </div>
            )}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
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
      const response = await fetch(`https://api.optiview.ai/api/admin/audits/${auditId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showMessage('success', 'Audit deleted successfully');
        fetchAudits();
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to delete audit');
      }
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
      const response = await fetch(`https://api.optiview.ai/api/llm/prompts?domain=${domain}&refresh=true`);
      const data = await response.json();
      
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
        const response = await fetch(`https://api.optiview.ai/api/admin/audits/${audit.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          console.error(`Failed to delete ${audit.id}`);
        }
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">System management and audit cleanup</p>
        </div>

        {/* System Health & Monitoring */}
        <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>🏥</span> System Health & Monitoring
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Classifier Health */}
            <a
              href="/admin/health"
              className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border border-blue-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">🧠</div>
                <div>
                  <div className="font-semibold text-gray-900">Classifier Health</div>
                  <div className="text-sm text-gray-600">V2 metrics, alerts, cache hit rate</div>
                </div>
              </div>
            </a>

            {/* Classifier Compare */}
            <a
              href="/admin/classifier-compare"
              className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border border-blue-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">🔍</div>
                <div>
                  <div className="font-semibold text-gray-900">Classifier Compare</div>
                  <div className="text-sm text-gray-600">Legacy vs V2 side-by-side</div>
                </div>
              </div>
            </a>

            {/* API Health Check */}
            <a
              href="https://api.optiview.ai/api/admin/classifier-health"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border border-blue-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">📊</div>
                <div>
                  <div className="font-semibold text-gray-900">API Health JSON</div>
                  <div className="text-sm text-gray-600">Raw metrics endpoint →</div>
                </div>
              </div>
            </a>

            {/* Bot Documentation */}
            <a
              href="https://api.optiview.ai/bot"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border border-green-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">🤖</div>
                <div>
                  <div className="font-semibold text-gray-900">Bot Documentation</div>
                  <div className="text-sm text-gray-600">OptiviewAuditBot info →</div>
                </div>
              </div>
            </a>

            {/* Cloudflare Analytics */}
            <a
              href="https://dash.cloudflare.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border border-orange-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">☁️</div>
                <div>
                  <div className="font-semibold text-gray-900">Cloudflare Dashboard</div>
                  <div className="text-sm text-gray-600">Worker logs, D1, KV →</div>
                </div>
              </div>
            </a>

            {/* Worker Logs */}
            <a
              href="https://dash.cloudflare.com/workers/view/optiview-audit-worker"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border border-purple-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">📝</div>
                <div>
                  <div className="font-semibold text-gray-900">Worker Logs</div>
                  <div className="text-sm text-gray-600">Real-time logs & errors →</div>
                </div>
              </div>
            </a>

            {/* Prompts Compare (NEW) */}
            <a
              href="/admin/prompts-compare"
              className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border border-green-100 ring-2 ring-green-200"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">✨</div>
                <div>
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    Prompts Compare
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">NEW</span>
                  </div>
                  <div className="text-sm text-gray-600">Rules | AI | Blended side-by-side</div>
                </div>
              </div>
            </a>

            {/* System Status API */}
            <a
              href="https://api.optiview.ai/api/admin/system-status"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border border-teal-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">💚</div>
                <div>
                  <div className="font-semibold text-gray-900">System Status JSON</div>
                  <div className="text-sm text-gray-600">Full system overview →</div>
                </div>
              </div>
            </a>

            {/* Bot Info */}
            <a
              href="https://api.optiview.ai/.well-known/optiview-bot.json"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">🔧</div>
                <div>
                  <div className="font-semibold text-gray-900">Bot Metadata</div>
                  <div className="text-sm text-gray-600">Machine-readable info →</div>
                </div>
              </div>
            </a>

            {/* Google Analytics */}
            <a
              href="https://analytics.google.com/analytics/web/#/p467849140"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border border-yellow-100"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">📈</div>
                <div>
                  <div className="font-semibold text-gray-900">Google Analytics</div>
                  <div className="text-sm text-gray-600">Traffic & usage stats →</div>
                </div>
              </div>
            </a>
          </div>
          
          {/* Quick Stats Row */}
          <div className="mt-6 pt-6 border-t border-blue-200">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Worker Version</div>
                <div className="font-mono text-xs text-gray-900">dce747bb</div>
              </div>
              <div>
                <div className="text-gray-600">V4 Pipeline</div>
                <div className="font-semibold text-green-600 flex items-center gap-1">
                  ✓ Active
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Blended</span>
                </div>
              </div>
              <div>
                <div className="text-gray-600">MSS V2 Fallback</div>
                <div className="font-semibold text-green-600">✓ Live</div>
              </div>
              <div>
                <div className="text-gray-600">Industry Detection</div>
                <div className="font-semibold text-green-600">✓ 18+ Verticals</div>
              </div>
              <div>
                <div className="text-gray-600">Cron Jobs</div>
                <div className="font-semibold text-green-600">✓ Hourly</div>
              </div>
              <div>
                <div className="text-gray-600">Citations</div>
                <div className="font-semibold text-green-600">✓ 3 Sources</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-gray-600">Auto-Finalize</div>
                <div className="font-mono text-gray-900">Hourly @ :00</div>
              </div>
              <div>
                <div className="text-gray-600">Prompt Refresh</div>
                <div className="font-mono text-gray-900">Hourly @ :00</div>
              </div>
              <div>
                <div className="text-gray-600">Quality Gates</div>
                <div className="font-semibold text-green-600">Leak=0, Plural=0</div>
              </div>
              <div>
                <div className="text-gray-600">Realism Avg</div>
                <div className="font-semibold text-green-600">0.85-0.95</div>
              </div>
            </div>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Audits</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
            <div className="text-sm text-gray-600">Running</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-orange-600">{stats.duplicates}</div>
            <div className="text-sm text-gray-600">Duplicate Groups</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-8 flex flex-wrap gap-4">
          <button
            onClick={regenerateAllPrompts}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            🔄 Regenerate All Prompts
          </button>
          <button
            onClick={deleteFailedAudits}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            🗑️ Delete All Failed Audits
          </button>
          <button
            onClick={fetchAudits}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            ↻ Refresh List
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-200">
          {(['all', 'failed', 'duplicates'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 font-medium transition ${
                filter === f
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Audits Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">Loading audits...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Domain</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pages</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">AEO / GEO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAudits().map(audit => (
                    <tr key={audit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <a
                          href={`/audits/${audit.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {audit.root_url}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          audit.status === 'completed' ? 'bg-green-100 text-green-800' :
                          audit.status === 'running' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {audit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{audit.pages_analyzed}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {audit.aeo_score !== null && audit.geo_score !== null
                          ? `${Math.round(audit.aeo_score)} / ${Math.round(audit.geo_score)}`
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(audit.started_at + 'Z').toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => deleteAudit(audit.id)}
                          disabled={deletingIds.has(audit.id)}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
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

