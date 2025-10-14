import { Env } from '../index';
import { normalizeFromUrl } from '../lib/domain';
import { isAuditedUrl, deriveAliases, etld1 } from '../services/vi/domain-match';

export interface GroupedCitation {
  rank: number;
  title: string;
  ref_url: string;
  link_text?: string;
  ref_domain: string;
  was_audited: boolean;
  captured_at: string;
}

export interface GroupedPrompt {
  intent_id: string;
  source: string;
  kind: 'branded' | 'non_branded';
  prompt_text: string;
  prompt_reason: string;
  citations: GroupedCitation[];
}

export interface GroupedResults {
  audit_id: string;
  run_id: string;
  domain: string;
  selected_source: string;
  sources: string[];
  prompts: GroupedPrompt[];
  counts: Record<string, { prompts: number; citations: number }>;
}

export function createGroupedVIRoutes(env: Env) {
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

      // GET /api/vi/results:grouped - Grouped results by prompt
      if (path === '/api/vi/results:grouped' && request.method === 'GET') {
        return await handleGroupedResults(request, env, corsHeaders);
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  };
}

async function handleGroupedResults(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const url = new URL(request.url);
    const audit_id = url.searchParams.get('audit_id');
    const run_id = url.searchParams.get('run_id');
    let source = url.searchParams.get('source');

    if (!audit_id) {
      return new Response(JSON.stringify({ error: 'audit_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // PROVENANCE GUARDRAIL: Get audit details first to enforce audit→run binding
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
    const auditDomain = auditData.domain;
    const projectId = auditData.project_id;

    // Get the latest run for this audit (or specific run_id) - MUST be scoped by audit_id AND project_id
    let runQuery = `
      SELECT r.id, r.domain, r.audited_url, r.hostname, r.project_id, r.status, r.created_at
      FROM visibility_runs r
      WHERE r.audit_id = ? AND r.project_id = ?
    `;
    let runParams = [audit_id, projectId];

    if (run_id) {
      runQuery += ' AND r.id = ?';
      runParams.push(run_id);
    }

    runQuery += ' ORDER BY r.started_at DESC LIMIT 1';

    const run = await env.DB.prepare(runQuery).bind(...runParams).first();

    if (!run) {
      return new Response(JSON.stringify({ error: 'No visibility run found for this audit' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const runData = run as any;
    const runDomain = runData.domain;
    
    // DOMAIN INTEGRITY ASSERTION: Ensure run domain matches audit domain or is a valid alias
    const aliases = deriveAliases(auditDomain, auditData.site_description);
    if (etld1(runDomain) !== etld1(auditDomain) && !aliases.includes(etld1(runDomain))) {
      console.error(`[PROVENANCE] Domain mismatch: run=${runDomain} audit=${auditDomain} aliases=${aliases.join(',')}`);
      return new Response(JSON.stringify({ 
        error: 'Domain mismatch: run domain does not match audit domain or valid aliases',
        details: `run: ${runDomain}, audit: ${auditDomain}, aliases: ${aliases.join(', ')}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get available sources for this run
    const sourcesResult = await env.DB.prepare(`
      SELECT DISTINCT source FROM visibility_results WHERE run_id = ?
    `).bind(runData.id).all();

    const availableSources = sourcesResult.results?.map((r: any) => r.source) || [];
    
    // If no source specified, find the one with most citations
    if (!source) {
      const sourceCounts = await env.DB.prepare(`
        SELECT source, COUNT(*) as count
        FROM visibility_results vr
        JOIN visibility_citations vc ON vr.id = vc.result_id
        WHERE vr.run_id = ?
        GROUP BY source
        ORDER BY count DESC
        LIMIT 1
      `).bind(runData.id).first();
      
      source = (sourceCounts as any)?.source || 'chatgpt_search';
    }

    // Get intents for this run, limited to 5 per source - MUST be scoped by project
    const intents = await env.DB.prepare(`
      SELECT vi.id, vi.query, vi.kind, vi.prompt_reason
      FROM visibility_intents vi
      JOIN visibility_runs vr ON vi.domain = vr.domain
      WHERE vr.audit_id = ? AND vr.project_id = ?
      ORDER BY 
        CASE vi.kind 
          WHEN 'branded' THEN 1 
          WHEN 'non_branded' THEN 2 
          ELSE 3 
        END,
        vi.created_at
      LIMIT 5
    `).bind(audit_id, projectId).all();

    const prompts: GroupedPrompt[] = [];
    const counts: Record<string, { prompts: number; citations: number }> = {};

    // Always include all sources, even with zero counts
    const allSources = ["perplexity", "chatgpt_search", "claude"];
    allSources.forEach(source => {
      counts[source] = { prompts: 0, citations: 0 };
    });

    // Process each intent
    for (const intent of (intents.results || [])) {
      const intentData = intent as any;
      
      // Get citations for this intent and source
      const citationsResult = await env.DB.prepare(`
        SELECT 
          vc.rank,
          vc.title,
          vc.ref_url,
          vc.ref_domain,
          vr.occurred_at,
          vr.source
        FROM visibility_citations vc
        JOIN visibility_results vr ON vc.result_id = vr.id
        WHERE vr.intent_id = ? AND vr.source = ?
        ORDER BY vc.rank ASC
      `).bind(intentData.id, source).all();

      // Use already-fetched aliases for domain matching
      const aliases = deriveAliases(auditDomain, auditData.site_description);

      const citations: GroupedCitation[] = (citationsResult.results || []).map((c: any) => ({
        rank: c.rank,
        title: c.title || 'Untitled',
        ref_url: c.ref_url,
        link_text: c.title || 'Untitled',
        ref_domain: c.ref_domain,
        was_audited: isAuditedUrl(c.ref_url, auditDomain, aliases),
        captured_at: c.occurred_at
      }));

      // Only include prompts that have citations for the selected source
      if (citations.length > 0) {
        prompts.push({
          intent_id: intentData.id,
          source: source,
          kind: intentData.kind || 'branded',
          prompt_text: intentData.query,
          prompt_reason: intentData.prompt_reason || 'Generated from site description',
          citations
        });

        counts[source].prompts++;
        counts[source].citations += citations.length;
      }
    }

    const result: GroupedResults = {
      audit_id,
      run_id: runData.id,
      domain: auditDomain, // Use audit domain, not run domain
      selected_source: source,
      sources: allSources,
      prompts,
      counts
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('[GroupedVI] Error in handleGroupedResults:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch grouped results', 
      details: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

