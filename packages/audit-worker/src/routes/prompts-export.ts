/**
 * Prompt QA Export Endpoint
 * GET /api/llm/prompts/export?domain=X
 * Returns CSV for human spot-check and weekly reviews
 */

import { Env } from '../index';

export async function handlePromptsExport(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');
  
  if (!domain) {
    return new Response('Missing domain parameter', { status: 400 });
  }
  
  try {
    // Get latest prompt cache entry for domain
    const kvKey = `llm_prompts:${domain}`;
    const cached = await env.PROMPT_CACHE.get(kvKey);
    
    if (!cached) {
      // Try D1
      const result = await env.DB.prepare(
        `SELECT * FROM llm_prompt_cache WHERE domain = ? ORDER BY updated_at DESC LIMIT 1`
      ).bind(domain).first();
      
      if (!result) {
        return new Response(`No prompts found for domain: ${domain}`, { status: 404 });
      }
      
      // Parse from D1
      const branded = JSON.parse(result.branded_prompts as string || '[]');
      const nonBranded = JSON.parse(result.nonbranded_prompts as string || '[]');
      
      return generateCSV(domain, {
        version: result.prompt_gen_version as string,
        branded,
        nonBranded,
        realismScoreAvg: result.realism_score_avg as number,
        updatedAt: result.updated_at as string
      });
    }
    
    // Parse from KV
    const data = JSON.parse(cached);
    return generateCSV(domain, {
      version: data.meta?.prompt_gen_version || 'unknown',
      branded: data.branded || [],
      nonBranded: data.nonBranded || [],
      realismScoreAvg: data.realismScoreAvg || 0,
      updatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[PROMPTS_EXPORT] Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

function generateCSV(domain: string, data: {
  version: string;
  branded: string[];
  nonBranded: string[];
  realismScoreAvg: number;
  updatedAt: string;
}): Response {
  const rows: string[] = [
    // CSV Header
    'domain,version,type,query,realism_score_avg,updated_at'
  ];
  
  // Add branded queries
  for (const q of data.branded) {
    rows.push(`"${domain}","${data.version}","branded","${q.replace(/"/g, '""')}",${data.realismScoreAvg},"${data.updatedAt}"`);
  }
  
  // Add non-branded queries
  for (const q of data.nonBranded) {
    rows.push(`"${domain}","${data.version}","non-branded","${q.replace(/"/g, '""')}",${data.realismScoreAvg},"${data.updatedAt}"`);
  }
  
  const csv = rows.join('\n');
  
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="prompts-${domain}-${Date.now()}.csv"`
    }
  });
}

