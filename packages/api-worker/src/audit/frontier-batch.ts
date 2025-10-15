import { normalizeUrl } from './url-utils';

export async function frontierBatchEnqueue(
  env: any, 
  auditId: string, 
  urls: string[], 
  opts: { depth: number; priorityBase: number; source: string }
): Promise<number> {
  console.log(`[FrontierBatch] Enqueueing ${urls.length} URLs for audit ${auditId}`);
  
  if (urls.length === 0) return 0;
  
  // Normalize URLs and filter duplicates
  const normalized = urls
    .map(url => normalizeUrl(url, ''))
    .filter((url): url is string => Boolean(url));
  
  const unique = [...new Set(normalized)];
  console.log(`[FrontierBatch] After normalization: ${unique.length} unique URLs`);
  
  // Batch insert with ON CONFLICT DO NOTHING
  const values = unique.map(url => `(?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`);
  const params = unique.flatMap(url => [auditId, url, opts.depth, opts.priorityBase, 'pending', opts.source]);
  
  try {
    const stmt = env.DB.prepare(`
      INSERT INTO audit_frontier (audit_id, url, depth, priority, status, discovered_from, created_at, updated_at)
      VALUES ${values.join(', ')}
      ON CONFLICT(audit_id, url) DO NOTHING
    `);
    
    const result = await stmt.bind(...params).run();
    const inserted = result.changes || 0;
    
    console.log(`SEED_ENQUEUE { audit: ${auditId}, attempted: ${unique.length}, inserted: ${inserted}, duplicates: ${unique.length - inserted} }`);
    
    return inserted;
  } catch (error) {
    console.error(`[FrontierBatch] Error batch inserting URLs:`, error);
    return 0;
  }
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
