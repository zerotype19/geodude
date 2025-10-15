/**
 * Atomic gate for leaving crawl phase
 * Prevents race conditions by doing all checks and updates in a single transaction
 */

export async function tryAdvanceFromCrawl(env: any, auditId: string, maxPages: number): Promise<boolean> {
  // Recover stuck "visiting" URLs before checking
  await env.DB.prepare(`
    UPDATE audit_frontier
    SET status='pending', updated_at=datetime('now')
    WHERE audit_id=?1
      AND status='visiting'
      AND julianday('now') - julianday(updated_at) > (2.0/1440)
  `).bind(auditId).run();

  // require seeded=1 to allow "exhausted frontier" exit
  const seeded = await env.DB.prepare(`
    SELECT json_extract(phase_state,'$.crawl.seeded') AS seeded
    FROM audits WHERE id=?1
  `).bind(auditId).first<any>();

  const seededInt = Number(seeded?.seeded ?? 0);

  const res = await env.DB.prepare(`
    UPDATE audits
    SET phase='citations',
        phase_started_at=datetime('now'),
        phase_heartbeat_at=datetime('now')
    WHERE id=?1
      AND status='running'
      AND phase='crawl'
      AND (
           -- A) we reached the goal
           (SELECT COUNT(*) FROM audit_pages WHERE audit_id=?1) >= ?2
        OR (
           -- B) frontier truly exhausted (no pending/visiting) AND seeding complete
           ?3 = 1
           AND (SELECT COUNT(*) FROM audit_frontier WHERE audit_id=?1 AND status IN ('pending','visiting')) = 0
        )
      )
  `).bind(auditId, maxPages, seededInt).run();

  const advanced = res?.success && (res as any).changes > 0;
  
  if (advanced) {
    console.log(`[CrawlExit] CRAWL_ADVANCED: Successfully advanced audit ${auditId} from crawl to citations`);
  } else {
    console.log(`[CrawlExit] Staying in crawl: frontier not ready or already advanced`);
  }
  
  return advanced;
}
