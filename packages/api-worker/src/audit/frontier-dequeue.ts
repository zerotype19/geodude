/**
 * Frontier Dequeue Utilities
 * Handles atomic dequeue operations for crawl frontier
 */

export async function dequeuePendingBatch(
  db: any, 
  auditId: string, 
  n: number
): Promise<Array<{id: number; url: string; depth: number; priority: number}>> {
  const rows = await db.prepare(`
    SELECT id, url, depth, priority
      FROM audit_frontier
     WHERE audit_id=? AND status='pending'
     ORDER BY depth ASC, priority ASC, id ASC
     LIMIT ?
  `).bind(auditId, n).all();

  if (!rows.results?.length) return [];

  const ids = rows.results.map((r: any) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  
  await db.prepare(`
    UPDATE audit_frontier
       SET status='visiting', updated_at=CURRENT_TIMESTAMP
     WHERE id IN (${placeholders}) AND audit_id=? AND status='pending'
  `).bind(...ids, auditId).run();

  return rows.results as Array<{id: number; url: string; depth: number; priority: number}>;
}

export async function frontierCounts(
  db: any, 
  auditId: string
): Promise<{pending: number; visiting: number; done: number}> {
  const result = await db.prepare(`
    SELECT 
      SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='visiting' THEN 1 ELSE 0 END) AS visiting,
      SUM(CASE WHEN status='done'     THEN 1 ELSE 0 END) AS done
    FROM audit_frontier 
    WHERE audit_id=?
  `).bind(auditId).first<any>();

  return {
    pending: Number(result?.pending ?? 0),
    visiting: Number(result?.visiting ?? 0),
    done: Number(result?.done ?? 0)
  };
}
