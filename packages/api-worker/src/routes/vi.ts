/**
 * Visibility Intelligence API Routes
 * Handles audit-scoped visibility intelligence runs and results
 */

import { normalizeFromUrl, getCacheKey } from '../lib/domain';
import { IntentGenerator } from '../services/vi/intents';
import { VisibilityScorer } from '../services/vi/scoring';
import { getEnabledConnector } from '../services/visibility/connectors';

// Utility functions for reliable execution
async function withTimeout<T>(ms: number, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort('timeout'), ms);
  try { 
    return await task(ctrl.signal); 
  } finally { 
    clearTimeout(t); 
  }
}

function pLimit(n: number) {
  const queue: (() => void)[] = []; 
  let active = 0;
  const next = () => { active--; queue.shift()?.(); };
  return <T>(fn: () => Promise<T>) => new Promise<T>((resolve, reject) => {
    const run = () => { 
      active++; 
      fn().then(r => { resolve(r); next(); }).catch(e => { reject(e); next(); }); 
    };
    active < n ? run() : queue.push(run);
  });
}

async function logVIEvent(env: Env, runId: string, event: string, detail: string, intentId?: string, source?: string): Promise<void> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await env.DB.prepare(`
    INSERT INTO vi_logs (id, run_id, intent_id, source, event, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(logId, runId, intentId || null, source || null, event, detail).run();
}

export interface Env {
  DB: D1Database;
  VI_RUN_Q?: Queue;
  KV_VI_CACHE?: KVNamespace;
  KV_VI_RULES?: KVNamespace;
  KV_VI_SEEDS?: KVNamespace;
  // Feature flags
  USE_LIVE_VISIBILITY?: string;
  VI_SOURCES?: string;
  VI_MAX_INTENTS?: string;
  VI_RECENCY_HOURS?: string;
  VI_CACHE_TTL_SEC?: string;
  // API Keys
  PERPLEXITY_API_KEY?: string;
  OPENAI_API_KEY?: string;
  CLAUDE_API_KEY?: string;
  // Connector flags
  FEATURE_VIS_PERPLEXITY?: string;
  FEATURE_VIS_CHATGPT?: string;
  FEATURE_VIS_CLAUDE?: string;
  // Optional org IDs
  PERPLEXITY_ORG_ID?: string;
  OPENAI_ORG_ID?: string;
}

export function createVIRoutes(env: Env) {

  return {
    async fetch(request: Request): Promise<Response> {
      // Check if VI is enabled
      if (env.USE_LIVE_VISIBILITY !== 'true') {
        return new Response(JSON.stringify({ error: 'Visibility Intelligence not enabled' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const url = new URL(request.url);
      const path = url.pathname;
      
      // CORS headers - match main application CORS logic
      const allowedOrigins = [
        'https://app.optiview.ai',
        'https://optiview.ai',
        'https://geodude-app.pages.dev',
        'https://geodude.pages.dev',
        'http://localhost:5173',
        'http://localhost:5174',
      ];
      
      const origin = request.headers.get('Origin');
      const allowOrigin = allowedOrigins.some(allowed => 
        origin?.includes(allowed.replace('https://', '').replace('http://', ''))
      ) ? origin : allowedOrigins[0];
      
      const corsHeaders = {
        'Access-Control-Allow-Origin': allowOrigin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
      };
      
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
      }
      
      try {
        // POST /api/vi/run - Start a visibility run
        if (path === '/api/vi/run' && request.method === 'POST') {
          return await handleRun(request, env, corsHeaders);
        }
        
        // GET /api/vi/results - Get visibility results
        if (path === '/api/vi/results' && request.method === 'GET') {
          return await handleResults(request, env, corsHeaders);
        }
        
        // GET /api/vi/compare - Compare with competitors
        if (path === '/api/vi/compare' && request.method === 'GET') {
          return await handleCompare(request, env, corsHeaders);
        }
        
        // GET /api/vi/export.csv - Export results as CSV
        if (path === '/api/vi/export.csv' && request.method === 'GET') {
          return await handleExport(request, env);
        }
        
        // POST /api/vi/intents:generate - Force regenerate intents
        if (path === '/api/vi/intents:generate' && request.method === 'POST') {
          return await handleGenerateIntents(request, env, corsHeaders);
        }
        
        // GET /api/vi/health - Health check
        if (path === '/api/vi/health' && request.method === 'GET') {
          return await handleHealth(request, env, corsHeaders);
        }

        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('[VIRoutes] Error:', error);
        return new Response(JSON.stringify({ 
          error: 'Internal server error',
          details: error instanceof Error ? error.message : String(error)
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  };
}

/**
 * Start a visibility run for an audit
 */
async function handleRun(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const intentGenerator = new IntentGenerator(env);
    const body = await request.json();
    const { audit_id, mode = 'on_demand', sources, max_intents, regenerate_intents = false } = body;

    if (!audit_id) {
      return new Response(JSON.stringify({ error: 'audit_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get audit details with project_id and domain from properties table
    const audit = await env.DB.prepare(`
      SELECT a.id, p.project_id, p.domain
      FROM audits a
      JOIN properties p ON a.property_id = p.id
      WHERE a.id = ?
    `).bind(audit_id).first();

    if (!audit) {
      return new Response(JSON.stringify({ error: 'Audit not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const domain = (audit as any).domain;
    const auditedUrl = `https://${domain}`;
    const domainInfo = normalizeFromUrl(auditedUrl);
    const projectId = (audit as any).project_id;
    const maxIntents = parseInt(max_intents || env.VI_MAX_INTENTS || '100');
    const enabledSources = sources || JSON.parse(env.VI_SOURCES || '["perplexity","chatgpt_search","claude"]');

    // Check if there's a recent run
    const recentRun = await getRecentRun(env, projectId, domainInfo.etld1);
    if (recentRun && !regenerate_intents) {
      return new Response(JSON.stringify({
        run_id: recentRun.id,
        status: recentRun.status,
        domain: domainInfo.etld1,
        intents: recentRun.intents_count
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate or get intents
    let intents;
    if (regenerate_intents) {
      intents = await intentGenerator.generateIntents(projectId, domainInfo, maxIntents);
    } else {
      intents = await intentGenerator.getIntents(projectId, domainInfo.etld1);
      if (intents.length === 0) {
        intents = await intentGenerator.generateIntents(projectId, domainInfo, maxIntents);
      }
    }

    // Create run
    const runId = `vi_run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await env.DB.prepare(`
      INSERT INTO visibility_runs 
      (id, project_id, audit_id, domain, audited_url, hostname, mode, intents_count, sources, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      runId,
      projectId,
      audit_id,
      domainInfo.etld1,
      domainInfo.audited_url,
      domainInfo.hostname,
      mode,
      intents.length,
      JSON.stringify(enabledSources),
      'processing'
    ).run();

    // Check if any connectors can run
    const availableSources = enabledSources.filter(source => hasRequiredApiKey(source, env));
    
    if (availableSources.length === 0) {
      // No API keys available, complete run immediately with empty results
      await env.DB.prepare(`
        UPDATE visibility_runs 
        SET finished_at = ?, status = 'complete'
        WHERE id = ?
      `).bind(new Date().toISOString(), runId).run();
      await logVIEvent(env, runId, 'run_complete', 'No API keys available, completed immediately');
    } else {
      // Enqueue the run for background processing
      if (env.VI_RUN_Q) {
        await env.VI_RUN_Q.send({ run_id: runId });
        await logVIEvent(env, runId, 'run_queued', `Queued for processing with ${availableSources.length} sources`);
      } else {
        // Fallback to direct execution if queue not available
        executeConnectors(env, runId, intents, availableSources, domainInfo).catch(error => {
          console.error(`[VIRoutes] Error executing connectors for run ${runId}:`, error);
        });
      }
    }

    return new Response(JSON.stringify({
      run_id: runId,
      status: 'processing',
      domain: domainInfo.etld1,
      intents: intents.length
    }), {
      status: 201,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('[VIRoutes] Error in handleRun:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to start run',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * Get visibility results
 */
async function handleResults(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const scorer = new VisibilityScorer(env);
    const url = new URL(request.url);
    const audit_id = url.searchParams.get('audit_id');
    const run_id = url.searchParams.get('run_id');
    const limit = parseInt(url.searchParams.get('limit') || '1000');

    if (!audit_id && !run_id) {
      return new Response(JSON.stringify({ error: 'audit_id or run_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let run;
    if (run_id) {
      run = await env.DB.prepare(`SELECT * FROM visibility_runs WHERE id = ?`).bind(run_id).first();
    } else {
      // Get latest run for audit
      run = await env.DB.prepare(`
        SELECT * FROM visibility_runs 
        WHERE audit_id = ? 
        ORDER BY started_at DESC 
        LIMIT 1
      `).bind(audit_id).first();
    }

    if (!run) {
      return new Response(JSON.stringify({ error: 'Run not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get results
    const results = await env.DB.prepare(`
      SELECT * FROM visibility_results 
      WHERE run_id = ? 
      ORDER BY occurred_at DESC 
      LIMIT ?
    `).bind((run as any).id, limit).all();

    // Get citations
    const citations = await env.DB.prepare(`
      SELECT vc.*, vr.source, vr.query
      FROM visibility_citations vc
      JOIN visibility_results vr ON vc.result_id = vr.id
      WHERE vr.run_id = ?
      ORDER BY vc.rank ASC, vc.ref_domain
      LIMIT ?
    `).bind((run as any).id, limit).all();

    // Calculate summary
    const summary = await calculateSummary(env, (run as any).id, (run as any).domain, scorer);

    return new Response(JSON.stringify({
      run,
      summary,
      results: results.results,
      citations: citations.results
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('[VIRoutes] Error in handleResults:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get results',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * Compare with competitors
 */
async function handleCompare(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const url = new URL(request.url);
    const audit_id = url.searchParams.get('audit_id');
    const competitors = url.searchParams.get('competitors')?.split(',') || [];

    if (!audit_id) {
      return new Response(JSON.stringify({ error: 'audit_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get latest run for audit
    const run = await env.DB.prepare(`
      SELECT * FROM visibility_runs 
      WHERE audit_id = ? 
      ORDER BY started_at DESC 
      LIMIT 1
    `).bind(audit_id).first();

    if (!run) {
      return new Response(JSON.stringify({ error: 'No run found for audit' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get competitor data (simplified for now)
    const comparison = {
      audited_domain: (run as any).domain,
      competitors: competitors.map(comp => ({
        domain: comp,
        score: Math.random() * 100, // Placeholder
        citations_count: Math.floor(Math.random() * 50)
      })),
      audited_score: await getOverallScore(env, (run as any).id)
    };

    return new Response(JSON.stringify(comparison), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[VIRoutes] Error in handleCompare:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to compare',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Export results as CSV
 */
async function handleExport(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const run_id = url.searchParams.get('run_id');

    if (!run_id) {
      return new Response(JSON.stringify({ error: 'run_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get citations for export
    const citations = await env.DB.prepare(`
      SELECT vc.ref_url, vc.ref_domain, vc.title, vc.snippet, vc.rank, vc.is_audited_domain,
             vr.source, vr.query, vr.visibility_score
      FROM visibility_citations vc
      JOIN visibility_results vr ON vc.result_id = vr.id
      WHERE vr.run_id = ?
      ORDER BY vr.source, vc.rank
    `).bind(run_id).all();

    // Generate CSV
    const headers = ['source', 'query', 'ref_domain', 'ref_url', 'rank', 'is_audited_domain', 'title', 'snippet', 'visibility_score'];
    const csvRows = [
      headers.join(','),
      ...(citations.results as any[]).map(row => 
        headers.map(header => {
          const value = row[header] || '';
          // Escape CSV values
          return typeof value === 'string' && value.includes(',') ? `"${value.replace(/"/g, '""')}"` : value;
        }).join(',')
      )
    ];

    return new Response(csvRows.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="visibility_results_${run_id}.csv"`
      }
    });
  } catch (error) {
    console.error('[VIRoutes] Error in handleExport:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to export',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Force regenerate intents
 */
async function handleGenerateIntents(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const intentGenerator = new IntentGenerator(env);
    const body = await request.json();
    const { project_id, domain, max_intents = 100 } = body;

    if (!project_id || !domain) {
      return new Response(JSON.stringify({ error: 'project_id and domain are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const domainInfo = normalizeFromUrl(`https://${domain}`);
    const intents = await intentGenerator.generateIntents(project_id, domainInfo, max_intents);

    return new Response(JSON.stringify({
      success: true,
      intents_count: intents.length,
      intents: intents.slice(0, 10) // Return first 10 as preview
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[VIRoutes] Error in handleGenerateIntents:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate intents',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Health check
 */
async function handleHealth(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    // Get run counts for last 24h
    const runCount = await env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM visibility_runs 
      WHERE started_at >= datetime('now', '-1 day')
    `).first();

    const successCount = await env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM visibility_runs 
      WHERE started_at >= datetime('now', '-1 day') AND status = 'complete'
    `).first();

    return new Response(JSON.stringify({
      status: 'healthy',
      runs_24h: (runCount as any)?.count || 0,
      success_rate: (runCount as any)?.count > 0 ? 
        ((successCount as any)?.count || 0) / ((runCount as any)?.count || 1) : 0,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[VIRoutes] Error in handleHealth:', error);
    return new Response(JSON.stringify({ 
      error: 'Health check failed',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Execute connectors for a run
 */
async function executeConnectors(
  env: Env,
  runId: string,
  intents: any[],
  sources: string[],
  domainInfo: any
): Promise<void> {
  const startTime = Date.now();
  const maxExecutionTime = 120000; // 2 minutes max
  
  try {
    const scorer = new VisibilityScorer(env);
    console.log(`[VIRoutes] Executing connectors for run ${runId}`);
    
    for (const intent of intents) {
      // Check timeout
      if (Date.now() - startTime > maxExecutionTime) {
        console.warn(`[VIRoutes] Timeout reached for run ${runId}, stopping execution`);
        break;
      }
      
      for (const source of sources) {
        const connector = getEnabledConnector(source, env);
        if (!connector) {
          console.warn(`[VIRoutes] Connector ${source} not enabled`);
          continue;
        }

        try {
          // Check if API key is available for this connector
          if (!hasRequiredApiKey(source, env)) {
            console.warn(`[VIRoutes] Missing API key for ${source}, skipping`);
            continue;
          }

          // Check cache first
          const cacheKey = getCacheKey(source, domainInfo.etld1, intent.query);
          let cached = null;
          if (env.KV_VI_CACHE) {
            cached = await env.KV_VI_CACHE.get(cacheKey, 'json');
          }

          let result;
          if (cached) {
            console.log(`[VIRoutes] Using cached result for ${source}:${intent.query}`);
            result = cached;
          } else {
            // Call connector
            console.log(`[VIRoutes] Calling ${source} connector for: ${intent.query}`);
            result = await connector.ask(intent.query, env);
            
            // Cache result
            if (env.KV_VI_CACHE) {
              const ttl = parseInt(env.VI_CACHE_TTL_SEC || '172800');
              await env.KV_VI_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: ttl });
            }
          }

          // Save result
          const resultId = `vi_result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await env.DB.prepare(`
            INSERT INTO visibility_results 
            (id, run_id, project_id, domain, audited_url, hostname, source, intent_id, query, visibility_score, raw_payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            resultId,
            runId,
            intent.project_id || 'unknown',
            domainInfo.etld1,
            domainInfo.audited_url,
            domainInfo.hostname,
            source,
            intent.id,
            intent.query,
            0, // Will be calculated later
            JSON.stringify(result)
          ).run();

          // Parse and save citations
          const citations = result.sources || [];
          for (let i = 0; i < citations.length; i++) {
            const citation = citations[i];
            const citationId = `vi_citation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            await env.DB.prepare(`
              INSERT INTO visibility_citations 
              (id, result_id, ref_url, ref_domain, title, snippet, rank, is_audited_domain)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              citationId,
              resultId,
              citation.url,
              new URL(citation.url).hostname,
              citation.title || '',
              citation.snippet || '',
              i + 1,
              citation.url.includes(domainInfo.etld1) ? 1 : 0
            ).run();
          }

          // Calculate and update score
          const score = scorer.calculateIntentScore(citations, domainInfo.etld1);
          await env.DB.prepare(`
            UPDATE visibility_results 
            SET visibility_score = ?
            WHERE id = ?
          `).bind(score, resultId).run();

        } catch (error) {
          console.error(`[VIRoutes] Error processing ${source} for intent ${intent.id}:`, error);
          // Continue with other sources/intents
        }
      }
    }

    // Calculate final scores and mark run as complete
    const competitors = await scorer.getCompetitors('unknown'); // TODO: Get from project
    const overallScore = await scorer.calculateOverallScore(runId, domainInfo.etld1, competitors);
    
    await env.DB.prepare(`
      UPDATE visibility_runs 
      SET finished_at = ?, status = 'complete'
      WHERE id = ?
    `).bind(new Date().toISOString(), runId).run();

    console.log(`[VIRoutes] Completed run ${runId} with score ${overallScore.score}`);
  } catch (error) {
    console.error(`[VIRoutes] Error executing connectors for run ${runId}:`, error);
    
    // Mark run as failed
    await env.DB.prepare(`
      UPDATE visibility_runs 
      SET finished_at = ?, status = 'failed'
      WHERE id = ?
    `).bind(new Date().toISOString(), runId).run();
  }
}

/**
 * Queue processor for VI runs
 */
export async function processVIRunFromQueue(runId: string, env: Env): Promise<void> {
  try {
    await logVIEvent(env, runId, 'processing_started', 'Queue consumer started processing');
    
    // Get run details
    const run = await env.DB.prepare(`
      SELECT * FROM visibility_runs WHERE id = ?
    `).bind(runId).first();
    
    if (!run) {
      await logVIEvent(env, runId, 'processing_error', 'Run not found');
      return;
    }

    // Get intents for this run
    const intents = await env.DB.prepare(`
      SELECT * FROM visibility_intents WHERE run_id = ? ORDER BY created_at
    `).bind(runId).all();

    const sources = JSON.parse((run as any).sources || '[]');
    const domainInfo = {
      etld1: (run as any).domain,
      hostname: (run as any).hostname
    };

    // Update status to processing and set initial heartbeat
    await env.DB.prepare(`
      UPDATE visibility_runs 
      SET status = 'processing', heartbeat_at = CURRENT_TIMESTAMP, progress = 0
      WHERE id = ?
    `).bind(runId).run();

    // Process with concurrency limit and timeouts
    const limit = pLimit(3); // Process 3 intents at a time
    const connectorTimeout = parseInt(env.VI_CONNECTOR_TIMEOUT_MS || '15000');
    
    let processed = 0;
    const total = intents.results?.length || 0;
    
    const results = await Promise.allSettled(
      (intents.results || []).map(intent => 
        limit(() => processIntentWithTimeout(runId, intent, sources, domainInfo, connectorTimeout, env))
      )
    );

    // Count successes and failures
    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;
    
    // Determine final status
    let finalStatus = 'complete';
    if (successes === 0) {
      finalStatus = 'failed';
    } else if (failures > 0) {
      finalStatus = 'partial_success';
    }

    // Update run status
    await env.DB.prepare(`
      UPDATE visibility_runs 
      SET status = ?, finished_at = CURRENT_TIMESTAMP, progress = ?, heartbeat_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(finalStatus, total, runId).run();

    await logVIEvent(env, runId, 'processing_complete', `Processed ${successes}/${total} intents successfully`);
    
  } catch (error) {
    console.error(`[VI Queue] Error processing run ${runId}:`, error);
    await env.DB.prepare(`
      UPDATE visibility_runs 
      SET status = 'failed', error = ?, finished_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(String(error), runId).run();
    await logVIEvent(env, runId, 'processing_error', `Error: ${error}`);
  }
}

async function processIntentWithTimeout(
  runId: string, 
  intent: any, 
  sources: string[], 
  domainInfo: any, 
  timeoutMs: number, 
  env: Env
): Promise<void> {
  return withTimeout(timeoutMs, async (signal) => {
    await logVIEvent(env, runId, 'intent_started', `Processing intent: ${intent.query}`, intent.id);
    
    for (const source of sources) {
      try {
        const connector = getEnabledConnector(source, env);
        if (!connector) {
          await logVIEvent(env, runId, 'connector_skipped', `Connector ${source} not enabled`, intent.id, source);
          continue;
        }

        if (!hasRequiredApiKey(source, env)) {
          await logVIEvent(env, runId, 'connector_skipped', `Missing API key for ${source}`, intent.id, source);
          continue;
        }

        // Check cache first
        const cacheKey = getCacheKey(source, domainInfo.etld1, intent.query);
        let cached = null;
        if (env.KV_VI_CACHE) {
          cached = await env.KV_VI_CACHE.get(cacheKey, 'json');
        }

        let result;
        if (cached) {
          await logVIEvent(env, runId, 'cache_hit', `Using cached result for ${source}`, intent.id, source);
          result = cached;
        } else {
          await logVIEvent(env, runId, 'connector_call', `Calling ${source} connector`, intent.id, source);
          result = await connector.ask(intent.query, env);
          
          // Cache the result
          if (env.KV_VI_CACHE && result) {
            const cacheTTL = parseInt(env.VI_CACHE_TTL_SEC || '172800');
            await env.KV_VI_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: cacheTTL });
          }
        }

        // Store results
        if (result && result.citations) {
          const scorer = new VisibilityScorer(env);
          await scorer.processConnectorResult(runId, intent.id, source, result);
          await logVIEvent(env, runId, 'result_stored', `Stored ${result.citations.length} citations`, intent.id, source);
        }

      } catch (error) {
        await logVIEvent(env, runId, 'connector_error', `Error with ${source}: ${error}`, intent.id, source);
        // Continue with other sources
      }
    }
  });
}

/**
 * Helper functions
 */
function hasRequiredApiKey(source: string, env: Env): boolean {
  switch (source) {
    case "perplexity":
      return !!env.PERPLEXITY_API_KEY;
    case "chatgpt_search":
      return !!env.OPENAI_API_KEY;
    case "claude":
      return !!env.CLAUDE_API_KEY;
    default:
      return false;
  }
}

async function getRecentRun(env: Env, projectId: string, domain: string): Promise<any> {
  const hours = parseInt(env.VI_RECENCY_HOURS || '6');
  return await env.DB.prepare(`
    SELECT * FROM visibility_runs 
    WHERE project_id = ? AND domain = ? AND status = 'complete'
      AND started_at >= datetime('now', '-${hours} hours')
    ORDER BY started_at DESC 
    LIMIT 1
  `).bind(projectId, domain).first();
}

async function calculateSummary(env: Env, runId: string, domain: string, scorer: VisibilityScorer): Promise<any> {
  const results = await env.DB.prepare(`
    SELECT source, AVG(visibility_score) as avg_score, COUNT(*) as count
    FROM visibility_results 
    WHERE run_id = ?
    GROUP BY source
  `).bind(runId).all();

  const citations = await env.DB.prepare(`
    SELECT COUNT(*) as total, 
           COUNT(DISTINCT ref_domain) as unique_domains,
           SUM(CASE WHEN is_audited_domain = 1 THEN 1 ELSE 0 END) as audited_citations
    FROM visibility_citations vc
    JOIN visibility_results vr ON vc.result_id = vr.id
    WHERE vr.run_id = ?
  `).bind(runId).first();

  const overallScore = await getOverallScore(env, runId);
  const coverage = await scorer.getSourceCoverage(runId);

  return {
    overall_score: overallScore,
    coverage,
    counts: {
      total_citations: (citations as any)?.total || 0,
      unique_domains_7d: (citations as any)?.unique_domains || 0,
      mentions_7d: (citations as any)?.audited_citations || 0,
      assistants: Object.keys(coverage).length
    },
    top_intents: await getTopIntents(env, runId),
    top_citations: await getTopCitations(env, runId, domain)
  };
}

async function getOverallScore(env: Env, runId: string): Promise<number> {
  const result = await env.DB.prepare(`
    SELECT AVG(visibility_score) as score
    FROM visibility_results 
    WHERE run_id = ?
  `).bind(runId).first();
  
  return Math.round(((result as any)?.score || 0) * 100) / 100;
}

async function getTopIntents(env: Env, runId: string): Promise<any[]> {
  const result = await env.DB.prepare(`
    SELECT vi.query, vr.visibility_score
    FROM visibility_results vr
    JOIN visibility_intents vi ON vr.intent_id = vi.id
    WHERE vr.run_id = ? AND vr.visibility_score > 0
    ORDER BY vr.visibility_score DESC
    LIMIT 10
  `).bind(runId).all();
  
  return result.results as any[];
}

async function getTopCitations(env: Env, runId: string, domain: string): Promise<any[]> {
  const result = await env.DB.prepare(`
    SELECT ref_domain, COUNT(*) as count
    FROM visibility_citations vc
    JOIN visibility_results vr ON vc.result_id = vr.id
    WHERE vr.run_id = ?
    GROUP BY ref_domain
    ORDER BY count DESC
    LIMIT 10
  `).bind(runId).all();
  
  return result.results as any[];
}
