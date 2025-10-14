import { Env } from '../index';
import { normalizeFromUrl } from '../lib/domain';
import { isAuditedUrl } from '../services/vi/domain-match';

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

    // Get the latest run for this audit (or specific run_id)
    let runQuery = `
      SELECT id, domain, audited_url, hostname, project_id, status
      FROM visibility_runs 
      WHERE audit_id = ?
    `;
    let runParams = [audit_id];

    if (run_id) {
      runQuery += ' AND id = ?';
      runParams.push(run_id);
    }

    runQuery += ' ORDER BY started_at DESC LIMIT 1';

    const run = await env.DB.prepare(runQuery).bind(...runParams).first();

    if (!run) {
      return new Response(JSON.stringify({ error: 'No visibility run found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const runData = run as any;
    const domain = runData.domain;
    const auditedUrl = runData.audited_url;
    const hostname = runData.hostname;
    const projectId = runData.project_id;

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

    // Get intents for this run, limited to 5 per source
    const intents = await env.DB.prepare(`
      SELECT id, query, kind, prompt_reason
      FROM visibility_intents 
      WHERE domain = ? 
      ORDER BY 
        CASE kind 
          WHEN 'branded' THEN 1 
          WHEN 'non_branded' THEN 2 
          ELSE 3 
        END,
        created_at
      LIMIT 5
    `).bind(domain).all();

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

      // Generate aliases for better domain matching
      const aliases: string[] = [];
      
      // Cologuard-specific aliases
      if (domain.includes('cologuard') || domain === 'cologuard.com') {
        aliases.push('cologuard.com', 'exactsciences.com');
      }
      
      // Generic brand alias detection (if site description contains brand name)
      const auditDetails = await env.DB.prepare(`
        SELECT p.site_description, p.domain 
        FROM properties p
        JOIN audits a ON p.id = a.property_id
        WHERE a.id = ?
      `).bind(audit_id).first();
      
      if (auditDetails) {
        const siteDesc = (auditDetails as any).site_description?.toLowerCase() || '';
        const brand = (auditDetails as any).domain?.toLowerCase().replace('.com', '') || '';
        if (siteDesc.includes(brand)) {
          aliases.push(`${brand}.com`);
        }
      }

      const citations: GroupedCitation[] = (citationsResult.results || []).map((c: any) => ({
        rank: c.rank,
        title: c.title || 'Untitled',
        ref_url: c.ref_url,
        link_text: c.title || 'Untitled',
        ref_domain: c.ref_domain,
        was_audited: isAuditedUrl(c.ref_url, domain, aliases),
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
      domain,
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

