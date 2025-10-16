/**
 * Simple Bulletproof Crawl Tick (No Lock)
 * Relies on cron pump for continuation instead of single-flight lock
 */

import { renderPage } from '../render-basic';

export async function runSimpleCrawlTick(
  env: any,
  auditId: string,
  ctx: any
): Promise<{shouldContinue: boolean}> {
  console.log(`[SimpleCrawl] Starting simple crawl tick for ${auditId}`);
  
  try {
    // 1. Demote stale 'visiting' first
    await env.DB.prepare(`
      UPDATE audit_frontier
      SET status='pending'
      WHERE audit_id=? AND status='visiting'
        AND (strftime('%s','now') - strftime('%s', updated_at)) > (?/1000)
    `).bind(auditId, Number(env.VISITING_TTL_MS ?? 60000)).run();

    // 2. Atomic lease ONE URL (D1-safe: SELECT then UPDATE)
    const row = await env.DB.prepare(`
      SELECT url, depth FROM audit_frontier
      WHERE audit_id=? AND status='pending'
      ORDER BY priority ASC, depth ASC, created_at ASC
      LIMIT 1
    `).bind(auditId).first();

    if (!row) {
      console.log(`[SimpleCrawl] No URLs available to lease for ${auditId}`);
      return { shouldContinue: false };
    }

    // Update the selected row to 'visiting'
    await env.DB.prepare(`
      UPDATE audit_frontier
      SET status='visiting', updated_at=CURRENT_TIMESTAMP
      WHERE audit_id=? AND url=?
    `).bind(auditId, row.url).run();

    console.log(`[SimpleCrawl] Leased URL: ${row.url} (depth: ${row.depth})`);

    // 3. Fetch page (basic only), save, mark done
    const res = await renderPage(row.url, env);
    
    // Save page immediately
    await env.DB.prepare(`
      INSERT INTO audit_pages (
        audit_id, url, status_code, load_ms, content_type, body_text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(audit_id, url) DO UPDATE SET
        status_code=excluded.status_code,
        load_ms=excluded.load_ms,
        content_type=excluded.content_type,
        body_text=excluded.body_text
    `).bind(
      auditId,
      row.url,
      res.status,
      res.loadTimeMs,
      res.contentType,
      res.html
    ).run();

    console.log(`[SimpleCrawl] Saved page: ${row.url} (${res.loadTimeMs}ms, status: ${res.status})`);

    // Update pages_crawled counter
    await env.DB.prepare(`
      UPDATE audits 
      SET pages_crawled = (SELECT COUNT(*) FROM audit_pages WHERE audit_id = ?),
          phase_heartbeat_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(auditId, auditId).run();

    // Mark URL as done
    await env.DB.prepare(`
      UPDATE audit_frontier
      SET status='done', updated_at=CURRENT_TIMESTAMP
      WHERE audit_id=? AND url=?
    `).bind(auditId, row.url).run();

    // 4. Check if we should continue
    const counts = await env.DB.prepare(`
      SELECT 
        SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status='visiting' THEN 1 ELSE 0 END) AS visiting,
        SUM(CASE WHEN status='done'     THEN 1 ELSE 0 END) AS done
      FROM audit_frontier WHERE audit_id=?
    `).bind(auditId).first();
    
    const pagesCount = await env.DB.prepare(`SELECT COUNT(*) as c FROM audit_pages WHERE audit_id=?`)
      .bind(auditId).first<{c: number}>();
    
    const pagesDone = pagesCount?.c ?? 0;
    const shouldContinue = (counts?.pending > 0 || counts?.visiting > 0) && pagesDone < 50;
    
    console.log(`[SimpleCrawl] Tick complete: ${counts?.pending} pending, ${counts?.visiting} visiting, ${counts?.done} done, ${pagesDone} pages, shouldContinue: ${shouldContinue}`);
    
    return { shouldContinue };
    
  } catch (error) {
    console.error(`[SimpleCrawl] Error in crawl tick for ${auditId}:`, error);
    return { shouldContinue: false };
  }
}
