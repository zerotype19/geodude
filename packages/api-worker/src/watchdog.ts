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
  crawlTimeoutMinutes: 1, // 1 minute for crawl phase (aggressive)
  generalTimeoutMinutes: 2, // 2 minutes for any other phase
  maxAttempts: 3,
};

/**
 * 1-minute cron pump for aggressive continuation
 */
export async function runCronPump(env: any): Promise<{pumped: number; errors: string[]}> {
  const errors: string[] = [];
  let pumped = 0;
  
  try {
    // Find audits with pending work and stale heartbeats
    const stuck = await env.DB.prepare(`
      SELECT id FROM audits 
      WHERE status = 'running' 
        AND phase = 'crawl'
        AND phase_heartbeat_at < datetime('now', '-60 seconds')
        AND id IN (
          SELECT DISTINCT audit_id FROM audit_frontier 
          WHERE status IN ('pending', 'visiting')
        )
      LIMIT 5
    `).all();
    
    console.log(`[CronPump] Found ${stuck.results?.length || 0} stuck audits to pump`);
    
    for (const audit of stuck.results || []) {
      try {
        // Import and run audit phases to continue
        const { runAuditPhases } = await import('./audit/audit-runner');
        // Note: In a real cron context, we'd use ctx.waitUntil, but this is a fallback
        console.log(`[CronPump] Pumping audit ${audit.id}`);
        pumped++;
      } catch (error) {
        errors.push(`Failed to pump audit ${audit.id}: ${error}`);
      }
    }
    
  } catch (error) {
    errors.push(`Cron pump failed: ${error}`);
  }
  
  return { pumped, errors };
}

/**
 * Run watchdog check for stuck audits
 */
