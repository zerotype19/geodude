/**
 * Phase Runner with Strict Timeouts and Heartbeats
 * Manages audit phases with timeouts, retries, and checkpointing
 */

export interface PhaseConfig {
  name: string;
  timeoutMs: number;
  maxAttempts?: number;
  description?: string;
}

export interface PhaseContext {
  auditId: string;
  env: any; // Env interface
  phase: string;
  startTime: number;
  heartbeatInterval?: NodeJS.Timeout;
}

export interface PhaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    phase: string;
    duration: number;
  };
  duration: number;
}

/**
 * Phase configurations with strict timeouts
 */
export const PHASE_CONFIGS: Record<string, PhaseConfig> = {
  discovery: {
    name: 'discovery',
    timeoutMs: 10000, // 10s
    maxAttempts: 2,
    description: 'Domain resolution and seed URL discovery'
  },
  robots: {
    name: 'robots',
    timeoutMs: 10000, // 10s
    maxAttempts: 2,
    description: 'Fetch and parse robots.txt'
  },
  sitemap: {
    name: 'sitemap',
    timeoutMs: 10000, // 10s
    maxAttempts: 2,
    description: 'Fetch and parse sitemap'
  },
  probes: {
    name: 'probes',
    timeoutMs: 60000, // 60s total for all AI access probes
    maxAttempts: 1,
    description: 'AI bot access probing and testing'
  },
  crawl: {
    name: 'crawl',
    timeoutMs: 25000, // 25s - safe for Cloudflare Workers
    maxAttempts: 1,
    description: 'Page crawling and content extraction'
  },
  citations: {
    name: 'citations',
    timeoutMs: 20000, // 20s for Brave AI queries
    maxAttempts: 2,
    description: 'Brave AI search queries'
  },
  synth: {
    name: 'synth',
    timeoutMs: 10000, // 10s
    maxAttempts: 2,
    description: 'Score calculation and synthesis'
  },
  finalize: {
    name: 'finalize',
    timeoutMs: 5000, // 5s
    maxAttempts: 2,
    description: 'Final database updates'
  }
};

/**
 * Run a phase with timeout, heartbeat, and error handling
 */
export async function runPhase<T>(
  auditId: string,
  phaseName: string,
  env: any,
  phaseFn: (ctx: PhaseContext) => Promise<T>,
  options: {
    customTimeoutMs?: number;
    enableHeartbeat?: boolean;
  } = {}
): Promise<PhaseResult<T>> {
  const config = PHASE_CONFIGS[phaseName];
  if (!config) {
    throw new Error(`Unknown phase: ${phaseName}`);
  }

  const timeoutMs = options.customTimeoutMs || config.timeoutMs;
  const startTime = Date.now();
  
  console.log(`[PhaseRunner] Starting phase '${phaseName}' for audit ${auditId} (timeout: ${timeoutMs}ms)`);

  // Update phase status in database
  await updatePhaseStatus(auditId, phaseName, 'running', env);

  const context: PhaseContext = {
    auditId,
    env,
    phase: phaseName,
    startTime,
  };

  // Set up heartbeat if enabled
  if (options.enableHeartbeat !== false) {
    context.heartbeatInterval = setInterval(async () => {
      await updateHeartbeat(auditId, env);
    }, 10000); // Heartbeat every 10s
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    // Create a phase function that respects abort signal
    const abortablePhaseFn = async (): Promise<T> => {
      // Check if we should abort
      if (controller.signal.aborted) {
        throw new Error(`Phase ${phaseName} aborted`);
      }
      
      return await phaseFn(context);
    };

    const data = await abortablePhaseFn();
    const duration = Date.now() - startTime;

    clearTimeout(timeoutId);
    if (context.heartbeatInterval) {
      clearInterval(context.heartbeatInterval);
    }

    // Update phase completion
    await updatePhaseStatus(auditId, phaseName, 'completed', env, { duration });

    console.log(`[PhaseRunner] Phase '${phaseName}' completed for audit ${auditId} in ${duration}ms`);

    return {
      success: true,
      data,
      duration,
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    if (context.heartbeatInterval) {
      clearInterval(context.heartbeatInterval);
    }

    const duration = Date.now() - startTime;
    const errorCode = controller.signal.aborted ? 'TIMEOUT' : 'PHASE_ERROR';
    const errorMessage = controller.signal.aborted 
      ? `Phase ${phaseName} timed out after ${timeoutMs}ms`
      : error.message || 'Unknown phase error';

    console.error(`[PhaseRunner] Phase '${phaseName}' failed for audit ${auditId}: ${errorMessage}`);

    // Update phase failure
    await updatePhaseStatus(auditId, phaseName, 'failed', env, { 
      error: errorCode,
      errorMessage,
      duration 
    });

    return {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        phase: phaseName,
        duration,
      },
      duration,
    };
  }
}

/**
 * Update phase status in database
 */
async function updatePhaseStatus(
  auditId: string,
  phase: string,
  status: 'running' | 'completed' | 'failed',
  env: any,
  metadata?: {
    duration?: number;
    error?: string;
    errorMessage?: string;
  }
): Promise<void> {
  try {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    if (status === 'running') {
      await env.DB.prepare(
        `UPDATE audits 
         SET phase = ?, phase_started_at = ?, phase_heartbeat_at = ?, 
             phase_attempts = phase_attempts + 1
         WHERE id = ?`
      ).bind(phase, now, now, auditId).run();
    } else if (status === 'completed') {
      await env.DB.prepare(
        `UPDATE audits 
         SET phase = ?, phase_heartbeat_at = ?
         WHERE id = ?`
      ).bind(phase, now, auditId).run();
    } else if (status === 'failed') {
      await env.DB.prepare(
        `UPDATE audits 
         SET phase = ?, failure_code = ?, failure_detail = ?, phase_heartbeat_at = ?
         WHERE id = ?`
      ).bind(
        phase, 
        metadata?.error || 'PHASE_ERROR',
        JSON.stringify({
          error: metadata?.error,
          message: metadata?.errorMessage,
          duration: metadata?.duration,
          timestamp: now
        }),
        now,
        auditId
      ).run();
    }
  } catch (dbError) {
    console.error(`[PhaseRunner] Failed to update phase status: ${dbError}`);
    // Don't throw - we don't want DB errors to break the audit
  }
}

/**
 * Update heartbeat timestamp
 */
async function updateHeartbeat(auditId: string, env: any): Promise<void> {
  try {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    await env.DB.prepare(
      `UPDATE audits SET phase_heartbeat_at = ? WHERE id = ?`
    ).bind(now, auditId).run();
  } catch (error) {
    console.error(`[PhaseRunner] Failed to update heartbeat: ${error}`);
    // Don't throw - heartbeat failures shouldn't break the audit
  }
}

/**
 * Run multiple phases sequentially with early exit on failure
 */
export async function runPhasesSequentially<T>(
  auditId: string,
  phases: Array<{
    name: string;
    fn: (ctx: PhaseContext) => Promise<any>;
    options?: { customTimeoutMs?: number; enableHeartbeat?: boolean };
  }>,
  env: any
): Promise<PhaseResult<T>> {
  const results: any[] = [];
  
  for (const phase of phases) {
    const result = await runPhase(auditId, phase.name, env, phase.fn, phase.options);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error,
        duration: results.reduce((sum, r) => sum + r.duration, 0) + result.duration,
      };
    }
    
    results.push(result);
  }

  return {
    success: true,
    data: results,
    duration: results.reduce((sum, r) => sum + r.duration, 0),
  };
}
