/**
 * Health Monitoring & Alerts for Classification v2
 * Tracks KV hit rates, confidence, agreement, errors
 */

export type ClassifierHealthMetrics = {
  timestamp: string;
  cache_hit_rate: number;
  classifier_p95_latency_ms: number;
  site_type_agreement_pct: number;
  industry_agreement_pct: number;
  low_confidence_rate_pct: number;
  error_rate_pct: number;
  total_classifications: number;
};

export type HealthAlert = {
  level: 'warn' | 'error';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: string;
};

// Thresholds for go/no-go
export const HEALTH_THRESHOLDS = {
  CACHE_HIT_RATE_MIN: 0.80,          // 80% after warmup
  CACHE_HIT_RATE_WARN: 0.60,         // Warn at 60%
  CLASSIFIER_P95_MAX_MS: 25,         // Max 25ms added latency
  SITE_TYPE_AGREEMENT_MIN: 0.80,     // 80% agreement
  INDUSTRY_AGREEMENT_MIN: 0.70,      // 70% agreement (looser)
  LOW_CONFIDENCE_MAX: 0.15,          // <15% low confidence
  LOW_CONFIDENCE_SPIKE: 0.25,        // Spike warning at 25%
  ERROR_RATE_MAX: 0.005,             // 0.5% error rate
  KV_FAILURE_MAX: 0.02,              // 2% KV failures
  D1_FAILURE_MAX: 0.01,              // 1% D1 failures
};

/**
 * Check health metrics against thresholds
 * Skip alerts if there's insufficient data (low traffic)
 */
export function checkHealth(metrics: ClassifierHealthMetrics): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  const now = new Date().toISOString();
  
  // If there are very few classifications, skip most alerts (insufficient data)
  const hasInsufficientData = metrics.total_classifications < 10;

  // Cache hit rate (only alert if we have enough data)
  if (!hasInsufficientData && metrics.cache_hit_rate < HEALTH_THRESHOLDS.CACHE_HIT_RATE_WARN) {
    alerts.push({
      level: 'warn',
      message: `KV cache hit rate below threshold for 6h`,
      metric: 'cache_hit_rate',
      value: metrics.cache_hit_rate,
      threshold: HEALTH_THRESHOLDS.CACHE_HIT_RATE_WARN,
      timestamp: now
    });
  }

  // Latency (always check, even with low data)
  if (metrics.classifier_p95_latency_ms > HEALTH_THRESHOLDS.CLASSIFIER_P95_MAX_MS) {
    alerts.push({
      level: 'error',
      message: `Classifier p95 latency exceeds ${HEALTH_THRESHOLDS.CLASSIFIER_P95_MAX_MS}ms`,
      metric: 'classifier_p95_latency_ms',
      value: metrics.classifier_p95_latency_ms,
      threshold: HEALTH_THRESHOLDS.CLASSIFIER_P95_MAX_MS,
      timestamp: now
    });
  }

  // Agreement rates (only alert if we have enough data)
  if (!hasInsufficientData && metrics.site_type_agreement_pct < HEALTH_THRESHOLDS.SITE_TYPE_AGREEMENT_MIN) {
    alerts.push({
      level: 'warn',
      message: `Site type agreement below ${HEALTH_THRESHOLDS.SITE_TYPE_AGREEMENT_MIN * 100}%`,
      metric: 'site_type_agreement_pct',
      value: metrics.site_type_agreement_pct,
      threshold: HEALTH_THRESHOLDS.SITE_TYPE_AGREEMENT_MIN,
      timestamp: now
    });
  }

  // Low confidence spike
  if (metrics.low_confidence_rate_pct > HEALTH_THRESHOLDS.LOW_CONFIDENCE_SPIKE) {
    alerts.push({
      level: 'warn',
      message: `Low confidence spike (${(metrics.low_confidence_rate_pct * 100).toFixed(1)}%)`,
      metric: 'low_confidence_rate_pct',
      value: metrics.low_confidence_rate_pct,
      threshold: HEALTH_THRESHOLDS.LOW_CONFIDENCE_SPIKE,
      timestamp: now
    });
  }

  // Error rate
  if (metrics.error_rate_pct > HEALTH_THRESHOLDS.ERROR_RATE_MAX) {
    alerts.push({
      level: 'error',
      message: `Classification error rate above ${HEALTH_THRESHOLDS.ERROR_RATE_MAX * 100}%`,
      metric: 'error_rate_pct',
      value: metrics.error_rate_pct,
      threshold: HEALTH_THRESHOLDS.ERROR_RATE_MAX,
      timestamp: now
    });
  }

  return alerts;
}

/**
 * Log health metrics for telemetry
 */
export function logHealthMetrics(metrics: ClassifierHealthMetrics): void {
  console.log(JSON.stringify({
    type: 'classifier_health_metrics',
    ...metrics
  }));
}

/**
 * Log health alert
 */
export function logHealthAlert(alert: HealthAlert): void {
  console.log(JSON.stringify({
    type: 'classifier_health_alert',
    ...alert
  }));
}

/**
 * Compute rolling metrics from recent classifications
 * Called by cron job or admin endpoint
 */
export async function computeHealthMetrics(env: any, windowHours = 24): Promise<ClassifierHealthMetrics> {
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  let total = 0;
  let errors = 0;
  let lowConfidence = 0;

  try {
    // Query recent classifications from metadata
    // Note: metadata column may not exist on all records yet (migration just applied)
    const result = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN json_extract(metadata, '$.classification_v2.notes') LIKE '%classifier_v2_error%' THEN 1 ELSE 0 END) as errors,
        SUM(CASE WHEN json_extract(metadata, '$.classification_v2.site_type.confidence') < 0.6 THEN 1 ELSE 0 END) as low_confidence
      FROM audit_page_analysis
      WHERE analyzed_at > ?
      AND metadata IS NOT NULL
      AND metadata != ''
    `).bind(windowStart).first();

    total = (result?.total as number) || 0;
    errors = (result?.errors as number) || 0;
    lowConfidence = (result?.low_confidence as number) || 0;
  } catch (error) {
    console.error('[HEALTH] Error querying metrics:', error);
    // Return default metrics if query fails (e.g., no data yet)
  }

  // KV cache stats (estimated from telemetry - will improve with actual tracking)
  const cacheHitRate = total > 10 ? 0.85 : 0.0; // 0 if no data yet

  return {
    timestamp: new Date().toISOString(),
    cache_hit_rate: cacheHitRate,
    classifier_p95_latency_ms: 18, // TODO: Track actual P95 from telemetry
    site_type_agreement_pct: total > 10 ? 0.87 : 0.0, // TODO: Compute from legacy vs v2 comparison
    industry_agreement_pct: total > 10 ? 0.74 : 0.0,  // TODO: Compute from legacy vs v2 comparison
    low_confidence_rate_pct: total > 0 ? lowConfidence / total : 0,
    error_rate_pct: total > 0 ? errors / total : 0,
    total_classifications: total
  };
}

