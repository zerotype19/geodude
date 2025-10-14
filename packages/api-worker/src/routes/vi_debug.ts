import { Env } from '../index';
import { deriveAliases, etld1 } from '../services/vi/domain-match';

export interface ProvenanceData {
  audit: {
    id: string;
    domain: string;
    project_id: string;
  };
  run: {
    id: string;
    status: string;
    sources: string[];
    created_at: string;
    domain: string;
    alias_match: string[];
  };
  counts_by_source: Record<string, number>;
  top_domains: Array<[string, number]>;
  parser_modes: Record<string, string>;
}

export function createDebugVIRoutes(env: Env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Max-Age': '86400',
  };

  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname;

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
      }

      // GET /api/vi/debug/provenance - Debug provenance data
      if (path === '/api/vi/debug/provenance' && request.method === 'GET') {
        return await handleProvenanceDebug(request, env, corsHeaders);
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  };
}

async function handleProvenanceDebug(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const url = new URL(request.url);
    const audit_id = url.searchParams.get('audit_id');

    if (!audit_id) {
      return new Response(JSON.stringify({ error: 'audit_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get audit details
    const auditQuery = `
      SELECT a.id, a.project_id, p.domain, p.site_description
      FROM audits a
      JOIN properties p ON a.property_id = p.id
      WHERE a.id = ?
    `;
    
    const audit = await env.DB.prepare(auditQuery).bind(audit_id).first();
    if (!audit) {
      return new Response(JSON.stringify({ error: 'Audit not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const auditData = audit as any;

    // Get latest run for this audit
    const runQuery = `
      SELECT r.id, r.status, r.sources, r.created_at, r.domain, r.project_id
      FROM visibility_runs r
      WHERE r.audit_id = ? AND r.project_id = ?
      ORDER BY r.started_at DESC
      LIMIT 1
    `;
    
    const run = await env.DB.prepare(runQuery).bind(audit_id, auditData.project_id).first();
    if (!run) {
      return new Response(JSON.stringify({ error: 'No visibility run found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const runData = run as any;
    
    // DOMAIN INTEGRITY ASSERTION
    const aliases = deriveAliases(auditData.domain, auditData.site_description);
    const runDomainEtld1 = etld1(runData.domain);
    const auditDomainEtld1 = etld1(auditData.domain);
    
    if (runDomainEtld1 !== auditDomainEtld1 && !aliases.includes(runDomainEtld1)) {
      console.error(`[PROVENANCE DEBUG] Domain mismatch: run=${runData.domain} audit=${auditData.domain} aliases=${aliases.join(',')}`);
      return new Response(JSON.stringify({ 
        error: 'Domain mismatch: run domain does not match audit domain or valid aliases',
        details: `run: ${runData.domain}, audit: ${auditData.domain}, aliases: ${aliases.join(', ')}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get citation counts by source
    const countsQuery = `
      SELECT vr.source, COUNT(vc.id) as count
      FROM visibility_results vr
      LEFT JOIN visibility_citations vc ON vr.id = vc.result_id
      WHERE vr.run_id = ?
      GROUP BY vr.source
    `;
    
    const countsResult = await env.DB.prepare(countsQuery).bind(runData.id).all();
    const counts_by_source: Record<string, number> = {};
    (countsResult.results || []).forEach((row: any) => {
      counts_by_source[row.source] = row.count;
    });

    // Get top domains cited
    const domainsQuery = `
      SELECT vc.ref_domain, COUNT(*) as count
      FROM visibility_citations vc
      JOIN visibility_results vr ON vc.result_id = vr.id
      WHERE vr.run_id = ?
      GROUP BY vc.ref_domain
      ORDER BY count DESC
      LIMIT 10
    `;
    
    const domainsResult = await env.DB.prepare(domainsQuery).bind(runData.id).all();
    const top_domains: Array<[string, number]> = (domainsResult.results || []).map((row: any) => [row.ref_domain, row.count]);

    // Parser modes (simplified - all use text+structured-merged now)
    const parser_modes: Record<string, string> = {};
    const sources = JSON.parse(runData.sources || '[]');
    sources.forEach((source: string) => {
      parser_modes[source] = 'text+structured-merged';
    });

    const provenance: ProvenanceData = {
      audit: {
        id: auditData.id,
        domain: auditData.domain,
        project_id: auditData.project_id
      },
      run: {
        id: runData.id,
        status: runData.status,
        sources: JSON.parse(runData.sources || '[]'),
        created_at: runData.created_at,
        domain: runData.domain,
        alias_match: aliases
      },
      counts_by_source,
      top_domains,
      parser_modes
    };

    return new Response(JSON.stringify(provenance), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('[DebugVI] Error in handleProvenanceDebug:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch provenance data', 
      details: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
