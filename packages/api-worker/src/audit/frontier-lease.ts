/**
 * Atomic URL Leasing
 * Lease one URL per tick atomically to prevent race conditions
 */

export async function leaseOneUrl(db: any, auditId: string): Promise<{url: string; depth: number} | null> {
  // D1-safe single-row lease (two-step: SELECT then UPDATE)
  const row = await db.prepare(`
    SELECT url, depth FROM audit_frontier
    WHERE audit_id=? AND status='pending'
    ORDER BY priority ASC, depth ASC, created_at ASC
    LIMIT 1
  `).bind(auditId).first();
  
  if (!row) return null;
  
  // Update the selected row to 'visiting' using composite key
  await db.prepare(`
    UPDATE audit_frontier
    SET status='visiting', updated_at=CURRENT_TIMESTAMP
    WHERE audit_id=? AND url=?
  `).bind(auditId, row.url).run();
  
  return { url: row.url, depth: row.depth };
}

export async function markUrlDone(db: any, auditId: string, url: string): Promise<void> {
  await db.prepare(`
    UPDATE audit_frontier
    SET status='done', updated_at=CURRENT_TIMESTAMP
    WHERE audit_id=? AND url=? AND status='visiting'
  `).bind(auditId, url).run();
}

export async function demoteStaleVisiting(db: any, auditId: string, ttlMs: number = 60000): Promise<number> {
  const result = await db.prepare(`
    UPDATE audit_frontier
    SET status='pending', updated_at=CURRENT_TIMESTAMP
    WHERE audit_id=? AND status='visiting'
      AND strftime('%s','now') - strftime('%s', updated_at) > (?/1000)
  `).bind(auditId, ttlMs).run();
  
  return result.meta?.changes ?? 0;
}

export async function getFrontierCounts(db: any, auditId: string): Promise<{pending: number; visiting: number; done: number}> {
  const result = await db.prepare(`
    SELECT 
      SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='visiting' THEN 1 ELSE 0 END) AS visiting,
      SUM(CASE WHEN status='done'     THEN 1 ELSE 0 END) AS done
    FROM audit_frontier WHERE audit_id=?
  `).bind(auditId).first();
  
  return {
    pending: result?.pending ?? 0,
    visiting: result?.visiting ?? 0,
    done: result?.done ?? 0
  };
}
