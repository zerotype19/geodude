import { normalizeUrl } from './url-utils';

export async function frontierBatchEnqueue(
  env: any, 
  auditId: string, 
  urls: string[], 
  opts: { depth: number; priorityBase: number; source: string; origin?: string }
): Promise<number> {
  console.log(`[FrontierBatch] Enqueueing ${urls.length} URLs for audit ${auditId}`);
  
  if (urls.length === 0) return 0;
  
  // Normalize URLs and filter duplicates
  const normalized = urls
    .map(url => normalizeUrl(url, opts.origin || ''))
    .filter((url): url is string => Boolean(url));
  
  const unique = [...new Set(normalized)];
  console.log(`[FrontierBatch] After normalization: ${unique.length} unique URLs`);
  
  // Convert to items format for new enqueueBatch
  const items = unique.map(url => ({
    url,
    depth: opts.depth,
    priority: opts.priorityBase
  }));
  
  return await enqueueBatch(env.DB, auditId, items);
}

export async function enqueueBatch(
  db: any, 
  auditId: string,
  items: Array<{url: string; depth: number; priority: number}>
): Promise<number> {
  if (!items.length) return 0;
  
  // Chunk items to keep SQL params under 999 limit (4 params per item, so max ~200 items, but be conservative)
  const chunks = chunk(items, 150);
  let total = 0;
  
  for (const c of chunks) {
    const values = c.map(() => '(?,?,?,?, "pending", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').join(',');
    const sql = `
      INSERT INTO audit_frontier (audit_id, url, depth, priority, status, created_at, updated_at)
      VALUES ${values}
      ON CONFLICT(audit_id, url) DO NOTHING;
    `;
    const params = c.flatMap(i => [auditId, i.url, i.depth, i.priority]);
    
    try {
      const res = await db.prepare(sql).bind(...params).run();
      total += res.meta.changes ?? 0;
    } catch (error) {
      console.error(`[FrontierBatch] Error inserting chunk:`, error);
      // Continue with next chunk
    }
  }
  
  console.log(`ENQUEUE_BATCH { audit: ${auditId}, attempted: ${items.length}, inserted: ${total}, duplicates: ${items.length - total} }`);
  return total;
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function markSeeded(env: any, auditId: string): Promise<void> {
  console.log(`[FrontierBatch] Marking audit ${auditId} as seeded`);
  
  await env.DB.prepare(`
    UPDATE audits 
    SET phase_state = json_set(
      COALESCE(phase_state, '{}'), 
      '$.crawl.seeded', 1,
      '$.crawl.seeded_at', datetime('now')
    )
    WHERE id = ?1
  `).bind(auditId).run();
}
