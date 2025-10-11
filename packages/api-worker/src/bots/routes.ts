import { normalizeHit, type RawHit } from './ingest';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper to check admin auth
function checkAdminAuth(request: Request, env: any): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  
  const encoded = authHeader.slice(6);
  const decoded = atob(encoded);
  const [user, pass] = decoded.split(':');
  
  // Check against environment secrets
  const validUser = env.ADMIN_BASIC_AUTH_USER || 'kevin';
  const validPass = env.ADMIN_BASIC_AUTH_PASS || env.ADMIN_BASIC_AUTH || '';
  
  return user === validUser && pass === validPass;
}

// POST /v1/botlogs/ingest - Admin-only JSONL/JSON ingestion
export async function handleBotLogsIngest(request: Request, env: any): Promise<Response> {
  if (!checkAdminAuth(request, env)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Admin auth required' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const body = await request.json() as { data: RawHit[] };
    
    if (!Array.isArray(body.data)) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'data must be an array' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let accepted = 0;
    let rejected = 0;
    const reasons: Record<string, number> = {};

    for (const raw of body.data) {
      const normalized = normalizeHit(raw, 'api.ingest');
      
      if (normalized.ok && normalized.record) {
        try {
          await env.DB.prepare(
            `INSERT OR IGNORE INTO ai_crawler_hits 
             (id, domain, path, bot, ua, status, ts, source, ip_hash, extra_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            normalized.record.id,
            normalized.record.domain,
            normalized.record.path,
            normalized.record.bot,
            normalized.record.ua,
            normalized.record.status,
            normalized.record.ts,
            normalized.record.source,
            normalized.record.ip_hash || null,
            normalized.record.extra_json || null
          ).run();
          
          accepted++;
        } catch (e) {
          console.error('[botlogs] Insert failed:', e);
          rejected++;
          reasons['db_error'] = (reasons['db_error'] || 0) + 1;
        }
      } else {
        rejected++;
        const reason = normalized.reason || 'unknown';
        reasons[reason] = (reasons[reason] || 0) + 1;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, accepted, rejected, reasons }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[botlogs/ingest] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process bot logs',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

// GET /v1/audits/:id/crawlers - Get crawler summary for an audit
export async function handleGetCrawlers(auditId: string, env: any, searchParams: URLSearchParams): Promise<Response> {
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '30')));
  const cutoff = Date.now() - (days * 86400000);

  try {
    // Get the audit's domain
    const audit = await env.DB.prepare(
      `SELECT p.domain FROM audits a JOIN properties p ON p.id = a.property_id WHERE a.id = ?`
    ).bind(auditId).first<{ domain: string }>();

    if (!audit) {
      return new Response(
        JSON.stringify({ error: 'Audit not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const domain = audit.domain;

    // Query all hits for this domain in the time window
    const hits = await env.DB.prepare(
      `SELECT bot, path, ts FROM ai_crawler_hits 
       WHERE domain = ? AND ts >= ? 
       ORDER BY ts DESC`
    ).bind(domain, cutoff).all();

    // Build summary
    const byBot: Record<string, number> = {};
    const lastSeen: Record<string, number> = {};
    const byPage: Record<string, { hits: number; byBot: Record<string, number> }> = {};

    for (const hit of (hits.results || [])) {
      const bot = hit.bot as string;
      const path = hit.path as string;
      const ts = hit.ts as number;

      // Summary counts
      byBot[bot] = (byBot[bot] || 0) + 1;
      lastSeen[bot] = Math.max(lastSeen[bot] || 0, ts);

      // Per-page counts
      if (!byPage[path]) {
        byPage[path] = { hits: 0, byBot: {} };
      }
      byPage[path].hits++;
      byPage[path].byBot[bot] = (byPage[path].byBot[bot] || 0) + 1;
    }

    const total = hits.results?.length || 0;

    return new Response(
      JSON.stringify({
        ok: true,
        summary: {
          total,
          byBot,
          lastSeen,
        },
        byPage: Object.entries(byPage).map(([path, data]) => ({
          path,
          hits: data.hits,
          byBot: data.byBot,
        })),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[crawlers] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch crawler data',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

