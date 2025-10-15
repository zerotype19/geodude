/**
 * Crawl frontier management for BFS exploration
 * Maintains a queue of internal URLs with depth and priority for systematic crawling
 */

export async function enqueueUrl(
  env: any, 
  auditId: string, 
  url: string, 
  depth: number, 
  priority: number, 
  from?: string
) {
  await env.DB.prepare(`
    INSERT INTO audit_frontier (audit_id, url, depth, priority, status, discovered_from)
    VALUES (?1, ?2, ?3, ?4, 'pending', ?5)
    ON CONFLICT(audit_id, url) DO UPDATE SET
      depth = MIN(depth, excluded.depth),
      priority = MIN(priority, excluded.priority),
      updated_at = datetime('now')
  `).bind(auditId, url, depth, priority, from ?? null).run();
}

export async function dequeueBatch(env: any, auditId: string, limit: number) {
  // Select next pending urls in BFS order (depth asc, priority asc)
  const rows = await env.DB.prepare(`
    SELECT url, depth FROM audit_frontier
    WHERE audit_id=?1 AND status='pending'
    ORDER BY depth ASC, priority ASC
    LIMIT ?2
  `).bind(auditId, limit).all<any>();
  
  // Mark them "visiting"
  if (rows.results.length) {
    const now = new Date().toISOString();
    const urls = rows.results.map((r: any) => r.url);
    const placeholders = urls.map(() => '?').join(',');
    await env.DB.prepare(`
      UPDATE audit_frontier SET status='visiting', updated_at=?1
      WHERE audit_id=?2 AND url IN (${placeholders})
    `).bind(now, auditId, ...urls).run();
  }
  
  return rows.results as { url: string; depth: number }[];
}

export async function markDone(
  env: any, 
  auditId: string, 
  url: string, 
  status: 'done'|'skipped' = 'done'
) {
  await env.DB.prepare(`
    UPDATE audit_frontier SET status=?1, updated_at=datetime('now')
    WHERE audit_id=?2 AND url=?3
  `).bind(status, auditId, url).run();
}

export async function remainingCount(env: any, auditId: string) {
  const row = await env.DB.prepare(`
    SELECT COUNT(*) as c FROM audit_frontier WHERE audit_id=?1 AND status='pending'
  `).bind(auditId).first<any>();
  return Number(row?.c ?? 0);
}

export async function getFrontierStats(env: any, auditId: string) {
  const stats = await env.DB.prepare(`
    SELECT 
      status,
      COUNT(*) as count,
      MIN(depth) as min_depth,
      MAX(depth) as max_depth
    FROM audit_frontier 
    WHERE audit_id=?1 
    GROUP BY status
  `).bind(auditId).all<any>();
  
  return stats.results;
}
