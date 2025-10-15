/**
 * Watchdog for Stuck Audits
 * Detects and handles audits that have been running too long without progress
 */

export interface WatchdogConfig {
  // Timeouts in minutes
  crawlTimeoutMinutes: number;
  generalTimeoutMinutes: number;
  maxAttempts: number;
}

const DEFAULT_CONFIG: WatchdogConfig = {
  crawlTimeoutMinutes: 3, // 3 minutes for crawl phase
  generalTimeoutMinutes: 5, // 5 minutes for any other phase
  maxAttempts: 3,
};

/**
 * Run watchdog check for stuck audits
 */
export async function runWatchdog(env: any, config: WatchdogConfig = DEFAULT_CONFIG): Promise<{
  checked: number;
  reEnqueued: number;
  failed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let checked = 0;
  let reEnqueued = 0;
  let failed = 0;

  try {
    console.log('[Watchdog] Starting stuck audit check...');

    // Find stuck audits
    const stuckAudits = await findStuckAudits(env, config);
    checked = stuckAudits.length;

    console.log(`[Watchdog] Found ${checked} potentially stuck audits`);

    // Alert threshold: If any running audit has heartbeat > 2m
    const criticalStuck = stuckAudits.filter(audit => {
      if (!audit.phase_heartbeat_at) return true;
      const heartbeatAge = (Date.now() - new Date(audit.phase_heartbeat_at).getTime()) / 1000;
      return heartbeatAge > 120; // 2 minutes
    });

    if (criticalStuck.length > 0) {
      const auditIds = criticalStuck.map(a => a.id).join(',');
      console.error(`[ALERT] AUDIT_STUCK: ${criticalStuck.length} audits with heartbeat > 2m: ${auditIds}`);
    }

    for (const audit of stuckAudits) {
      try {
        const result = await handleStuckAudit(audit, env, config);
        if (result.action === 'reEnqueue') {
          reEnqueued++;
        } else if (result.action === 'fail') {
          failed++;
        }
      } catch (error) {
        const errorMsg = `Failed to handle stuck audit ${audit.id}: ${error}`;
        console.error(`[Watchdog] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Check for recurring failure patterns
    await checkRecurringFailures(env);

    // Check for slow phases
    await checkSlowPhases(env);

    console.log(`[Watchdog] Completed: ${checked} checked, ${reEnqueued} re-enqueued, ${failed} failed, ${errors.length} errors`);

  } catch (error) {
    const errorMsg = `Watchdog execution failed: ${error}`;
    console.error(`[Watchdog] ${errorMsg}`);
    errors.push(errorMsg);
  }

  return { checked, reEnqueued, failed, errors };
}

/**
 * Find audits that appear to be stuck
 */
async function findStuckAudits(env: any, config: WatchdogConfig): Promise<Array<{
  id: string;
  phase: string;
  phase_started_at: string;
  phase_heartbeat_at: string;
  phase_attempts: number;
  status: string;
}>> {
  try {
    // Query for stuck audits based on phase and timeout
    const query = `
      SELECT id, phase, phase_started_at, phase_heartbeat_at, phase_attempts, status
      FROM audits
      WHERE status = 'running'
        AND (
          -- Crawl phase timeout (more generous)
          (phase = 'crawl' AND julianday('now') - julianday(phase_heartbeat_at) > ? / 1440.0)
          OR
          -- General phase timeout (stricter)
          (phase != 'crawl' AND julianday('now') - julianday(phase_started_at) > ? / 1440.0)
          OR
          -- No heartbeat for 2+ minutes in any phase
          (phase_heartbeat_at IS NULL OR julianday('now') - julianday(phase_heartbeat_at) > 2.0 / 1440.0)
        )
      ORDER BY phase_started_at ASC
    `;

    const result = await env.DB.prepare(query)
      .bind(config.crawlTimeoutMinutes, config.generalTimeoutMinutes)
      .all();

    return result.results || [];
  } catch (error) {
    console.error('[Watchdog] Failed to query stuck audits:', error);
    return [];
  }
}

/**
 * Handle a single stuck audit
 */
async function handleStuckAudit(
  audit: any,
  env: any,
  config: WatchdogConfig
): Promise<{ action: 'reEnqueue' | 'fail' | 'skip'; reason: string }> {
  const { id, phase, phase_attempts } = audit;
  
  console.log(`[Watchdog] Handling stuck audit ${id} in phase '${phase}' (attempt ${phase_attempts})`);

  // If we've exceeded max attempts, fail the audit
  if (phase_attempts >= config.maxAttempts) {
    await failAudit(id, `WATCHDOG_MAX_ATTEMPTS_${phase.toUpperCase()}`, env);
    return { 
      action: 'fail', 
      reason: `Exceeded max attempts (${config.maxAttempts}) in phase ${phase}` 
    };
  }

  // For first few attempts, try to re-enqueue the audit
  try {
    await reEnqueueAudit(id, env);
    return { 
      action: 'reEnqueue', 
      reason: `Re-enqueued audit in phase ${phase} (attempt ${phase_attempts + 1})` 
    };
  } catch (error) {
    console.error(`[Watchdog] Failed to re-enqueue audit ${id}:`, error);
    await failAudit(id, `WATCHDOG_REENQUEUE_FAILED`, env);
    return { 
      action: 'fail', 
      reason: `Failed to re-enqueue: ${error}` 
    };
  }
}

/**
 * Re-enqueue an audit for retry
 */
async function reEnqueueAudit(auditId: string, env: any): Promise<void> {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  // Reset phase tracking for retry
  await env.DB.prepare(
    `UPDATE audits 
     SET phase = 'init', 
         phase_started_at = ?, 
         phase_heartbeat_at = ?,
         failure_code = NULL,
         failure_detail = NULL
     WHERE id = ?`
  ).bind(now, now, auditId).run();

  console.log(`[Watchdog] Re-enqueued audit ${auditId} for retry`);
  
  // TODO: If using Cloudflare Queues, enqueue the audit task here
  // For now, we'll rely on the existing waitUntil mechanism
  // This is where you'd add: await env.AUDIT_QUEUE.send({ auditId, resume: true });
}

/**
 * Mark an audit as failed
 */
async function failAudit(auditId: string, failureCode: string, env: any): Promise<void> {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  await env.DB.prepare(
    `UPDATE audits 
     SET status = 'failed', 
         failure_code = ?, 
         failure_detail = ?,
         completed_at = ?
     WHERE id = ?`
  ).bind(
    failureCode,
    JSON.stringify({
      reason: 'Watchdog timeout',
      code: failureCode,
      timestamp: now,
      action: 'auto_failed'
    }),
    now,
    auditId
  ).run();

  console.log(`[Watchdog] Marked audit ${auditId} as failed with code ${failureCode}`);
}

/**
 * Check for recurring failure patterns
 */
async function checkRecurringFailures(env: any): Promise<void> {
  try {
    // Find failure codes that occurred >= 3 times in last 10 minutes
    const recentFailures = await env.DB.prepare(
      `SELECT failure_code, COUNT(*) as count
       FROM audits
       WHERE status = 'failed'
         AND failure_code IS NOT NULL
         AND completed_at > datetime('now','-10 minutes')
       GROUP BY failure_code
       HAVING count >= 3`
    ).all();

    for (const failure of recentFailures.results || []) {
      console.error(`[ALERT] ALERT_RECURRING_FAILURE:${failure.failure_code}: ${failure.count} failures in last 10m`);
    }
  } catch (error) {
    console.error('[Watchdog] Failed to check recurring failures:', error);
  }
}

/**
 * Check for slow phases
 */
async function checkSlowPhases(env: any): Promise<void> {
  try {
    // Check if p95(citations phase) > 45s for last hour
    const citationsStats = await env.DB.prepare(
      `SELECT 
         COUNT(*) as total,
         AVG(CASE WHEN phase_started_at IS NOT NULL AND completed_at IS NOT NULL 
             THEN (julianday(completed_at) - julianday(phase_started_at)) * 1440.0 * 60.0 
             ELSE NULL END) as avg_duration_ms
       FROM audits
       WHERE phase = 'citations'
         AND started_at > datetime('now','-1 hour')
         AND status = 'completed'`
    ).first<{ total: number; avg_duration_ms: number }>();

    if (citationsStats && citationsStats.total > 0) {
      const avgDurationSeconds = (citationsStats.avg_duration_ms || 0) / 1000;
      if (avgDurationSeconds > 45) {
        console.error(`[ALERT] ALERT_SLOW_PHASE:citations: avg duration ${Math.round(avgDurationSeconds)}s (threshold: 45s) in last hour`);
      }
    }
  } catch (error) {
    console.error('[Watchdog] Failed to check slow phases:', error);
  }
}

/**
 * Get audit statistics for monitoring
 */
export async function getAuditStats(env: any): Promise<{
  running: number;
  byPhase: Record<string, number>;
  stuck: number;
  avgDuration: number;
}> {
  try {
    // Count running audits by phase
    const phaseStats = await env.DB.prepare(
      `SELECT phase, COUNT(*) as count 
       FROM audits 
       WHERE status = 'running' 
       GROUP BY phase`
    ).all();

    const byPhase: Record<string, number> = {};
    let running = 0;
    
    for (const stat of phaseStats.results || []) {
      byPhase[stat.phase] = stat.count;
      running += stat.count;
    }

    // Count potentially stuck audits
    const stuckResult = await env.DB.prepare(
      `SELECT COUNT(*) as count
       FROM audits
       WHERE status = 'running'
         AND (
           julianday('now') - julianday(phase_heartbeat_at) > 2.0 / 1440.0
           OR phase_heartbeat_at IS NULL
         )`
    ).first();

    const stuck = stuckResult?.count || 0;

    // Average duration of completed audits (last 24h)
    const avgDurationResult = await env.DB.prepare(
      `SELECT AVG(
         julianday(completed_at) - julianday(started_at)
       ) * 1440.0 as avg_minutes
       FROM audits
       WHERE status = 'completed' 
         AND completed_at > datetime('now', '-1 day')`
    ).first();

    const avgDuration = avgDurationResult?.avg_minutes || 0;

    return {
      running,
      byPhase,
      stuck,
      avgDuration: Math.round(avgDuration * 100) / 100, // Round to 2 decimal places
    };

  } catch (error) {
    console.error('[Watchdog] Failed to get audit stats:', error);
    return {
      running: 0,
      byPhase: {},
      stuck: 0,
      avgDuration: 0,
    };
  }
}
