/**
 * Geodude API Worker
 * Handles audits, analytics, and legacy endpoint deprecation
 */

import { runAudit } from './audit';
import { extractOrganization } from './html';
import { suggestSameAs } from './entity';
import { fetchCitations } from './citations';
import { createProject, createProperty, verifyProperty } from './onboarding';
import { backupToR2 } from './backup';
import { warmCitations } from './citations-warm';
import { handleCitations } from './routes/citations';
import { handleBotLogsIngest, handleGetCrawlers } from './bots/routes';

interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  RECO_CACHE?: KVNamespace;
  RECO_PRODUCER?: Queue;
  R2_BACKUPS: R2Bucket;
  USER_AGENT: string;
  AUDIT_MAX_PAGES: string;
  AUDIT_DAILY_LIMIT: string;
  HASH_SALT: string;
  BRAVE_SEARCH?: string;
  BRAVE_SEARCH_ENDPOINT?: string;
  CITATIONS_MAX_PER_QUERY?: string;
  CITATIONS_DAILY_BUDGET?: string;
  RESEND_KEY?: string;
  FROM_EMAIL?: string;
  ADMIN_BASIC_AUTH?: string;
  RECO_ALLOWED_DOMAINS?: string;
  OPENAI_API_KEY?: string;
}

// Helper: Validate API key
async function validateApiKey(apiKey: string | null, env: Env): Promise<{ valid: boolean; projectId?: string }> {
  if (!apiKey) {
    return { valid: false };
  }

  const project = await env.DB.prepare(
    'SELECT id FROM projects WHERE api_key = ?'
  ).bind(apiKey).first<{ id: string }>();

  if (!project) {
    return { valid: false };
  }

  return { valid: true, projectId: project.id };
}

// Helper: Check rate limit
async function checkRateLimit(projectId: string, env: Env): Promise<{ allowed: boolean; count: number; limit: number }> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `rl:${projectId}:${today}`;
  
  const currentCount = await env.RATE_LIMIT_KV.get(key);
  const count = currentCount ? parseInt(currentCount) : 0;
  const limit = parseInt(env.AUDIT_DAILY_LIMIT || '10');

  if (count >= limit) {
    return { allowed: false, count, limit };
  }

  // Increment counter
  await env.RATE_LIMIT_KV.put(key, (count + 1).toString(), {
    expirationTtl: 86400 * 2, // 2 days
  });

  return { allowed: true, count: count + 1, limit };
}

