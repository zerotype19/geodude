/**
 * Citations Cache Warming
 * Prefetch Brave citations after weekly cron to reduce first-viewer latency
 */

import { fetchCitationsBrave } from './citations-brave';

interface Env {
  DB: D1Database;
  BRAVE_SEARCH?: string;
  BRAVE_SEARCH_ENDPOINT?: string;
}

export async function warmCitations(env: Env): Promise<void> {
  // Get distinct domains from audits in last 14 days
  const rows = await env.DB.prepare(
    `SELECT DISTINCT p.domain, p.id 
     FROM properties p 
     JOIN audits a ON a.property_id = p.id 
     WHERE a.created_at >= ?`
  ).bind(Math.floor(Date.now() / 1000) - 14 * 24 * 3600).all<{ domain: string; id: string }>();

  const domains = rows.results ?? [];
  console.log(`Warming citations cache for ${domains.length} domains...`);

  for (const { domain } of domains) {
    try {
      await fetchCitationsBrave(env, domain);
      console.log(`Warmed: ${domain}`);
    } catch (e) {
      console.error(`Failed to warm ${domain}:`, e);
    }
    
    // Politeness delay
    await new Promise(res => setTimeout(res, 250));
  }
  
  console.log(`warmCitations: ${domains.length} domains complete`);
}