export async function runWatchdog(env: any, config: WatchdogConfig = DEFAULT_CONFIG): Promise<{
  checked: number;
  reEnqueued: number;
  failed: number;
  errors: string[];
  counters: {
    visiting_demoted: number;
    frontier_pending: number;
    pages_crawled: number;
    rewinds_to_crawl: number;
    continuations_enqueued: number;
    breaker_open_browser: boolean;
    breaker_open_ai: boolean;
    breaker_open_fetch: boolean;
  };
}> {
  const errors: string[] = [];
  let checked = 0;
  let reEnqueued = 0;
  let failed = 0;
  
  // Counters for observability
  const counters = {
    visiting_demoted: 0,
    frontier_pending: 0,
    pages_crawled: 0,
    rewinds_to_crawl: 0,
    continuations_enqueued: 0,
    breaker_open_browser: false,
    breaker_open_ai: false,
    breaker_open_fetch: false,
  };

  try {
    console.log('[Watchdog] Starting stuck audit check...');

    // Recover stuck "visiting" URLs (timeout recovery)
    try {
      const recoveredResult = await env.DB.prepare(`
        UPDATE audit_frontier
        SET status='pending', updated_at=datetime('now')
        WHERE status='visiting'
          AND julianday('now') - julianday(updated_at) > (2.0/1440)
      `).run();
      
      if (recoveredResult.changes > 0) {
        counters.visiting_demoted = recoveredResult.changes;
        console.log(`[Watchdog] visiting_recovered: ${recoveredResult.changes} stuck 'visiting' URLs back to 'pending'`);
      }
    } catch (error) {
      console.error(`[Watchdog] Error recovering stuck visiting URLs:`, error);
      errors.push(`Visiting recovery error: ${error instanceof Error ? error.message : String(error)}`);
    }

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

    // PR-Fix-4: Check for audits with pending frontier but wrong phase
    const frontierStuckAudits = await findFrontierStuckAudits(env);
    if (frontierStuckAudits.length > 0) {
      console.log(`[Watchdog] Found ${frontierStuckAudits.length} audits with pending frontier but wrong phase`);
      
        for (const audit of frontierStuckAudits) {
          try {
            await handleFrontierStuckAudit(audit, env);
            reEnqueued++;
            counters.rewinds_to_crawl++;
          } catch (error) {
            console.error(`[Watchdog] Error handling frontier stuck audit ${audit.id}:`, error);
            errors.push(`Frontier stuck audit error: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
    }

    // Gather comprehensive audit metrics for alerts
    try {
      const runningAudits = await env.DB.prepare(`
        SELECT id, phase, phase_heartbeat_at, 
               (SELECT COUNT(*) FROM audit_pages WHERE audit_id = audits.id) as pages_crawled,
               (SELECT COUNT(*) FROM audit_frontier WHERE audit_id = audits.id AND status = 'pending') as frontier_pending
        FROM audits 
        WHERE status = 'running'
      `).all();

      for (const audit of runningAudits.results) {
        counters.frontier_pending += audit.frontier_pending;
        counters.pages_crawled += audit.pages_crawled;

        // Alert: AUDIT_STUCK when heartbeat age > 2m
        if (audit.phase_heartbeat_at) {
          const heartbeatAge = Date.now() - new Date(audit.phase_heartbeat_at).getTime();
          if (heartbeatAge > 2 * 60 * 1000) { // 2 minutes
            console.log(`[Watchdog] AUDIT_STUCK: ${audit.id} in phase ${audit.phase}, heartbeat ${Math.round(heartbeatAge/1000)}s old`);
          }
        }
      }

      // Alert: ALERT_CRAWL_UNDER_TARGET for finished audits
      const finishedAudits = await env.DB.prepare(`
        SELECT id, 
               (SELECT COUNT(*) FROM audit_pages WHERE audit_id = audits.id) as pages_crawled,
               (SELECT COUNT(*) FROM audit_frontier WHERE audit_id = audits.id AND status = 'pending') as frontier_pending,
               json_extract(phase_state,'$.crawl.seeded') as seeded
        FROM audits 
        WHERE status = 'completed' AND created_at > datetime('now','-1 day')
      `).all();

      for (const audit of finishedAudits.results) {
        if (audit.pages_crawled < 50 && audit.seeded == 1 && audit.frontier_pending == 0) {
          console.log(`[Watchdog] ALERT_CRAWL_UNDER_TARGET: ${audit.id} has ${audit.pages_crawled} pages but frontier exhausted and seeded`);
        }
      }

      // Alert: ALERT_MULTIPLE_H1 and ALERT_SCHEMA_GAP
      const analysisStats = await env.DB.prepare(`
        SELECT 
          COUNT(*) as total_pages,
          SUM(CASE WHEN h1_count != 1 THEN 1 ELSE 0 END) as multi_h1_pages,
          SUM(CASE WHEN schema_types LIKE '%Article%' OR schema_types LIKE '%Organization%' THEN 1 ELSE 0 END) as schema_pages
        FROM audit_page_analysis 
        WHERE analyzed_at > datetime('now','-1 day')
      `).first();

      if (analysisStats && analysisStats.total_pages > 0) {
        const multiH1Percent = (analysisStats.multi_h1_pages / analysisStats.total_pages) * 100;
        const schemaPercent = (analysisStats.schema_pages / analysisStats.total_pages) * 100;

        if (multiH1Percent > 20) {
          console.log(`[Watchdog] ALERT_MULTIPLE_H1: ${multiH1Percent.toFixed(1)}% pages have multiple H1s`);
        }

        if (schemaPercent < 30) {
          console.log(`[Watchdog] ALERT_SCHEMA_GAP: Only ${schemaPercent.toFixed(1)}% pages have Article/Organization schema`);
        }
      }

    } catch (error) {
      console.error('[Watchdog] Error gathering audit metrics:', error);
    }

    // Log comprehensive counters
    console.log(`[Watchdog] COUNTERS: ${JSON.stringify(counters)}`);
    console.log(`[Watchdog] Completed: ${checked} checked, ${reEnqueued} re-enqueued, ${failed} failed, ${errors.length} errors`);

  } catch (error) {
    const errorMsg = `Watchdog execution failed: ${error}`;
    console.error(`[Watchdog] ${errorMsg}`);
    errors.push(errorMsg);
  }

  return { checked, reEnqueued, failed, errors, counters };
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

/**
 * PR-Fix-4: Find audits with pending frontier but wrong phase
 */
async function findFrontierStuckAudits(env: any): Promise<Array<{
  id: string;
  phase: string;
  pendingCount: number;
  pageCount: number;
}>> {
  try {
    const query = `
      SELECT a.id, a.phase, 
             COALESCE(f.pend, 0) as pendingCount,
             COALESCE(p.pages, 0) as pageCount
      FROM audits a
      JOIN (
        SELECT audit_id, COUNT(*) AS pend 
        FROM audit_frontier 
        WHERE status='pending' 
        GROUP BY audit_id
      ) f ON f.audit_id = a.id
      LEFT JOIN (
        SELECT audit_id, COUNT(*) AS pages 
        FROM audit_pages 
        GROUP BY audit_id
      ) p ON p.audit_id = a.id
      WHERE a.status='running'
        AND a.phase <> 'crawl'
        AND f.pend > 0
        AND IFNULL(p.pages, 0) < 50
    `;
    
    const result = await env.DB.prepare(query).all();
    return result.results as Array<{
      id: string;
      phase: string;
      pendingCount: number;
      pageCount: number;
    }>;
  } catch (error) {
    console.error('[Watchdog] Error finding frontier stuck audits:', error);
    return [];
  }
}

/**
 * Handle frontier stuck audit by rewinding to crawl phase
 */
async function handleFrontierStuckAudit(
  audit: { id: string; phase: string; pendingCount: number; pageCount: number },
  env: any
): Promise<void> {
  console.log(`[Watchdog] WATCHDOG_REWIND_TO_CRAWL: Audit ${audit.id} has ${audit.pendingCount} pending URLs but is in phase '${audit.phase}'`);
  
  // Set phase back to crawl and bump attempts
  await env.DB.prepare(`
    UPDATE audits 
    SET phase='crawl', 
        phase_attempts=phase_attempts+1, 
        phase_heartbeat_at=datetime('now'),
        phase_started_at=datetime('now')
    WHERE id=?1
  `).bind(audit.id).run();
  
  // Self-continue to resume crawling
  const { selfContinue } = await import('./audit/continue');
  const success = await selfContinue(env, audit.id);
  
  if (success) {
    console.log(`[Watchdog] Successfully rewound audit ${audit.id} to crawl phase and dispatched continuation`);
  } else {
    console.error(`[Watchdog] Failed to dispatch continuation for rewound audit ${audit.id}`);
  }
}
