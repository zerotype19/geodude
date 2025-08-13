import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";

interface HealthMetrics {
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
}

export default function AdminHealth() {
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState(120); // 2 minutes
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadHealth();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

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
  }, [autoRefresh]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadHealth();
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  async function loadHealth() {
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

  function formatErrorRate(rate: number): string {
    return `${(rate * 100).toFixed(2)}%`;
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Health Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Real-time system health and ingestion metrics
          </p>

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
                    <div className={`text-2xl ${getStatusColor(health.kv_ok)}`}>
                      {getStatusIcon(health.kv_ok)}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">KV Storage</p>
                      <p className={`text-lg font-semibold ${getStatusColor(health.kv_ok)}`}>
                        {health.kv_ok ? "Connected" : "Error"}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Database">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className={`text-2xl ${getStatusColor(health.d1_ok)}`}>
                      {getStatusIcon(health.d1_ok)}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Database</p>
                      <p className={`text-lg font-semibold ${getStatusColor(health.d1_ok)}`}>
                        {health.d1_ok ? "Connected" : "Error"}
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
                        {formatTimestamp(health.last_cron_ts)}
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
                        {health.ingest.total_5m.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Ingestion Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card title="Error Rate (5m)">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Error Rate (5m)</h3>
                  <div className="text-3xl font-bold text-red-600">
                    {formatErrorRate(health.ingest.error_rate_5m)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {Object.values(health.ingest.by_error_5m).reduce((sum, count) => sum + count, 0)} errors
                  </p>
                </div>
              </Card>

              <Card title="Latency P50 (5m)">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Latency P50 (5m)</h3>
                  <div className="text-3xl font-bold text-blue-600">
                    {health.ingest.p50_ms_5m}ms
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Median response time</p>
                </div>
              </Card>

              <Card title="Latency P95 (5m)">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Latency P95 (5m)</h3>
                  <div className="text-3xl font-bold text-orange-600">
                    {health.ingest.p95_ms_5m}ms
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
                  {Object.entries(health.ingest.by_error_5m).map(([errorCode, count]) => (
                    <div key={errorCode} className="text-center">
                      <div className="text-2xl font-bold text-red-600">{count}</div>
                      <div className="text-sm text-gray-600 capitalize">
                        {errorCode.replace(/_/g, ' ')}
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