// Helper: Check citations budget (prevent excessive API calls)
async function checkCitationsBudget(env: Env): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `citations_budget:${today}`;
  
  const currentCount = await env.RATE_LIMIT_KV.get(key);
  const used = currentCount ? parseInt(currentCount) : 0;
  const budget = parseInt(env.CITATIONS_DAILY_BUDGET || '200');

  if (used >= budget) {
    console.warn(`Citations daily budget exceeded: ${used}/${budget}`);
    return false;
  }

  // Increment counter
  await env.RATE_LIMIT_KV.put(key, (used + 1).toString(), {
    expirationTtl: 86400 * 2, // 2 days
  });

  return true;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const hour = new Date().getUTCHours();
    
    // 03:00 UTC - Nightly backup
    if (hour === 3) {
      console.log('Nightly backup started at', new Date().toISOString());
      try {
        await backupToR2(env);
        console.log('Nightly backup completed');
      } catch (error) {
        console.error('Nightly backup failed:', error);
      }
      return;
    }
    
    // 06:00 UTC Monday - Weekly audits
    console.log('Cron audit started at', new Date().toISOString());

    // Get all verified properties
    const properties = await env.DB.prepare(
      'SELECT id, project_id, domain FROM properties WHERE verified = 1'
    ).all<{ id: string; project_id: string; domain: string }>();

    if (!properties.results || properties.results.length === 0) {
      console.log('No verified properties to audit');
      return;
    }

    console.log(`Found ${properties.results.length} verified properties to audit`);

    // Run audits sequentially with 1 RPS throttle
    for (const property of properties.results) {
      try {
        console.log(`Cron audit started: ${property.id} (${property.domain})`);
        const auditId = await runAudit(property.id, env);
        console.log(`Cron audit completed: ${property.id} → ${auditId}`);
        
        // 1 second delay between audits (1 RPS)
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Cron audit failed for ${property.id}:`, error);
      }
    }

    console.log('Cron audit batch completed');
    
    // Warm citations cache after audits
    try {
      console.log('Warming citations cache...');
      await warmCitations(env);
    } catch (error) {
      console.error('Citations warming failed:', error);
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for all responses
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

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint (public)
    if (path === '/health') {
      return new Response('ok', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    // GET /v1/citations/budget - Check daily citations budget (public for monitoring)
    if (path === '/v1/citations/budget' && request.method === 'GET') {
      const today = new Date().toISOString().split('T')[0];
      const key = `citations_budget:${today}`;
      
      const currentCount = await env.RATE_LIMIT_KV.get(key);
      const used = currentCount ? parseInt(currentCount) : 0;
      const max = parseInt(env.CITATIONS_DAILY_BUDGET || '200');
      
      return new Response(
        JSON.stringify({
          used,
          remaining: Math.max(0, max - used),
          max,
          date: today,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // GET /v1/admin/metrics - Admin metrics (requires Basic Auth)
    if (path === '/v1/admin/metrics' && request.method === 'GET') {
      const auth = request.headers.get('authorization') || '';
      const ok = auth.startsWith('Basic ') &&
        atob(auth.slice(6)) === (env.ADMIN_BASIC_AUTH || '');
      
      if (!ok) {
        return new Response('Unauthorized', {
          status: 401,
          headers: {
            ...corsHeaders,
            'WWW-Authenticate': 'Basic realm="Admin Metrics"',
          },
        });
      }

      try {
        const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
        
        const audits7 = await env.DB.prepare(
          'SELECT COUNT(*) as c FROM audits WHERE started_at >= ?'
        ).bind(new Date(sevenDaysAgo * 1000).toISOString()).first<{ c: number }>();
        
        const avgScore7 = await env.DB.prepare(
          'SELECT AVG(score_overall) as a FROM audits WHERE started_at >= ? AND score_overall IS NOT NULL'
        ).bind(new Date(sevenDaysAgo * 1000).toISOString()).first<{ a: number }>();
        
        const domains7 = await env.DB.prepare(
          'SELECT COUNT(DISTINCT property_id) as d FROM audits WHERE started_at >= ?'
        ).bind(new Date(sevenDaysAgo * 1000).toISOString()).first<{ d: number }>();

        // Clamp avg_score_7d to 0-100 and return as number
        const avgScore7d = Math.min(100, Math.max(0, Math.round(avgScore7?.a ?? 0)));

        return new Response(
          JSON.stringify({
            audits_7d: audits7?.c ?? 0,
            avg_score_7d: avgScore7d, // Number 0-100, not string
            domains_7d: domains7?.d ?? 0,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Failed to fetch metrics',
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // GET /status - System status page (public for monitoring)
    if (path === '/status' && request.method === 'GET') {
      try {
        // Get latest audit with AI access data
        const latestAudit = await env.DB.prepare(
          `SELECT id, status, completed_at, ai_access_json 
           FROM audits 
           WHERE status = 'completed' 
           ORDER BY completed_at DESC 
           LIMIT 1`
        ).first<{ id: string; status: string; completed_at: string; ai_access_json: string | null }>();

        // Parse AI access from latest audit
        const aiAccessRaw = latestAudit?.ai_access_json ? JSON.parse(latestAudit.ai_access_json) : null;
        const aiAccess = aiAccessRaw ? {
          allowed: aiAccessRaw.results.filter((r: any) => r.ok).length,
          blocked: aiAccessRaw.results.filter((r: any) => r.blocked).length,
          tested: aiAccessRaw.results.length,
          waf: aiAccessRaw.results.find((r: any) => r.cfRay) ? 'Cloudflare' :
               aiAccessRaw.results.find((r: any) => r.akamai) ? 'Akamai' : null,
        } : null;

        // Get citations budget
        const today = new Date().toISOString().split('T')[0];
        const budgetKey = `citations_budget:${today}`;
        const budgetUsed = parseInt((await env.RATE_LIMIT_KV.get(budgetKey)) || '0');
        const budgetMax = parseInt(env.CITATIONS_DAILY_BUDGET || '200');

        return new Response(
          JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            latest_audit: latestAudit ? {
              id: latestAudit.id,
              completed_at: latestAudit.completed_at,
            } : null,
            ai_access: aiAccess,
            citations_budget: {
              used: budgetUsed,
              remaining: Math.max(0, budgetMax - budgetUsed),
              max: budgetMax,
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // POST /v1/projects - Create new project (open for now)
    if (path === '/v1/projects' && request.method === 'POST') {
      try {
        const body = await request.json<{ name: string; owner_email?: string }>();
        
        if (!body.name || body.name.trim().length === 0) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'name is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const project = await createProject(env, body.name, body.owner_email);

        return new Response(
          JSON.stringify(project),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Failed to create project',
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // POST /v1/properties - Create new property (requires auth)
    if (path === '/v1/properties' && request.method === 'POST') {
      const apiKey = request.headers.get('x-api-key');
      const authResult = await validateApiKey(apiKey, env);

      if (!authResult.valid) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized', message: 'Valid x-api-key header required' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      try {
        const body = await request.json<{ project_id: string; domain: string }>();
        
        if (!body.project_id || !body.domain) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'project_id and domain are required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Verify project belongs to this API key
        const project = await env.DB.prepare(
          'SELECT id FROM projects WHERE id = ? AND api_key = ?'
        ).bind(body.project_id, apiKey).first();

        if (!project) {
          return new Response(
            JSON.stringify({ error: 'Forbidden', message: 'Project not found or access denied' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const property = await createProperty(env, body.project_id, body.domain);

        return new Response(
          JSON.stringify(property),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Failed to create property',
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // POST /v1/properties/:id/verify - Verify property ownership (requires auth)
    if (path.match(/^\/v1\/properties\/[^/]+\/verify$/) && request.method === 'POST') {
      const propertyId = path.split('/')[3];
      const apiKey = request.headers.get('x-api-key');
      const authResult = await validateApiKey(apiKey, env);

      if (!authResult.valid) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized', message: 'Valid x-api-key header required' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      try {
        const body = await request.json<{ method: 'dns' | 'html' }>();
        
        if (!body.method || (body.method !== 'dns' && body.method !== 'html')) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'method must be "dns" or "html"' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Verify property belongs to a project owned by this API key
        const property = await env.DB.prepare(
          `SELECT p.id FROM properties p
           JOIN projects pr ON p.project_id = pr.id
           WHERE p.id = ? AND pr.api_key = ?`
        ).bind(propertyId, apiKey).first();

        if (!property) {
          return new Response(
            JSON.stringify({ error: 'Forbidden', message: 'Property not found or access denied' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const result = await verifyProperty(env, propertyId, body.method);

        return new Response(
          JSON.stringify(result),
          {
            status: result.verified ? 200 : 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Verification failed',
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // POST /v1/citations - Multi-provider citation search
    if (path === '/v1/citations' && request.method === 'POST') {
      return handleCitations(request, env);
    }

    // POST /v1/botlogs/ingest - Admin-only AI bot log ingestion (Phase G)
    if (path === '/v1/botlogs/ingest' && request.method === 'POST') {
      return handleBotLogsIngest(request, env);
    }

    // GET /v1/audits/:id/crawlers - Get AI crawler summary for audit (Phase G)
    if (path.match(/^\/v1\/audits\/[^/]+\/crawlers$/) && request.method === 'GET') {
      const auditId = path.split('/')[3];
      return handleGetCrawlers(auditId, env, url.searchParams);
    }

    // POST /v1/reco - Generate content recommendations (synchronous, 15-25s)
    if (path === '/v1/reco' && request.method === 'POST') {
      try {
        const body = await request.json<{ url: string; audit_id?: string; page_id?: string; refresh?: boolean }>();
        const refresh = body.refresh || url.searchParams.get('refresh') === '1';
        
        if (!body.url || !/^https?:\/\//i.test(body.url)) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Provide a valid absolute URL' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Domain allowlist (safety)
        const allowed = (env.RECO_ALLOWED_DOMAINS || '').split(',').map(d => d.trim().toLowerCase());
        const host = new URL(body.url).host.toLowerCase();
        
        if (allowed.length > 0 && !allowed.includes(host)) {
          return new Response(
            JSON.stringify({ error: 'Forbidden', message: `Domain ${host} not allowed for content recommendations` }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const id = crypto.randomUUID();
        const now = Date.now();
        
        // Create job record
        await env.DB.prepare(
          `INSERT INTO reco_jobs (id, url, audit_id, page_id, status, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, body.url, body.audit_id || null, body.page_id || null, 'processing', now, now).run();

        // Generate recommendations synchronously (reuses renderPage from audit!)
        const { generateRecommendations } = await import('./reco-simple');
        const result = await generateRecommendations(env, {
          url: body.url,
          audit_id: body.audit_id,
          page_id: body.page_id,
          refresh
        });

        // Save result
        await env.DB.prepare(
          `UPDATE reco_jobs 
           SET status = 'done', result_json = ?, updated_at = ? 
           WHERE id = ?`
        ).bind(JSON.stringify(result), Date.now(), id).run();

        return new Response(
          JSON.stringify({ ok: true, id, status: 'done', result }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        console.error('[reco] Error:', error);
        return new Response(
          JSON.stringify({
            error: 'Failed to generate recommendations',
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // GET /v1/reco/:id - Get recommendation job status
    if (path.match(/^\/v1\/reco\/[^/]+$/) && request.method === 'GET') {
      const id = path.split('/').pop()!;
      
      try {
        const row = await env.DB.prepare(
          `SELECT * FROM reco_jobs WHERE id = ?`
        ).bind(id).first<any>();
        
        if (!row) {
          return new Response(
            JSON.stringify({ error: 'Not Found', message: `Job ${id} not found` }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Parse result_json if present
        let result = null;
        if (row.result_json) {
          try {
            result = JSON.parse(row.result_json);
          } catch (e) {
            console.error('Failed to parse result_json:', e);
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            job: {
              id: row.id,
              url: row.url,
              audit_id: row.audit_id,
              page_id: row.page_id,
              status: row.status,
              created_at: row.created_at,
              updated_at: row.updated_at,
              input_hash: row.input_hash,
              result,
              error: row.error,
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Failed to fetch job',
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // POST /v1/audits/:id/rerun - Re-run an existing audit (public, no auth required)
    if (path.match(/^\/v1\/audits\/[^/]+\/rerun$/) && request.method === 'POST') {
      const auditId = path.split('/')[3];

      // Fetch original audit
      const originalAudit = await env.DB.prepare(
        `SELECT a.id, a.property_id, p.project_id, p.domain
         FROM audits a
         JOIN properties p ON p.id = a.property_id
         WHERE a.id = ?`
      ).bind(auditId).first();

      if (!originalAudit) {
        return new Response(
          JSON.stringify({ error: 'Audit not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Optional: Check API key if provided (for ownership verification)
      const apiKey = request.headers.get('x-api-key');
      let authResult = null;
      
      if (apiKey) {
        authResult = await validateApiKey(apiKey, env);
        
        // If API key is provided but invalid, reject
        if (!authResult.valid) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized', message: 'Invalid x-api-key header' }),
            {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // If API key is valid but doesn't own this audit, reject
        if (originalAudit.project_id && originalAudit.project_id !== authResult.projectId) {
          return new Response(
            JSON.stringify({ error: 'Forbidden', message: 'You do not own this audit' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // Check rate limit (use property's project_id or fallback to 'public' for unauthenticated requests)
      const projectIdForRateLimit = originalAudit.project_id || 'public';
      const rateLimit = await checkRateLimit(projectIdForRateLimit, env);
      
      if (!rateLimit.allowed) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded', 
            message: `Daily limit of ${rateLimit.limit} audits reached. Current count: ${rateLimit.count}`,
            retry_after: '24 hours'
          }),
          {
            status: 429,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': rateLimit.limit.toString(),
              'X-RateLimit-Remaining': '0',
              'Retry-After': '86400',
            },
          }
        );
      }

      try {
        // Start new audit for same property
        const newAuditId = await runAudit(originalAudit.property_id, env);

        return new Response(
          JSON.stringify({
            ok: true,
            id: newAuditId,
            rerun_of: auditId,
            property_id: originalAudit.property_id,
            domain: originalAudit.domain,
            url: `https://app.optiview.ai/a/${newAuditId}`,
          }),
          {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error: any) {
        console.error('Re-run audit failed:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Audit failed', 
            message: error?.message || 'Unknown error' 
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // POST /v1/audits/start - Start a new audit (requires auth)
    if (path === '/v1/audits/start' && request.method === 'POST') {
      // Check API key
      const apiKey = request.headers.get('x-api-key');
      const authResult = await validateApiKey(apiKey, env);

      if (!authResult.valid) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized', message: 'Valid x-api-key header required' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Check rate limit
      const rateLimit = await checkRateLimit(authResult.projectId!, env);
      
      if (!rateLimit.allowed) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded', 
            message: `Daily limit of ${rateLimit.limit} audits reached. Current count: ${rateLimit.count}`,
            retry_after: '24 hours'
          }),
          {
            status: 429,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': rateLimit.limit.toString(),
              'X-RateLimit-Remaining': '0',
              'Retry-After': '86400',
            },
          }
        );
      }

      try {
        const body = await request.json() as { 
          property_id: string;
          maxPages?: number;
          filters?: {
            include?: string[];
            exclude?: string[];
          };
        };
        
        if (!body.property_id) {
          return new Response(
            JSON.stringify({ error: 'property_id is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Validate and compile filters
        const maxPages = Math.max(10, Math.min(200, body.maxPages ?? 100));
        
        const compileRegexArray = (arr?: string[], listName?: string): RegExp[] | { error: string } => {
          if (!arr || arr.length === 0) return [];
          const out: RegExp[] = [];
          for (let i = 0; i < arr.length; i++) {
            try {
              out.push(new RegExp(arr[i]));
            } catch (e: any) {
              return { error: `Invalid ${listName} regex [${i}]: ${e.message || String(e)}` };
            }
          }
          return out;
        };

        const includePatterns = compileRegexArray(body.filters?.include, 'include');
        if ('error' in includePatterns) {
          return new Response(
            JSON.stringify({ ok: false, error: includePatterns.error }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const excludePatterns = compileRegexArray(body.filters?.exclude, 'exclude');
        if ('error' in excludePatterns) {
          return new Response(
            JSON.stringify({ ok: false, error: excludePatterns.error }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Verify property belongs to this project
        const property = await env.DB.prepare(
          'SELECT id FROM properties WHERE id = ? AND project_id = ?'
        ).bind(body.property_id, authResult.projectId).first();

        if (!property) {
          return new Response(
            JSON.stringify({ error: 'Property not found or access denied' }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const auditId = await runAudit(body.property_id, env, {
          maxPages,
          filters: {
            include: includePatterns as RegExp[],
            exclude: excludePatterns as RegExp[],
          },
        });

        // Fetch the completed audit
        const audit = await env.DB.prepare(
          `SELECT id, property_id, status, score_overall, score_crawlability, 
                  score_structured, score_answerability, score_trust, 
                  pages_crawled, pages_total, issues_count, 
                  started_at, completed_at, error
           FROM audits WHERE id = ?`
        ).bind(auditId).first();

        // Transform scores for consistency with GET endpoint
        const scores = audit.score_overall !== null ? {
          total: audit.score_overall,
          crawlability: audit.score_crawlability,
          structured: audit.score_structured,
          answerability: audit.score_answerability,
          trust: audit.score_trust,
        } : null;

        const response = {
          id: audit.id,
          property_id: audit.property_id,
          status: audit.status,
          scores: scores,
          pages_crawled: audit.pages_crawled,
          pages_total: audit.pages_total,
          issues_count: audit.issues_count,
          started_at: audit.started_at,
          completed_at: audit.completed_at,
          error: audit.error,
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Audit failed',
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // GET /v1/audits/:id/citations - Get citations for audit with pagination and filtering
    if (path.match(/^\/v1\/audits\/[^/]+\/citations$/) && request.method === 'GET') {
      const auditId = path.split('/')[3];
      const url = new URL(request.url);
      
      // Parse pagination params
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
      const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
      const offset = (page - 1) * pageSize;
      
      // Parse filter params
      const typeFilter = url.searchParams.get('type') as 'AEO' | 'GEO' | 'Organic' | null;
      const pathFilter = url.searchParams.get('path');
      const providerFilter = url.searchParams.get('provider'); // 'Brave' or null
      const modeFilter = url.searchParams.get('mode') as 'grounding' | 'summarizer' | null;
      const isAIOfferedFilter = url.searchParams.get('isAIOffered') === 'true';

      try {
        // Get all regular citations from DB
        const result = await env.DB.prepare(
          `SELECT engine, query, url, title, cited_at
           FROM citations
           WHERE audit_id = ?
           ORDER BY cited_at DESC`
        ).bind(auditId).all();
        
        // Import classification function
        const { classifyCitation } = await import('./citations');
        
        // Helper to extract pathname
        const extractPath = (url: string) => {
          try {
            return new URL(url).pathname.replace(/\/+$/, '') || '/';
          } catch {
            return null;
          }
        };
        
        // Add type and pathname to all DB citations
        let allCitations = (result.results || []).map((c: any) => ({
          ...c,
          type: classifyCitation(c),
          pagePathname: extractPath(c.url),
          provider: c.engine === 'brave' ? 'Brave' : null,
          mode: null,
          isAIOffered: false
        }));
        
        // Fetch Brave AI citations from brave_ai_json
        const auditRow = await env.DB.prepare(
          'SELECT brave_ai_json FROM audits WHERE id = ?'
        ).bind(auditId).first<{ brave_ai_json: string | null }>();
        
        if (auditRow?.brave_ai_json) {
          try {
            const braveData = JSON.parse(auditRow.brave_ai_json);
            const queries = braveData.queries || [];
            
            // Extract Brave AI sources
            for (const query of queries) {
              for (const source of (query.sources || [])) {
                allCitations.push({
                  engine: 'brave',
                  query: query.query,
                  url: source.url,
                  title: source.title || null,
                  cited_at: Date.now(), // Use current time for AI sources
                  type: 'AEO', // Brave AI answers are AEO signals
                  pagePathname: extractPath(source.url),
                  provider: 'Brave',
                  mode: query.mode,
                  isAIOffered: true
                });
              }
            }
          } catch (e) {
            console.error('Failed to parse brave_ai_json:', e);
          }
        }
        
        // Apply filters
        if (typeFilter) {
          allCitations = allCitations.filter((c: any) => c.type === typeFilter);
        }
        if (pathFilter) {
          allCitations = allCitations.filter((c: any) => c.pagePathname === pathFilter);
        }
        if (providerFilter) {
          allCitations = allCitations.filter((c: any) => c.provider === providerFilter);
        }
        if (modeFilter) {
          allCitations = allCitations.filter((c: any) => c.mode === modeFilter);
        }
        if (isAIOfferedFilter) {
          allCitations = allCitations.filter((c: any) => c.isAIOffered === true);
        }
        
        // Calculate counts for all types (before pagination)
        const counts = {
          AEO: allCitations.filter((c: any) => c.type === 'AEO').length,
          GEO: allCitations.filter((c: any) => c.type === 'GEO').length,
          Organic: allCitations.filter((c: any) => c.type === 'Organic').length
        };
        
        // Paginate
        const items = allCitations.slice(offset, offset + pageSize);
        
        return new Response(
          JSON.stringify({ 
            ok: true,
            total: allCitations.length,
            counts,
            page,
            pageSize,
            items
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Failed to fetch citations',
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // GET /v1/debug/env - Check if BROWSER binding is available
    if (path === '/v1/debug/env' && request.method === 'GET') {
      const hasBrowser = !!env.BROWSER;
      return new Response(
        JSON.stringify({ ok: true, hasBrowser }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /v1/debug/ai-access/:auditId - Get AI bot probe results
    if (path.match(/^\/v1\/debug\/ai-access\/[^/]+$/) && request.method === 'GET') {
      const auditId = path.split('/').pop()!;
      const row = await env.DB.prepare(
        'SELECT ai_access_json FROM audits WHERE id = ?'
      ).bind(auditId).first<{ ai_access_json: string | null }>();
      
      return new Response(
        JSON.stringify({ 
          ok: true, 
          auditId, 
          aiAccess: row?.ai_access_json ? JSON.parse(row.ai_access_json) : null 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /v1/debug/render - Quick render test endpoint
    if (path === '/v1/debug/render' && request.method === 'GET') {
      const testUrl = url.searchParams.get('url');
      const force = url.searchParams.get('force') as 'browser' | 'html' | null;
      
      if (!testUrl) {
        return new Response(
          JSON.stringify({ error: 'Missing url query parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const { renderPage } = await import('./render');
        
        // Clear any previous error hint
        (globalThis as any).__render_error_hint = undefined;
        
        const result = await renderPage(env, testUrl, { 
          force: force || undefined,
          debug: true 
        });
        
        const hint = (globalThis as any).__render_error_hint;
        
        return new Response(
          JSON.stringify({
            ok: true,
            mode: result.mode,
            words: result.words,
            snippet: result.snippet,
            hasH1: result.hasH1,
            jsonLdCount: result.jsonLdCount,
            status: result.status,
            forced: force || 'auto',
            hint: hint || undefined,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error: any) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Render failed',
            message: error?.message || String(error),
            forced: force || 'auto',
            hint: error?.message || String(error),
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // GET /v1/audits/:id/page - Get page-level report
    if (path.match(/^\/v1\/audits\/[^/]+\/page$/) && request.method === 'GET') {
      const auditId = path.split('/')[3];
      const rawU = url.searchParams.get('u') ?? '';
      
      if (!rawU) {
        return new Response(
          JSON.stringify({ error: 'Missing u query (path or absolute URL)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Normalize: extract pathname if full URL provided
        let normalized = rawU;
        if (rawU.startsWith('http')) {
          try {
            const urlObj = new URL(rawU);
            normalized = urlObj.pathname;
          } catch (e) {
            console.warn(`[page] Invalid URL: ${rawU}, using as-is`);
          }
        }
        
        console.log(`[page] Looking for page: ${normalized} in audit ${auditId}`);

        // 1) Find the exact page row (search by pathname or full URL)
        const pageRow = await env.DB.prepare(
          `SELECT url, status_code, title, h1, has_h1, jsonld_count, faq_present,
                  word_count, rendered_words, snippet
           FROM audit_pages
           WHERE audit_id = ? AND (url = ? OR url LIKE '%' || ?)
           ORDER BY (url = ?) DESC
           LIMIT 1`
        ).bind(auditId, normalized, normalized, normalized).first();
        
        console.log(`[page] Found page row:`, !!pageRow, `(searched for: "${normalized}")`);

        if (!pageRow) {
          return new Response(
            JSON.stringify({ error: 'Page not found for this audit' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 2) Issues for that page
        const pageIssues = await env.DB.prepare(
          `SELECT issue_type, severity, message, page_url, details
           FROM audit_issues
           WHERE audit_id = ? AND page_url = ?
           ORDER BY
             CASE severity 
               WHEN 'critical' THEN 3 
               WHEN 'high' THEN 2 
               WHEN 'warning' THEN 1 
               ELSE 0 
             END DESC,
             issue_type ASC`
        ).bind(auditId, pageRow.url).all();

        // 3) Lightweight page score breakdown (use rendered_words)
        const scoreHints = {
          has_h1: !!pageRow.has_h1,
          has_json_ld: (pageRow.jsonld_count ?? 0) > 0,
          word_ok: (pageRow.rendered_words ?? pageRow.word_count ?? 0) >= 120,
          faq_ok: !!pageRow.faq_present,
        };

        // Transform issues to frontend shape
        const issues = (pageIssues.results as any[]).map((r: any) => ({
          category: (r.issue_type || '').split('_')[0] || 'general',
          code: r.issue_type,
          severity: r.severity,
          message: r.message,
          url: r.page_url,
          details: r.details,
        }));

        return new Response(
          JSON.stringify({
            audit_id: auditId,
            page: {
              url: pageRow.url,
              title: pageRow.title,
              statusCode: pageRow.status_code,
              words: pageRow.rendered_words ?? pageRow.word_count,
              snippet: pageRow.snippet,
              hasH1: !!pageRow.has_h1,
              jsonLdCount: pageRow.jsonld_count ?? 0,
              faqOnPage: !!pageRow.faq_present, // Per-page FAQ detection
              score_hints: scoreHints,
            },
            issues,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Failed to fetch page details',
            message: error instanceof Error ? error.message : String(error),
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // GET /v1/audits/:id/pages/:pageUrl/recommendations - Get per-page schema recommendations (canonical)
    if (path.match(/^\/v1\/audits\/[^/]+\/pages\/[^/]+\/recommendations$/) && request.method === 'GET') {
      const pathParts = path.split('/');
      const auditId = pathParts[3];
      const encodedPageUrl = pathParts[5];
      
      if (!encodedPageUrl) {
        return new Response(
          JSON.stringify({ error: 'Missing page URL in path' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const pageUrl = decodeURIComponent(encodedPageUrl);
        
        // Fetch page data from audit
        const page = await env.DB.prepare(`
          SELECT url, title, h1, rendered_words, word_count, jsonld_count, faq_present
          FROM audit_pages
          WHERE audit_id = ? AND url = ?
        `).bind(auditId, pageUrl).first<any>();

        if (!page) {
          return new Response(
            JSON.stringify({ error: 'Page not found in audit' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Extract JSON-LD types from the page (stub for now - enhance later)
        // TODO: Parse actual JSON-LD from rendered content
        const jsonLdTypes: string[] = [];

        // Parse URL to get path segments
        let pathSegments: string[] = [];
        try {
          const urlObj = new URL(pageUrl);
          pathSegments = urlObj.pathname.split('/').filter(s => s.length > 0);
        } catch {}

        // Build signals for recommendation engine
        const signals = {
          url: pageUrl,
          title: page.title,
          h1: page.h1,
          words: page.rendered_words ?? page.word_count ?? 0,
          jsonLdCount: page.jsonld_count ?? 0,
          jsonLdTypes,
          faqPresent: page.faq_present ?? false,
          hasPrice: false,  // TODO: Detect from rendered content
          hasAddress: false,  // TODO: Detect from rendered content
          hasPhone: false,  // TODO: Detect from rendered content
          hasList: false,  // TODO: Detect from rendered content
          hasHowTo: false,  // TODO: Detect from rendered content
          pathSegments,
        };

        // Import and call recommendation engine
        const { getRecommendations } = await import('./recommend');
        const recommendations = getRecommendations(signals);

        return new Response(
          JSON.stringify({ ok: true, ...recommendations }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('Recommendations error:', error);
        return new Response(
          JSON.stringify({
            error: 'Failed to generate recommendations',
            message: error instanceof Error ? error.message : String(error),
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // GET /v1/audits/:id/page/recommendations - Alias for backward compatibility (deprecated)
    if (path.match(/^\/v1\/audits\/[^/]+\/page\/recommendations$/) && request.method === 'GET') {
      const auditId = path.split('/')[3];
      const rawU = url.searchParams.get('u') ?? '';
      
      if (!rawU) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameter: u (page URL)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const pageUrl = decodeURIComponent(rawU);
        
        // Fetch page data from audit
        const page = await env.DB.prepare(`
          SELECT url, title, h1, rendered_words, word_count, jsonld_count, faq_present
          FROM audit_pages
          WHERE audit_id = ? AND url = ?
        `).bind(auditId, pageUrl).first<any>();

        if (!page) {
          return new Response(
            JSON.stringify({ error: 'Page not found in audit' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Extract JSON-LD types (stub)
        const jsonLdTypes: string[] = [];

        // Parse URL path segments
        let pathSegments: string[] = [];
        try {
          const urlObj = new URL(pageUrl);
          pathSegments = urlObj.pathname.split('/').filter(s => s.length > 0);
        } catch {}

        // Build signals
        const signals = {
          url: pageUrl,
          title: page.title,
          h1: page.h1,
          words: page.rendered_words ?? page.word_count ?? 0,
          jsonLdCount: page.jsonld_count ?? 0,
          jsonLdTypes,
          faqPresent: page.faq_present ?? false,
          hasPrice: false,
          hasAddress: false,
          hasPhone: false,
          hasList: false,
          hasHowTo: false,
          pathSegments,
        };

        const { getRecommendations } = await import('./recommend');
        const recommendations = getRecommendations(signals);

        return new Response(
          JSON.stringify({ ok: true, ...recommendations }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('Recommendations error:', error);
        return new Response(
          JSON.stringify({
            error: 'Failed to generate recommendations',
            message: error instanceof Error ? error.message : String(error),
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // GET /v1/audits/:id/brave/queries - Get Brave AI query logs with pagination & filtering (Phase F+)
    if (path.match(/^\/v1\/audits\/[^/]+\/brave\/queries$/) && request.method === 'GET') {
      const auditId = path.split('/')[3];
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '50'), 200);
      const bucket = url.searchParams.get('bucket'); // Filter by bucket (e.g., "brand_core")
      const status = url.searchParams.get('status'); // Filter by status (e.g., "ok", "empty", "rate_limited")
      
      try {
        const audit = await env.DB.prepare(
          'SELECT brave_ai_json FROM audits WHERE id = ?'
        ).bind(auditId).first<{ brave_ai_json: string | null }>();
        
        if (!audit) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Audit not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const braveData = audit.brave_ai_json ? JSON.parse(audit.brave_ai_json) : { queries: [] };
        let queries = braveData.queries || [];
        
        // Phase F+: Apply filters
        if (bucket) {
          queries = queries.filter((q: any) => q.bucket === bucket);
        }
        if (status) {
          queries = queries.filter((q: any) => q.queryStatus === status);
        }
        
        // Phase F+: Compute diagnostics summary
        const diagnostics = {
          total: queries.length,
          ok: queries.filter((q: any) => q.queryStatus === 'ok').length,
          empty: queries.filter((q: any) => q.queryStatus === 'empty').length,
          rate_limited: queries.filter((q: any) => q.queryStatus === 'rate_limited').length,
          error: queries.filter((q: any) => q.queryStatus === 'error').length,
          timeout: queries.filter((q: any) => q.queryStatus === 'timeout').length,
        };
        
        // Paginate
        const total = queries.length;
        const start = (page - 1) * pageSize;
        const items = queries.slice(start, start + pageSize);
        
        return new Response(
          JSON.stringify({
            ok: true,
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
            filters: { bucket, status },
            diagnostics,
            items
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Failed to fetch Brave AI queries',
            message: error instanceof Error ? error.message : String(error)
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // POST /v1/audits/:id/brave/run-more - Run additional Brave AI queries (Phase F+)
    if (path.match(/^\/v1\/audits\/[^/]+\/brave\/run-more$/) && request.method === 'POST') {
      const auditId = path.split('/')[3];
      
      try {
        const body = await request.json().catch(() => ({ add: 10 }));
        const addCount = Math.max(1, Math.min(Number(body?.add ?? 10), Number(env.BRAVE_AI_HARD_CAP ?? 60)));
        const extraTerms = Array.isArray(body?.extraTerms) 
          ? body.extraTerms.map((t: any) => String(t).trim()).filter(Boolean)
          : [];
        
        // Fetch audit and property data
        const audit = await env.DB.prepare(
          'SELECT audits.id, audits.property_id, audits.brave_ai_json, properties.domain, properties.name FROM audits JOIN properties ON audits.property_id = properties.id WHERE audits.id = ?'
        ).bind(auditId).first<{
          id: string;
          property_id: string;
          brave_ai_json: string | null;
          domain: string;
          name: string | null;
        }>();
        
        if (!audit) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Audit not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Check if we have the Brave AI key
        if (!env.BRAVE_SEARCH_AI) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Brave AI not configured' }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Parse existing queries
        const prevData = audit.brave_ai_json ? JSON.parse(audit.brave_ai_json) : { queries: [] };
        const existingQueries = new Set((prevData.queries || []).map((q: any) => q.q));
        
        // Fetch pages for this audit
        const pagesResult = await env.DB.prepare(
          'SELECT url, h1, word_count FROM audit_pages WHERE audit_id = ?'
        ).bind(auditId).all();
        
        const pages = (pagesResult.results || []).map((p: any) => ({
          path: new URL(p.url).pathname || '/',
          h1: p.h1 || null,
          words: p.word_count || 0
        }));
        
        // Generate smart queries
        const brand = audit.name || audit.domain.replace(/^www\./, '').split('.')[0];
        const { buildSmartQueries, runBraveAIQueries } = await import('./brave/ai');
        
        const smartQueries = buildSmartQueries({
          brand,
          domain: audit.domain,
          pages,
          extraTerms,
          maxQueries: addCount,
          hardCap: Number(env.BRAVE_AI_HARD_CAP ?? 60),
          enableCompare: env.BRAVE_AI_ENABLE_COMPARE === 'true'
        }).filter(q => !existingQueries.has(q)); // Avoid duplicates
        
        if (smartQueries.length === 0) {
          return new Response(
            JSON.stringify({
              ok: true,
              added: 0,
              totalQueries: prevData.queries.length,
              message: 'No new queries generated (all duplicates)'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Run the queries
        const newLogs = await runBraveAIQueries(
          env.BRAVE_SEARCH_AI,
          smartQueries,
          audit.domain,
          {
            timeoutMs: Number(env.BRAVE_TIMEOUT_MS ?? 7000),
            concurrency: Number(env.BRAVE_CONCURRENCY ?? 2)
          }
        );
        
        // Merge with existing logs
        const mergedData = {
          ...prevData,
          queries: (prevData.queries || []).concat(newLogs)
        };
        
        // Save back to database
        await env.DB.prepare(
          'UPDATE audits SET brave_ai_json = ? WHERE id = ?'
        ).bind(JSON.stringify(mergedData), auditId).run();
        
        return new Response(
          JSON.stringify({
            ok: true,
            added: newLogs.length,
            totalQueries: mergedData.queries.length
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (error) {
        console.error('Run-more Brave AI failed:', error);
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Failed to run additional queries',
            message: error instanceof Error ? error.message : String(error)
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // GET /v1/audits/:id - Get audit details (public for now, could add auth later)
    if (path.match(/^\/v1\/audits\/[^/]+$/) && request.method === 'GET') {
      const auditId = path.split('/')[3];

      if (!auditId) {
        return new Response(
          JSON.stringify({ error: 'Audit ID is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      try {
        // Get audit
        const audit = await env.DB.prepare(
          `SELECT id, property_id, status, score_overall, score_crawlability, 
                  score_structured, score_answerability, score_trust, 
                  pages_crawled, pages_total, issues_count, 
                  started_at, completed_at, error, ai_access_json, ai_flags_json, brave_ai_json
           FROM audits WHERE id = ?`
        ).bind(auditId).first();

        if (!audit) {
          return new Response(
            JSON.stringify({ error: 'Audit not found' }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Get pages
        const pagesResult = await env.DB.prepare(
          `SELECT url, status_code, title, h1, has_h1, jsonld_count, faq_present, 
                  word_count, rendered_words, snippet, load_time_ms, error
           FROM audit_pages WHERE audit_id = ?
           ORDER BY url`
        ).bind(auditId).all();
        
        // Normalize field names to camelCase
        const pages = {
          results: (pagesResult.results || []).map((p: any) => ({
            url: p.url,
            statusCode: p.status_code,
            title: p.title,
            h1: p.h1,
            hasH1: !!p.has_h1,
            jsonLdCount: p.jsonld_count ?? 0,
            faqOnPage: !!p.faq_present, // Per-page FAQ detection
            words: p.rendered_words ?? p.word_count ?? 0,
            snippet: p.snippet,
            loadTimeMs: p.load_time_ms,
            error: p.error,
          })),
        };

        // Get issues
        const issues = await env.DB.prepare(
          `SELECT page_url, issue_type, severity, message, details
           FROM audit_issues WHERE audit_id = ?
           ORDER BY severity DESC, page_url`
        ).bind(auditId).all();

        // Get property domain for entity recommendations
        const property = await env.DB.prepare(
          'SELECT domain FROM properties WHERE id = ?'
        ).bind(audit.property_id).first<{ domain: string }>();

        // Check for entity recommendations (Organization sameAs)
        let entity_recommendations = null;
        if (property && pages.results && pages.results.length > 0) {
          // Get the first page's JSON-LD (usually homepage)
          const firstPage = pages.results[0] as any;
          if (firstPage.jsonld_types) {
            // Re-fetch the page HTML to get JSON-LD blocks
            // For now, check if Organization exists in issues
            const orgIssue = (issues.results as any[]).find(
              (i: any) => i.details && i.details.includes('entity_graph')
            );

            if (orgIssue) {
              // Missing sameAs detected
              const suggestions = suggestSameAs({
                domain: property.domain,
                orgName: property.domain.replace(/^www\./, '').split('.')[0],
              });

              entity_recommendations = {
                sameAs_missing: true,
                suggestions: suggestions.suggestions,
                jsonld_snippet: suggestions.jsonld_snippet,
              };
            }
          }
        }

        // Get citations (Brave integration with budget check)
        const citations = await fetchCitations(
          env, 
          auditId, 
          property?.domain || '',
          property?.domain?.replace(/^www\./, '').split('.')[0], // brand/slug
          () => checkCitationsBudget(env) // budget guard
        );

        // Compute citations summary for Phase C
        const citationsSummary = {
          total: citations.length,
          AEO: citations.filter(c => c.type === 'AEO').length,
          GEO: citations.filter(c => c.type === 'GEO').length,
          Organic: citations.filter(c => c.type === 'Organic').length
        };

        // Compute rollups from pages for breakdown (use raw DB columns)
        const totalPages = pages.results.length;
        const pagesWithJsonLd = pages.results.filter((p: any) => (p.jsonld_count ?? 0) > 0).length;
        const pagesWithTitle = pages.results.filter((p: any) => p.title && p.title.length > 0).length;
        const pagesWithH1 = pages.results.filter((p: any) => p.has_h1).length;
        const pagesWithContent = pages.results.filter((p: any) => (p.rendered_words ?? p.word_count ?? 0) >= 120).length;
        const pages2xx = pages.results.filter((p: any) => (p.status_code ?? 0) >= 200 && (p.status_code ?? 0) < 300).length;
        
        // FAQ detection (separate page vs schema)
        const siteFaqSchemaPresent = pages.results.some((p: any) => p.faq_present); // Has FAQPage JSON-LD
        const siteFaqPagePresent = pages.results.some((p: any) => {
          const url = String(p.url || '').toLowerCase();
          const title = String(p.title || '').toLowerCase();
          return (
            url.includes('/faq') || 
            url.includes('/faqs') || 
            url.includes('/frequently-asked') ||
            title.includes('faq') ||
            title.includes('frequently asked')
          );
        });
        
        // Calculate percentages
        const jsonLdCoveragePct = totalPages > 0 ? Math.round((pagesWithJsonLd / totalPages) * 1000) / 10 : 0;
        const titleCoveragePct = totalPages > 0 ? Math.round((pagesWithTitle / totalPages) * 1000) / 10 : 0;
        const h1CoveragePct = totalPages > 0 ? Math.round((pagesWithH1 / totalPages) * 1000) / 10 : 0;
        const content120PlusPct = totalPages > 0 ? Math.round((pagesWithContent / totalPages) * 1000) / 10 : 0;
        const ok2xxPct = totalPages > 0 ? Math.round((pages2xx / totalPages) * 1000) / 10 : 0;
        
        // Calculate average render time
        const renderTimes = pages.results
          .map((p: any) => p.load_time_ms)
          .filter((t: number) => t && t > 0);
        const avgRenderMs = renderTimes.length > 0 
          ? Math.round(renderTimes.reduce((sum: number, t: number) => sum + t, 0) / renderTimes.length)
          : 0;
        
        // Check robots/sitemap from issues (we can reconstruct this)
        const issuesArr = issues.results as any[];
        const robotsMissing = issuesArr.some((i: any) => i.issue_type === 'robots_missing');
        const sitemapMissing = issuesArr.some((i: any) => i.issue_type === 'sitemap_missing');
        const aiBotsBlocked = issuesArr.find((i: any) => i.issue_type === 'robots_blocks_ai');
        
        // Parse blocked bots from issue message if present
        const blockedBotsList = aiBotsBlocked?.message?.match(/blocking AI bots: (.+)$/)?.[1]?.split(', ') || [];
        const allBots = ['GPTBot', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'CCBot', 'Google-Extended', 'Bytespider'];
        const aiBots: Record<string, boolean> = {
          gptbot: !blockedBotsList.includes('GPTBot'),
          claude: !blockedBotsList.includes('ClaudeBot') && !blockedBotsList.includes('Claude-Web'),
          perplexity: !blockedBotsList.includes('PerplexityBot'),
          ccbot: !blockedBotsList.includes('CCBot'),
          googleExtended: !blockedBotsList.includes('Google-Extended'),
          bytespider: !blockedBotsList.includes('Bytespider'),
        };
        
        // Build breakdown
        const breakdown = {
          crawlability: {
            robotsTxtFound: !robotsMissing,
            sitemapReferenced: !sitemapMissing,
            sitemapOk: !sitemapMissing,
            aiBots,
          },
          structured: {
            jsonLdCoveragePct,
            faqSchemaPresent: siteFaqSchemaPresent,
            faqPagePresent: siteFaqPagePresent,
            schemaTypes: [], // TODO: extract from pages if we store them
          },
          answerability: {
            titleCoveragePct,
            h1CoveragePct,
            content120PlusPct,
          },
          trust: {
            ok2xxPct,
            avgRenderMs,
          },
        };
        
        // Parse AI access probe results
        const aiAccessRaw = audit.ai_access_json ? JSON.parse(audit.ai_access_json as string) : null;
        const aiAccess = aiAccessRaw ? {
          summary: {
            allowed: aiAccessRaw.results.filter((r: any) => r.ok).length,
            blocked: aiAccessRaw.results.filter((r: any) => r.blocked).length,
            tested: aiAccessRaw.results.length,
            waf: aiAccessRaw.results.find((r: any) => r.cfRay) ? 'Cloudflare' :
                 aiAccessRaw.results.find((r: any) => r.akamai) ? 'Akamai' : null,
          },
          results: Object.fromEntries(
            aiAccessRaw.results.map((r: any) => [
              r.bot,
              {
                status: r.status,
                ok: r.ok,
                blocked: r.blocked,
                server: r.server,
                cfRay: r.cfRay,
                akamai: r.akamai,
              }
            ])
          ),
          baselineStatus: aiAccessRaw.baselineStatus,
        } : null;
        
        // Parse AI flags
        const aiFlags = audit.ai_flags_json ? JSON.parse(audit.ai_flags_json as string) : null;
        
        // Parse Brave AI results (Phase F+ enhanced with diagnostics)
        let braveAI = null;
        if (audit.brave_ai_json) {
          try {
            const braveData = JSON.parse(audit.brave_ai_json as string);
            const queries = Array.isArray(braveData.queries) ? braveData.queries : [];
            
            // Aggregate all unique paths cited (from domainPaths)
            const allDomainPaths = new Set<string>();
            queries.forEach((q: any) => {
              const paths = Array.isArray(q.domainPaths) ? q.domainPaths : [];
              paths.forEach((path: string) => {
                allDomainPaths.add(path);
              });
            });
            
            // Count by API type
            const searchCount = queries.filter((q: any) => q.api === 'search').length;
            const summarizerCount = queries.filter((q: any) => q.api === 'summarizer').length;
            
            // Phase F+: Enhanced diagnostics summary
            const diagnostics = {
              ok: queries.filter((q: any) => q.queryStatus === 'ok').length,
              empty: queries.filter((q: any) => q.queryStatus === 'empty').length,
              rate_limited: queries.filter((q: any) => q.queryStatus === 'rate_limited').length,
              error: queries.filter((q: any) => q.queryStatus === 'error').length,
              timeout: queries.filter((q: any) => q.queryStatus === 'timeout').length,
            };
            
            // Count successful queries with results
            const resultsTotal = queries.filter((q: any) => q.ok && (q.sourcesTotal ?? 0) > 0).length;
            
            // Get sample queries for header tooltip (top 5 by weight/priority)
            const querySamples = queries
              .filter((q: any) => q.ok && (q.sourcesTotal ?? 0) > 0)
              .sort((a: any, b: any) => (b.weight ?? 0) - (a.weight ?? 0))
              .slice(0, 5)
              .map((q: any) => q.q);
            
            braveAI = {
              queries: queries,  // Full query details for Brave AI modal
              queriesTotal: queries.length,  // Phase F+: total queries run
              queriesCount: queries.length,  // Keep for backward compat
              resultsTotal,  // Phase F+: queries with results
              pagesCited: allDomainPaths.size,
              diagnostics,  // Phase F+: enhanced diagnostics
              querySamples,  // Phase F+: sample queries for tooltip
              byApi: {
                search: searchCount,
                summarizer: summarizerCount
              }
            };
          } catch (e) {
            console.error('Failed to parse brave_ai_json:', e);
            braveAI = { 
              queries: [], 
              queriesTotal: 0,
              queriesCount: 0, 
              resultsTotal: 0,
              pagesCited: 0, 
              diagnostics: { ok: 0, empty: 0, rate_limited: 0, error: 0, timeout: 0 },
              querySamples: [],
              byApi: { search: 0, summarizer: 0 } 
            };
          }
        }
        
        // --- Phase G: real AI crawler signals (30d window)
        const now = Date.now();
        const lookbackMs = 30 * 24 * 60 * 60 * 1000;
        const sinceTs = now - lookbackMs;

        // 1) Site-level summary (by bot + lastSeen)
        const siteRows = await env.DB.prepare(`
          SELECT bot, COUNT(*) as hits, MAX(ts) as last_seen
          FROM ai_crawler_hits
          WHERE domain = ? AND ts >= ?
          GROUP BY bot
        `).bind(property.domain, sinceTs).all();

        const byBot: Record<string, number> = {};
        const lastSeen: Record<string, number> = {};
        let totalHits = 0;
        for (const r of siteRows.results ?? []) {
          const b = String(r.bot);
          const h = Number(r.hits || 0);
          totalHits += h;
          byBot[b] = h;
          if (r.last_seen) lastSeen[b] = Number(r.last_seen);
        }

        // 2) Per-page totals for this audit (by path)
        const pageRows = await env.DB.prepare(`
          SELECT path, COUNT(*) as hits
          FROM ai_crawler_hits
          WHERE domain = ? AND ts >= ?
          GROUP BY path
        `).bind(property.domain, sinceTs).all();

        const hitsByPath: Record<string, number> = {};
        for (const r of pageRows.results ?? []) {
          hitsByPath[String(r.path)] = Number(r.hits || 0);
        }

        // Build site metadata
        const site = {
          faqSchemaPresent: siteFaqSchemaPresent,
          faqPagePresent: siteFaqPagePresent,
          robotsTxtUrl: property?.domain ? `https://${property.domain}/robots.txt` : null,
          sitemapUrl: property?.domain ? `https://${property.domain}/sitemap.xml` : null,
          aiBots,
          aiAccess,
          flags: aiFlags,
          braveAI,
          crawlers: { total: totalHits, byBot, lastSeen },  // Phase G
        };

        // Transform scores from flat columns to nested object
        const scores = audit.score_overall !== null ? {
          total: audit.score_overall,
          crawlability: audit.score_crawlability,
          structured: audit.score_structured,
          answerability: audit.score_answerability,
          trust: audit.score_trust,
          breakdown,
        } : null;

        // Transform issues to match frontend expectations
        const transformedIssues = (issues.results as any[]).map((issue: any) => ({
          category: issue.issue_type?.split('_')[0] || 'general',
          severity: issue.severity,
          code: issue.issue_type,
          message: issue.message,
          url: issue.page_url,
          details: issue.details,
        }));

        // Build citation counts per page path
        const citationsList = (citations?.items ?? citations ?? []) as any[];
        const countsByPath = new Map<string, number>();
        for (const c of citationsList) {
          try {
            const u = new URL(c.url);
            const key = u.pathname.replace(/\/+$/,'') || '/';
            countsByPath.set(key, (countsByPath.get(key) || 0) + 1);
          } catch (_) {}
        }

        // Build Brave AI answer counts per page path AND query lists (Phase F+)
        const braveAnswersByPath = new Map<string, number>();
        const braveQueriesByPath = new Map<string, string[]>();
        if (audit.brave_ai_json) {
          try {
            const braveData = JSON.parse(audit.brave_ai_json as string);
            const queries = braveData.queries || [];
            
            for (const query of queries) {
              for (const path of (query.domainPaths || [])) {
                // Increment count
                braveAnswersByPath.set(path, (braveAnswersByPath.get(path) || 0) + 1);
                
                // Track unique queries per path (Phase F+)
                if (!braveQueriesByPath.has(path)) {
                  braveQueriesByPath.set(path, []);
                }
                const existingQueries = braveQueriesByPath.get(path)!;
                if (!existingQueries.includes(query.q)) {
                  existingQueries.push(query.q);
                }
              }
            }
          } catch (e) {
            console.error('Failed to parse brave_ai_json for page counts:', e);
          }
        }

        // Transform pages and add citation counts
        const pagesOut = (pages.results as any[]).map((p: any) => {
          // Normalize path for citations mapping
          let path = '/';
          try {
            const u = new URL(p.url);
            path = u.pathname.replace(/\/+$/,'') || '/';
          } catch (_) {}
          
          // Phase F+: Get top 3 citing queries for this page
          const pathQueries = braveQueriesByPath.get(path) || [];
          const aiAnswerQueries = pathQueries.slice(0, 3); // Top 3 queries
          
          return {
            url: p.url,
            statusCode: p.statusCode ?? null,
            title: p.title ?? null,
            h1: p.h1 ?? null,
            hasH1: p.hasH1 ?? false,
            jsonLdCount: p.jsonLdCount ?? 0,
            faqOnPage: p.faqOnPage ?? null,
            words: p.words ?? null,
            snippet: p.snippet ?? null,
            loadTimeMs: p.loadTimeMs ?? null,
            error: p.error ?? null,
            citationCount: countsByPath.get(path) || 0,
            aiAnswers: braveAnswersByPath.get(path) || 0,  // Brave AI answer count
            aiAnswerQueries,  // Phase F+: Queries that cited this page
            aiHits: hitsByPath[path] || 0,  // Phase G: real crawler hits
          };
        });

        // Phase G Polish: Apply read-time crawler bonus (+2 to crawlability if real hits exist)
        if (totalHits > 0 && scores) {
          // Add bonus to breakdown
          if (!scores.breakdown) scores.breakdown = {} as any;
          if (!scores.breakdown.crawlability) scores.breakdown.crawlability = {} as any;
          scores.breakdown.crawlability.realCrawlerBonus = 2;
          
          // Apply bonus to crawlability score (capped at 100)
          const oldCrawl = scores.crawlability || 0;
          scores.crawlability = Math.min(100, oldCrawl + 2);
          
          // Recompute total (weighted: 40/30/20/10)
          scores.total = Math.round(
            (scores.crawlability * 0.4 +
             scores.structured * 0.3 +
             scores.answerability * 0.2 +
             scores.trust * 0.1) * 100
          ) / 100;
        }

        const response: any = {
          id: audit.id,
          property_id: audit.property_id,
          status: audit.status,
          domain: property?.domain || null,
          property: property ? {
            id: property.id,
            domain: property.domain,
            name: property.name || property.domain,
          } : null,
          scores: scores,
          site: site,
          pages_crawled: audit.pages_crawled,
          pages_total: audit.pages_total,
          issues_count: audit.issues_count,
          started_at: audit.started_at,
          completed_at: audit.completed_at,
          error: audit.error,
          pages: pagesOut,
          issues: transformedIssues,
          citations: citations,
          citationsSummary: citationsSummary,
        };

        if (entity_recommendations) {
          response.entity_recommendations = entity_recommendations;
        }

        return new Response(
          JSON.stringify(response),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Failed to fetch audit',
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // POST /v1/audits/:id/email - Send manual email report (requires auth)
    if (path.match(/^\/v1\/audits\/[^/]+\/email$/) && request.method === 'POST') {
      const auditId = path.split('/')[3];
      const apiKey = request.headers.get('x-api-key');
      const authResult = await validateApiKey(apiKey, env);

      if (!authResult.valid) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized', message: 'Valid x-api-key header required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Fetch audit
        const audit = await env.DB.prepare(
          'SELECT * FROM audits WHERE id = ?'
        ).bind(auditId).first<any>();

        if (!audit) {
          return new Response(
            JSON.stringify({ error: 'Not Found', message: 'Audit not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch property with name
        const property = await env.DB.prepare(
          'SELECT id, project_id, domain, name FROM properties WHERE id = ?'
        ).bind(audit.property_id).first<{ id: string; project_id: string; domain: string; name: string | null }>();

        // Fetch project
        const project = await env.DB.prepare(
          'SELECT * FROM projects WHERE id = ?'
        ).bind(property?.project_id || authResult.projectId).first<any>();

        // Verify project access
        if (!project || project.api_key !== apiKey) {
          return new Response(
            JSON.stringify({ error: 'Forbidden', message: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch previous audit for delta
        const prevAudit = await env.DB.prepare(
          `SELECT * FROM audits 
           WHERE property_id = ? AND created_at < ? 
           ORDER BY created_at DESC 
           LIMIT 1`
        ).bind(audit.property_id, audit.created_at).first<any>();

        // Fetch top 3 issues
        const topIssues = await env.DB.prepare(
          `SELECT severity, message, page_url 
           FROM audit_issues 
           WHERE audit_id = ? 
           ORDER BY 
             CASE severity 
               WHEN 'critical' THEN 1 
               WHEN 'high' THEN 2 
               WHEN 'medium' THEN 3 
               ELSE 4 
             END 
           LIMIT 3`
        ).bind(auditId).all<any>();

        // Fetch bot activity (last 7 days)
        const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
        const topBots = await env.DB.prepare(
          `SELECT bot_name, COUNT(*) as hits 
           FROM hits 
           WHERE property_id = ? AND timestamp >= ? AND bot_name IS NOT NULL 
           GROUP BY bot_name 
           ORDER BY hits DESC 
           LIMIT 3`
        ).bind(audit.property_id, sevenDaysAgo).all<any>();

        // Get citations count
        const citationsResult = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM citations WHERE audit_id = ?'
        ).bind(auditId).first<{ count: number }>();

        // Import and send email
        const { sendWeeklyReport } = await import('./email');
        const emailResult = await sendWeeklyReport(env, {
          project,
          property,
          audit,
          prevAudit: prevAudit || undefined,
          topIssues: topIssues.results || [],
          topBots: topBots.results || [],
          citationsCount: citationsResult?.count || 0,
        });

        if (emailResult.error) {
          return new Response(
            JSON.stringify({ error: emailResult.error }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            messageId: emailResult.messageId,
            sentTo: project.owner_email 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Failed to send email',
            message: error instanceof Error ? error.message : String(error),
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Legacy endpoints - return 410 Gone
    const legacyPaths = ['/v1/tag.js', '/v1/track', '/v1/collect'];
    if (legacyPaths.includes(path)) {
      return new Response(
        JSON.stringify({
          error: 'Gone',
          message: 'This endpoint has been deprecated. Please upgrade to the latest tracking code.',
          code: 410,
        }),
        {
          status: 410,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Deprecation': 'true',
            'Sunset': 'Thu, 01 Oct 2025 00:00:00 GMT',
          },
        }
      );
    }

    // Default response
    return new Response(
      JSON.stringify({
        ok: true,
        service: 'geodude-api',
        version: '1.0.0',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  },
};

