import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";
// Removed React Router dependency

interface HealthMetrics {
  kv: { connected: boolean };
  database: { connected: boolean };
  cron: { last: string | null };
  requests_5m: { 
    total: number; 
    error_rate_pct: number; 
    p50_ms: number; 
    p95_ms: number; 
    status_breakdown: Array<{status: number; count: number}> 
  };
  sessions_5m: { 
    opened: number; 
    closed: number; 
    attached: number; 
    status: "healthy" | "watch" | "degraded" 
  };
  projects_5m: { created: number };
  // Legacy fields for backward compatibility
  kv_ok: boolean;
  d1_ok: boolean;
  last_cron_ts: string | null;
  ingest: {
    total_5m: number;
    error_rate_5m: number;
    p50_ms_5m: number;
    p95_ms_5m: number;
    by_error_5m: Record<string, number>;
    top_error_keys_5m: Array<{ key_id: string; count: number }>;
    top_error_projects_5m: Array<{ project_id: number; count: number }>;
  };
  sessions: {
    opened_5m: number;
    closed_5m: number;
    attach_5m: number;
    status: 'healthy' | 'watch' | 'degraded';
  };
  projects: {
    created_5m: number;
  };
}

export default function AdminHealth() {
  const { user } = useAuth();
  // Custom navigation function (no React Router)
  const navigate = (page: string) => {
    window.history.pushState({}, '', `/${page}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState(120); // 2 minutes
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Check if user is admin
  useEffect(() => {
    if (user && !user.is_admin) {
      navigate('/');
      return;
    }

    if (user?.is_admin) {
      loadHealth();
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!autoRefresh || !user?.is_admin) return;

    const interval = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          setAutoRefresh(false);
          return 0;
        }
        return prev - 10;
      });
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, user]);

  useEffect(() => {
    if (autoRefresh && user?.is_admin) {
      const interval = setInterval(() => {
        loadHealth();
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh, user]);

  async function loadHealth() {
    if (!user?.is_admin) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/admin/health`, FETCH_OPTS);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load health data");
    } finally {
      setLoading(false);
    }
  }

  function handleManualRefresh() {
    if (!user?.is_admin) return;

    setRefreshCountdown(120);
    setAutoRefresh(true);
    loadHealth();
  }

  function getStatusColor(status: boolean): string {
    return status ? "text-green-600" : "text-red-600";
  }

  function getStatusIcon(status: boolean): string {
    return status ? "✓" : "✗";
  }



  function formatTimestamp(timestamp: string | null): string {
    if (!timestamp) return "Never";
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return "Invalid";
    }
  }

  // Show loading while checking admin status
  if (!user) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-lg">Loading user data...</div>
        </div>
      </Shell>
    );
  }

  // Show access denied for non-admin users
  if (!user.is_admin) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center max-w-md">
            <div className="text-red-600 text-lg mb-4">Access Denied</div>
            <div className="text-gray-600 mb-4">Admin privileges required to view this page.</div>

            {/* Debug Information */}
            <div className="bg-gray-50 p-4 rounded-md text-left">
              <h4 className="font-medium text-gray-900 mb-2">Debug Information:</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>User ID: {user.id}</div>
                <div>Email: {user.email}</div>
                <div>Admin Status: {user.is_admin ? 'true' : 'false'}</div>
                <div>Created: {user.created_ts ? new Date(user.created_ts * 1000).toLocaleString() : 'Unknown'}</div>
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              To grant admin access, update the user record in the database to set is_admin = 1
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (loading && !health) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-lg">Loading health data...</div>
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-red-600 text-lg">{error}</div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Health Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Real-time system health and ingestion metrics
          </p>

          {/* Current User Context */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-blue-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Admin User: {user.email}
                  </p>
                  <p className="text-xs text-blue-700">
                    User ID: {user.id}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-700">
                  Last Login: {user.last_login_ts ? new Date(user.last_login_ts * 1000).toLocaleString() : 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          {/* Auto-refresh status */}
          <div className="mt-4 flex items-center space-x-4">
            {autoRefresh ? (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">
                  Auto-refreshing... {refreshCountdown}s remaining
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-sm text-gray-600">Auto-refresh stopped</span>
              </div>
            )}

            <button
              onClick={handleManualRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Recheck
            </button>
          </div>
        </div>

        {health && (
          <div className="space-y-6">
            {/* System Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card title="KV Storage">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className={`text-2xl ${getStatusColor(health.kv.connected)}`}>
                      {getStatusIcon(health.kv.connected)}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">KV Storage</p>
                      <p className={`text-lg font-semibold ${getStatusColor(health.kv.connected)}`}>
                        {health.kv.connected ? "Connected" : "Error"}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Database">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className={`text-2xl ${getStatusColor(health.database.connected)}`}>
                      {getStatusIcon(health.database.connected)}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Database</p>
                      <p className={`text-lg font-semibold ${getStatusColor(health.database.connected)}`}>
                        {health.database.connected ? "Connected" : "Error"}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Last Cron">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="text-2xl text-blue-600">⏰</div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Last Cron</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatTimestamp(health.cron.last)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Total Requests">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="text-2xl text-purple-600">📊</div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Total (5m)</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {health.requests_5m.total.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sessions Metrics */}
            <Card title="Sessions (last 5m)">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Sessions (last 5m)</h3>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    health.sessions_5m.status === 'healthy' 
                      ? 'bg-green-100 text-green-800' 
                      : health.sessions_5m.status === 'watch'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {health.sessions_5m.status}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {health.sessions_5m.opened}
                    </div>
                    <div className="text-sm text-gray-600">Opened</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {health.sessions_5m.closed}
                    </div>
                    <div className="text-sm text-gray-600">Closed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {health.sessions_5m.attached}
                    </div>
                    <div className="text-sm text-gray-600">Events attached</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Opened = new sessions started; Attached = events linked to sessions.
                </p>
              </div>
            </Card>

            {/* Projects Metrics */}
            <Card title="Projects (last 5m)">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Projects (last 5m)</h3>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {health.projects_5m.created}
                  </div>
                  <div className="text-sm text-gray-600">Created</div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Number of projects created in the last 5 minutes.
                </p>
              </div>
            </Card>

            {/* Ingestion Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card title="Error Rate (5m)">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Error Rate (5m)</h3>
                  <div className="text-3xl font-bold text-red-600">
                    {health.requests_5m.error_rate_pct.toFixed(2)}%
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {health.requests_5m.status_breakdown.filter(s => s.status >= 500).reduce((sum, s) => sum + s.count, 0)} errors
                  </p>
                </div>
              </Card>

              <Card title="Latency P50 (5m)">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Latency P50 (5m)</h3>
                  <div className="text-3xl font-bold text-blue-600">
                    {health.requests_5m.p50_ms}ms
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Median response time</p>
                </div>
              </Card>

              <Card title="Latency P95 (5m)">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Latency P95 (5m)</h3>
                  <div className="text-3xl font-bold text-orange-600">
                    {health.requests_5m.p95_ms}ms
                  </div>
                  <p className="text-sm text-gray-500 mt-1">95th percentile</p>
                </div>
              </Card>
            </div>

            {/* Error Breakdown */}
            <Card title="Error Breakdown (5m)">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Error Breakdown (5m)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {health.requests_5m.status_breakdown.map(({ status, count }) => (
                    <div key={status} className="text-center">
                      <div className="text-2xl font-bold text-red-600">{count}</div>
                      <div className="text-sm text-gray-600 capitalize">
                        {status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Top Error Keys */}
            {health.ingest.top_error_keys_5m.length > 0 && (
              <Card title="Top Error Keys (5m)">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Top Error Keys (5m)</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Key ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Error Count
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {health.ingest.top_error_keys_5m.map((item) => (
                          <tr key={item.key_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {item.key_id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            )}

            {/* Top Error Projects */}
            {health.ingest.top_error_projects_5m.length > 0 && (
              <Card title="Top Error Projects (5m)">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Top Error Projects (5m)</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Project ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Error Count
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {health.ingest.top_error_projects_5m.map((item) => (
                          <tr key={item.project_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {item.project_id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
