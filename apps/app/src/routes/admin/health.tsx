/**
 * Admin Health Dashboard for Classification v2
 * Shows real-time metrics, alerts, and trends
 */

import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.optiview.ai';

type HealthMetrics = {
  timestamp: string;
  cache_hit_rate: number;
  classifier_p95_latency_ms: number;
  site_type_agreement_pct: number;
  industry_agreement_pct: number;
  low_confidence_rate_pct: number;
  error_rate_pct: number;
  total_classifications: number;
};

type HealthAlert = {
  level: 'warn' | 'error';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: string;
};

export default function HealthDashboard() {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000); // Refresh every minute
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/classifier-health`, {
        credentials: 'include' // Send session cookie
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setMetrics(data.metrics);
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch health:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading health metrics...</div>
        </div>
      </div>
    );
  }

  const hasInsufficientData = metrics && metrics.total_classifications < 10;

  const getStatusColor = (value: number, threshold: number, inverse = false) => {
    if (hasInsufficientData) return 'text-neutral-500';
    const isGood = inverse ? value < threshold : value > threshold;
    return isGood ? 'text-success' : 'text-danger';
  };

  const getStatusBg = (value: number, threshold: number, inverse = false) => {
    if (hasInsufficientData) return 'bg-surface-1 border-neutral-200';
    const isGood = inverse ? value < threshold : value > threshold;
    return isGood ? 'bg-success-soft border-success' : 'bg-danger-soft border-danger';
  };
  
  const formatMetric = (value: number, format: 'percentage' | 'ms' = 'percentage') => {
    if (hasInsufficientData) return 'N/A';
    if (format === 'ms') return `${value.toFixed(0)}ms`;
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Classifier Health Dashboard</h1>
          <button
            onClick={fetchHealth}
            className="px-4 py-2 bg-brand text-white rounded-md hover:bg-brand"
          >
            Refresh
          </button>
        </div>

        {/* Insufficient Data Banner */}
        {metrics && metrics.total_classifications < 10 && (
          <div className="p-4 rounded-md border bg-brand-soft border-blue-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div className="flex-1">
                <div className="font-semibold text-brand">Insufficient Data for Health Metrics</div>
                <div className="text-sm text-brand mt-1">
                  Only <strong>{metrics.total_classifications}</strong> classifications in the last 24h. 
                  Health thresholds require at least <strong>10 classifications</strong> for accurate monitoring.
                  Metrics showing 0.0% are expected with low traffic.
                </div>
                <div className="text-sm text-brand mt-2">
                  💡 Run a few audits to populate the health dashboard with meaningful data.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`p-4 rounded-md border ${
                  alert.level === 'error' ? 'bg-danger-soft border-danger' : 'bg-warn-soft border-warn'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {alert.level === 'error' ? '🚨' : '⚠️'}
                  </span>
                  <div className="flex-1">
                    <div className="font-semibold">{alert.message}</div>
                    <div className="text-sm text-neutral-600 mt-1">
                      {alert.metric}: {(alert.value * 100).toFixed(1)}% (threshold: {(alert.threshold * 100).toFixed(1)}%)
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Key Metrics Grid */}
        {metrics && (
          <div className="grid grid-cols-4 gap-6">
            {/* Cache Hit Rate */}
            <div className={`bg-surface-1 rounded-lg shadow-sm p-6 border-2 ${getStatusBg(metrics.cache_hit_rate, 0.80)}`}>
              <div className="text-sm text-neutral-500 mb-2">Cache Hit Rate</div>
              <div className={`text-3xl font-bold ${getStatusColor(metrics.cache_hit_rate, 0.80)}`}>
                {formatMetric(metrics.cache_hit_rate)}
              </div>
              <div className="text-xs text-neutral-400 mt-1">Target: ≥80%</div>
            </div>

            {/* P95 Latency */}
            <div className={`bg-surface-1 rounded-lg shadow-sm p-6 border-2 ${getStatusBg(metrics.classifier_p95_latency_ms, 25, true)}`}>
              <div className="text-sm text-neutral-500 mb-2">P95 Latency</div>
              <div className={`text-3xl font-bold ${getStatusColor(metrics.classifier_p95_latency_ms, 25, true)}`}>
                {formatMetric(metrics.classifier_p95_latency_ms, 'ms')}
              </div>
              <div className="text-xs text-neutral-400 mt-1">Target: ≤25ms</div>
            </div>

            {/* Site Type Agreement */}
            <div className={`bg-surface-1 rounded-lg shadow-sm p-6 border-2 ${getStatusBg(metrics.site_type_agreement_pct, 0.80)}`}>
              <div className="text-sm text-neutral-500 mb-2">Site Type Agreement</div>
              <div className={`text-3xl font-bold ${getStatusColor(metrics.site_type_agreement_pct, 0.80)}`}>
                {formatMetric(metrics.site_type_agreement_pct)}
              </div>
              <div className="text-xs text-neutral-400 mt-1">Target: ≥80%</div>
            </div>

            {/* Industry Agreement */}
            <div className={`bg-surface-1 rounded-lg shadow-sm p-6 border-2 ${getStatusBg(metrics.industry_agreement_pct, 0.70)}`}>
              <div className="text-sm text-neutral-500 mb-2">Industry Agreement</div>
              <div className={`text-3xl font-bold ${getStatusColor(metrics.industry_agreement_pct, 0.70)}`}>
                {formatMetric(metrics.industry_agreement_pct)}
              </div>
              <div className="text-xs text-neutral-400 mt-1">Target: ≥70%</div>
            </div>
          </div>
        )}

        {/* Secondary Metrics */}
        {metrics && (
          <div className="grid grid-cols-3 gap-6">
            {/* Low Confidence Rate */}
            <div className="bg-surface-1 rounded-lg shadow-sm p-6">
              <div className="text-sm text-neutral-500 mb-2">Low Confidence Rate</div>
              <div className={`text-2xl font-bold ${getStatusColor(metrics.low_confidence_rate_pct, 0.15, true)}`}>
                {formatMetric(metrics.low_confidence_rate_pct)}
              </div>
              <div className="text-xs text-neutral-400 mt-1">Target: &lt;15%</div>
              {!hasInsufficientData && (
                <div className="mt-4 h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${metrics.low_confidence_rate_pct > 0.15 ? 'bg-danger-soft0' : 'bg-success-soft0'}`}
                    style={{ width: `${Math.min(100, metrics.low_confidence_rate_pct * 100 / 15 * 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Error Rate */}
            <div className="bg-surface-1 rounded-lg shadow-sm p-6">
              <div className="text-sm text-neutral-500 mb-2">Error Rate</div>
              <div className={`text-2xl font-bold ${getStatusColor(metrics.error_rate_pct, 0.005, true)}`}>
                {hasInsufficientData ? 'N/A' : `${(metrics.error_rate_pct * 100).toFixed(2)}%`}
              </div>
              <div className="text-xs text-neutral-400 mt-1">Target: &lt;0.5%</div>
              {!hasInsufficientData && (
                <div className="mt-4 h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${metrics.error_rate_pct > 0.005 ? 'bg-danger-soft0' : 'bg-success-soft0'}`}
                    style={{ width: `${Math.min(100, metrics.error_rate_pct * 100 / 0.5 * 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Total Classifications */}
            <div className="bg-surface-1 rounded-lg shadow-sm p-6">
              <div className="text-sm text-neutral-500 mb-2">Total Classifications (24h)</div>
              <div className="text-2xl font-bold text-brand">
                {metrics.total_classifications.toLocaleString()}
              </div>
              <div className="text-xs text-neutral-400 mt-1">Last 24 hours</div>
            </div>
          </div>
        )}

        {/* Go/No-Go Status */}
        {metrics && (
          <div className="bg-surface-1 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Go/No-Go Status</h2>
            <div className="space-y-2">
              <StatusCheck
                label="Cache hit rate ≥80%"
                status={metrics.cache_hit_rate >= 0.80}
                value={`${(metrics.cache_hit_rate * 100).toFixed(1)}%`}
              />
              <StatusCheck
                label="P95 latency ≤25ms"
                status={metrics.classifier_p95_latency_ms <= 25}
                value={`${metrics.classifier_p95_latency_ms.toFixed(0)}ms`}
              />
              <StatusCheck
                label="Site type agreement ≥80%"
                status={metrics.site_type_agreement_pct >= 0.80}
                value={`${(metrics.site_type_agreement_pct * 100).toFixed(1)}%`}
              />
              <StatusCheck
                label="Industry agreement ≥70%"
                status={metrics.industry_agreement_pct >= 0.70}
                value={`${(metrics.industry_agreement_pct * 100).toFixed(1)}%`}
              />
              <StatusCheck
                label="Low confidence &lt;15%"
                status={metrics.low_confidence_rate_pct < 0.15}
                value={`${(metrics.low_confidence_rate_pct * 100).toFixed(1)}%`}
              />
              <StatusCheck
                label="Error rate &lt;0.5%"
                status={metrics.error_rate_pct < 0.005}
                value={`${(metrics.error_rate_pct * 100).toFixed(2)}%`}
              />
            </div>
          </div>
        )}

        {/* Timestamp */}
        {metrics && (
          <div className="text-center text-sm text-neutral-500">
            Last updated: {new Date(metrics.timestamp).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCheck({ label, status, value }: { label: string; status: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-4 rounded bg-neutral-50">
      <div className="flex items-center gap-2">
        <span className="text-xl">{status ? '✅' : '❌'}</span>
        <span>{label}</span>
      </div>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

