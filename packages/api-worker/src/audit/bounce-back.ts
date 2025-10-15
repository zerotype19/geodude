/**
 * Bounce-back guard to ensure crawl is complete before advancing phases
 */

export async function ensureCrawlCompleteOrRewind(env: any, auditId: string, maxPages: number): Promise<boolean> {
  // Recover stuck "visiting" URLs before checking
  await env.DB.prepare(`
    UPDATE audit_frontier
    SET status='pending', updated_at=datetime('now')
    WHERE audit_id=?1
      AND status='visiting'
      AND julianday('now') - julianday(updated_at) > (2.0/1440)
  `).bind(auditId).run();

  const row = await env.DB.prepare(`
    WITH pend AS (
      SELECT COUNT(*) AS c FROM audit_frontier
      WHERE audit_id=?1 AND status='pending'
    ),
    visit AS (
      SELECT COUNT(*) AS c FROM audit_frontier
      WHERE audit_id=?1 AND status='visiting'
    ),
    pages AS (
      SELECT COUNT(*) AS c FROM audit_pages WHERE audit_id=?1
    )
    SELECT pend.c AS pending, visit.c AS visiting, pages.c AS pages
    FROM pend, visit, pages
  `).bind(auditId).first<any>();

  const pending = Number(row?.pending ?? 0);
  const visiting = Number(row?.visiting ?? 0);
  const pages = Number(row?.pages ?? 0);

  console.log(`[BounceBack] Check: ${pending} pending, ${visiting} visiting, ${pages} pages (target: ${maxPages})`);

  if ((pending > 0 || visiting > 0) && pages < maxPages) {
    console.log(`[BounceBack] BOUNCE_BACK_TO_CRAWL: pending=${pending}, visiting=${visiting}, pages=${pages}/${maxPages} - rewinding to crawl`);
    
    // Bounce back to crawl
    await env.DB.prepare(`
      UPDATE audits
      SET phase='crawl', phase_started_at=datetime('now'), phase_heartbeat_at=datetime('now')
      WHERE id=?1 AND status='running'
    `).bind(auditId).run();

    // Import and call selfContinue
    const { selfContinue } = await import('./continue');
    await selfContinue(env, auditId);
    return false; // do not run this phase
  }
  
  console.log(`[BounceBack] Crawl complete: proceeding with phase`);
  return true; // proceed with phase
}
