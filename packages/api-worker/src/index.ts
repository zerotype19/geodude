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

interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
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

        return new Response(
          JSON.stringify({
            audits_7d: audits7?.c ?? 0,
            avg_score_7d: Number(avgScore7?.a ?? 0).toFixed(3),
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
        // Get latest audit
        const latestAudit = await env.DB.prepare(
          `SELECT id, status, completed_at 
           FROM audits 
           WHERE status = 'completed' 
           ORDER BY completed_at DESC 
           LIMIT 1`
        ).first<{ id: string; status: string; completed_at: string }>();

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
        const body = await request.json() as { property_id: string };
        
        if (!body.property_id) {
          return new Response(
            JSON.stringify({ error: 'property_id is required' }),
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

        const auditId = await runAudit(body.property_id, env);

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

    // GET /v1/audits/:id/citations - Get citations for audit (read-only from table)
    if (path.match(/^\/v1\/audits\/[^/]+\/citations$/) && request.method === 'GET') {
      const auditId = path.split('/')[3];

      try {
        // Read from database only (no fetch)
        const result = await env.DB.prepare(
          `SELECT engine, query, url, title, cited_at
           FROM citations
           WHERE audit_id = ?
           ORDER BY cited_at DESC
           LIMIT 50`
        ).bind(auditId).all();
        
        const citations = result.results || [];
        
        return new Response(
          JSON.stringify({ items: citations }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
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
        // Normalize: allow path or absolute URL
        const normalized = rawU.startsWith('http') ? rawU : rawU;

        // 1) Find the exact page row
        const pageRow = await env.DB.prepare(
          `SELECT url, status_code as status, title, h1 as has_h1, word_count, 
                  has_json_ld as json_ld_count, has_faq as faq_present
           FROM audit_pages
           WHERE audit_id = ? AND (url = ? OR url LIKE '%' || ?)
           ORDER BY (url = ?) DESC
           LIMIT 1`
        ).bind(auditId, normalized, normalized, normalized).first();

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

        // 3) Lightweight page score breakdown
        const scoreHints = {
          has_h1: !!pageRow.has_h1,
          has_json_ld: (pageRow.json_ld_count ?? 0) > 0,
          word_ok: (pageRow.word_count ?? 0) >= 120,
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
              status: pageRow.status,
              word_count: pageRow.word_count,
              has_h1: !!pageRow.has_h1,
              json_ld_count: pageRow.json_ld_count ?? 0,
              faq_present: !!pageRow.faq_present,
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
                  started_at, completed_at, error
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
        const pages = await env.DB.prepare(
          `SELECT url, status_code, title, h1, has_json_ld, has_faq, 
                  word_count, load_time_ms, error
           FROM audit_pages WHERE audit_id = ?
           ORDER BY url`
        ).bind(auditId).all();

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

        // Transform scores from flat columns to nested object
        const scores = audit.score_overall !== null ? {
          total: audit.score_overall,
          crawlability: audit.score_crawlability,
          structured: audit.score_structured,
          answerability: audit.score_answerability,
          trust: audit.score_trust,
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

        const response: any = {
          id: audit.id,
          property_id: audit.property_id,
          status: audit.status,
          domain: property?.domain || null,
          scores: scores,
          pages_crawled: audit.pages_crawled,
          pages_total: audit.pages_total,
          issues_count: audit.issues_count,
          started_at: audit.started_at,
          completed_at: audit.completed_at,
          error: audit.error,
          pages: pages.results,
          issues: transformedIssues,
          citations: citations,
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

        // Fetch property
        const property = await env.DB.prepare(
          'SELECT * FROM properties WHERE id = ?'
        ).bind(audit.property_id).first<any>();

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

