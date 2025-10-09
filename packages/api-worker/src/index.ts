/**
 * Geodude API Worker
 * Handles audits, analytics, and legacy endpoint deprecation
 */

import { runAudit } from './audit';

interface Env {
  DB: D1Database;
  USER_AGENT: string;
  AUDIT_MAX_PAGES: string;
  HASH_SALT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (path === '/health') {
      return new Response('ok', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    // POST /v1/audits/start - Start a new audit
    if (path === '/v1/audits/start' && request.method === 'POST') {
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

    // GET /v1/audits/:id - Get audit details
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

        return new Response(
          JSON.stringify({
            ...audit,
            pages: pages.results,
            issues: issues.results,
          }),
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

