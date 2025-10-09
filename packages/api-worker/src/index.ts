/**
 * Geodude API Worker
 * Handles audits, analytics, and legacy endpoint deprecation
 */

import { runAudit } from './audit';
import { extractOrganization } from './html';
import { suggestSameAs } from './entity';
import { fetchCitations } from './citations';
import { createProject, createProperty, verifyProperty } from './onboarding';

interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  USER_AGENT: string;
  AUDIT_MAX_PAGES: string;
  AUDIT_DAILY_LIMIT: string;
  HASH_SALT: string;
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

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
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
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for all responses
    const allowedOrigins = [
      'https://app.optiview.ai',
      'https://geodude-app.pages.dev',
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

        return new Response(JSON.stringify(audit), {
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

    // GET /v1/audits/:id - Get audit details (public for now, could add auth later)
    if (path.startsWith('/v1/audits/') && request.method === 'GET') {
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

        // Get citations (stub for now)
        const citations = await fetchCitations(env, auditId, property?.domain || '');

        const response: any = {
          ...audit,
          pages: pages.results,
          issues: issues.results,
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

    // GET /v1/audits/:id/citations - Get citations for audit
    if (path.match(/^\/v1\/audits\/[^/]+\/citations$/) && request.method === 'GET') {
      const auditId = path.split('/')[3];

      try {
        const citations = await fetchCitations(env, auditId, '');
        
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

