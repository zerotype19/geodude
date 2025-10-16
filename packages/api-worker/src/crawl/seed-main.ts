/**
 * Main-Only Seeding Logic
 * Seeds only from main sitemap.xml, no robots.txt or link discovery
 */

import { resolveCanonicalHost } from './canonical';
import { fetchMainSitemap, parseFirstUrls } from './sitemap-main';

export async function seedFrontierMainOnly(
  env: any, 
  auditId: string, 
  originUrl: string, 
  ctx: any
) {
  const origin = new URL(originUrl);
  const host = await resolveCanonicalHost(fetch, origin);
  const main = await fetchMainSitemap(fetch, host);

  if (!main) {
    console.log(`SEED_MAIN_MISS { audit: ${auditId}, step: 'main-sitemap-miss', host: ${host} }`);
    return { seeded: 0, urls: [] };
  }

  const limit = Number(env.CRAWL_SITEMAP_URL_LIMIT ?? 50);
  const raw = parseFirstUrls(main.text, limit);

  // normalize and keep same host only
  const uniq = Array.from(new Set(raw))
    .map(u => safeNormalize(u, host))
    .filter(Boolean) as string[];

  const items = uniq.map(u => ({ url: u, depth: 0, priority: 0.0 }));

  let inserted = 0;
  if (items.length) {
    inserted = await enqueueBatch(env.DB, auditId, items, Number(env.ENQUEUE_BATCH_SIZE ?? 20));
  }

  await env.DB.prepare(`
    UPDATE audits 
    SET phase_state = json_set(
      COALESCE(phase_state, '{}'), 
      '$.crawl.seeded', 1,
      '$.crawl.seeded_at', datetime('now')
    )
    WHERE id = ?
  `).bind(auditId).run();

  console.log(`SEED_MAIN { audit: ${auditId}, host: ${host}, source: ${main.url}, bytes: ${main.bytes}, candidates: ${raw.length}, enqueued: ${inserted} }`);

  return { seeded: inserted, urls: uniq.slice(0, inserted) };
}

function safeNormalize(u: string, host: string) {
  try {
    const url = new URL(u);
    
    // Allow both www and non-www variants of the same domain
    const normalizeHost = (h: string) => h.replace(/^www\./, '');
    if (normalizeHost(url.host) !== normalizeHost(host)) return null;
    
    url.hash = '';
    
    // optional: strip tracking params
    ['utm_source','utm_medium','utm_campaign','mc_cid','mc_eid','gclid','fbclid'].forEach(p => 
      url.searchParams.delete(p)
    );
    
    // collapse trailing '/'
    url.pathname = url.pathname.replace(/\/index\.html?$/i,'');
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0,-1);
    }
    
    return url.toString();
  } catch { 
    return null; 
  }
}

export async function enqueueBatch(
  db: any, 
  auditId: string,
  items: Array<{url:string;depth:number;priority:number}>, 
  batchSize = 20
) {
  let total = 0;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const values = chunk.map(() => '(?,?,?,?, "pending", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').join(',');
    const sql = `
      INSERT INTO audit_frontier (audit_id, url, depth, priority, status, created_at, updated_at)
      VALUES ${values}
      ON CONFLICT(audit_id, url) DO NOTHING;
    `;
    const params = chunk.flatMap(i => [auditId, i.url, i.depth, i.priority]);
    const res = await db.prepare(sql).bind(...params).run();
    total += res.meta?.changes ?? 0;
  }
  
  return total;
}
