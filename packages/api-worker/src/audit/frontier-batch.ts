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
  
  // Batch insert with duplicate handling
  const params = unique.flatMap(url => [auditId, url, opts.depth, opts.priorityBase, 'pending', opts.source]);
  
  try {
    // D1 doesn't support ON CONFLICT, so we need to insert one by one with error handling
    let inserted = 0;
    
    for (let i = 0; i < unique.length; i++) {
      try {
        const url = unique[i];
        const offset = i * 6; // Each URL has 6 parameters
        const urlParams = params.slice(offset, offset + 6);
        
        const result = await env.DB.prepare(`
          INSERT INTO audit_frontier (audit_id, url, depth, priority, status, discovered_from, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(...urlParams).run();
        
        if (result.changes > 0) {
          inserted++;
        }
      } catch (error) {
        // Ignore duplicate key errors (SQLite error 19)
        if (!error.message?.includes('UNIQUE constraint failed')) {
          console.warn(`[FrontierBatch] Failed to insert URL ${unique[i]}:`, error);
        }
      }
    }
    
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
