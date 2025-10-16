/**
 * Hybrid Tiny-Tick Crawler
 * Single-flight lock + chain window + 1 page per tick
 */

import { renderPage } from '../render-basic';

export async function runHybridCrawlTick(
  env: any,
  auditId: string,
  ctx: any
): Promise<{shouldContinue: boolean}> {
  console.log(`[HybridCrawl] Starting hybrid tiny-tick for ${auditId}`);
  
  // 1. Single-flight lock (expire stale locks first)
  await env.DB.prepare(`
    DELETE FROM audit_locks
    WHERE audit_id=? AND (strftime('%s','now') - locked_at) > 20
  `).bind(auditId).run();

  // Try to acquire lock
  const got = await env.DB.prepare(`
    INSERT OR IGNORE INTO audit_locks (audit_id, locked_at)
    VALUES (?, strftime('%s','now'))
  `).bind(auditId).run();

  if (got.meta?.changes === 0) {
    console.log(`[HybridCrawl] TICK_SKIPPED_LOCK { auditId: ${auditId} }`);
    return { shouldContinue: true }; // Another tick is running
  }

  try {
    const tTick0 = Date.now();

    // 2. Demote stale 'visiting' first
    await env.DB.prepare(`
      UPDATE audit_frontier
      SET status='pending'
      WHERE audit_id=? AND status='visiting'
        AND (strftime('%s','now') - strftime('%s', updated_at)) > (?/1000)
    `).bind(auditId, Number(env.VISITING_TTL_MS ?? 60000)).run();

    // 3. Lease exactly 1 URL (D1-safe: SELECT then UPDATE)
    const row = await env.DB.prepare(`
      SELECT url, depth FROM audit_frontier
      WHERE audit_id=? AND status='pending'
      ORDER BY priority ASC, depth ASC, created_at ASC
      LIMIT 1
    `).bind(auditId).first();

    if (!row) {
      console.log(`[HybridCrawl] No URLs available to lease for ${auditId}`);
      
      // Check if crawl is complete and trigger phase transition
      const pagesCount = await env.DB.prepare(`SELECT COUNT(*) as count FROM audit_pages WHERE audit_id=?`).bind(auditId).first();
      const pagesCrawled = pagesCount?.count ?? 0;
      
      if (pagesCrawled >= parseInt(env.CRAWL_MAX_PAGES ?? '50')) {
        console.log(`[HybridCrawl] Crawl complete: ${pagesCrawled} pages, transitioning to citations phase`);
        await env.DB.prepare(`
          UPDATE audits 
          SET phase='citations', phase_started_at=datetime('now'), phase_heartbeat_at=datetime('now')
          WHERE id=? AND status='running'
        `).bind(auditId).run();
        
        // Yield to cron pump for phase transition
        console.log(`[HybridCrawl] Yielding to cron pump for phase transition`);
      }
      
      return { shouldContinue: false };
    }

    // Update the selected row to 'visiting'
    await env.DB.prepare(`
      UPDATE audit_frontier
      SET status='visiting', updated_at=CURRENT_TIMESTAMP
      WHERE audit_id=? AND url=?
    `).bind(auditId, row.url).run();

    console.log(`[HybridCrawl] Leased URL: ${row.url} (depth: ${row.depth})`);

    // 4. Fetch page (basic only)
    const page = await renderPage(row.url, env);

    // 5. Save page (match your schema)
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
      page.status,
      page.loadTimeMs,
      page.contentType,
      page.html
    ).run();

    console.log(`[HybridCrawl] Saved page: ${row.url} (${page.loadTimeMs}ms, status: ${page.status})`);

    // 6. Mark URL as done
    await env.DB.prepare(`
      UPDATE audit_frontier
      SET status='done', updated_at=CURRENT_TIMESTAMP
      WHERE audit_id=? AND url=?
    `).bind(auditId, row.url).run();

    // 7. Update pages_crawled counter and heartbeat
    await env.DB.prepare(`
      UPDATE audits 
      SET pages_crawled = (SELECT COUNT(*) FROM audit_pages WHERE audit_id = ?),
          phase_heartbeat_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(auditId, auditId).run();

    // 8. Check if we should chain (inline logic to avoid hoisting issues)
    const counts = await env.DB.prepare(`
      SELECT 
        SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status='visiting' THEN 1 ELSE 0 END) AS visiting
      FROM audit_frontier WHERE audit_id=?
    `).bind(auditId).first();

    const pending = counts?.pending ?? 0;
    
    // Inline chain logic to avoid hoisting issues
    let shouldChain = false;
    if (pending > 0) {
      const cfgMax = Number(env.CHAIN_MAX ?? 10);
      const softMs = Number(env.CHAIN_SOFT_DEADLINE_MS ?? 18000);

      const row = await env.DB.prepare(
        `SELECT phase_state FROM audits WHERE id=?`
      ).bind(auditId).first();

      let st: any = {};
      try {
        st = row?.phase_state ? JSON.parse(row.phase_state) : {};
      } catch {
        st = {};
      }

      const now = Date.now();

      // Initialize chain window
      if (!st.chainStartedAt || !st.chainCount) {
        st.chainStartedAt = now;
        st.chainCount = 0;
      }

      // Budget check (end tick if we've spent our soft budget)
      const elapsed = now - st.chainStartedAt;
      if (elapsed > softMs) {
        st.chainStartedAt = null;
        st.chainCount = 0;
        await env.DB.prepare(`UPDATE audits SET phase_state=? WHERE id=?`)
          .bind(JSON.stringify(st), auditId).run();
        console.log(`[HybridCrawl] Chain window expired after ${elapsed}ms`);
        shouldChain = false;
      } else if (st.chainCount >= cfgMax) {
        // Count check
        st.chainStartedAt = null;
        st.chainCount = 0;
        await env.DB.prepare(`UPDATE audits SET phase_state=? WHERE id=?`)
          .bind(JSON.stringify(st), auditId).run();
        console.log(`[HybridCrawl] Chain limit reached: ${st.chainCount}/${cfgMax}`);
        shouldChain = false;
      } else {
        st.chainCount += 1;
        await env.DB.prepare(`UPDATE audits SET phase_state=? WHERE id=?`)
          .bind(JSON.stringify(st), auditId).run();
        console.log(`[HybridCrawl] Chain ${st.chainCount}/${cfgMax} (${elapsed}ms elapsed)`);
        shouldChain = true;
      }
    }

    console.log(`[HybridCrawl] Tick complete: ${pending} pending, shouldChain: ${shouldChain}`);

    if (shouldChain) {
      console.log(`[HybridCrawl] Would chain, but yielding to cron pump to avoid HTTP 522 timeouts`);
    } else {
      console.log(`[HybridCrawl] Yielding to cron pump`);
    }

    return { shouldContinue: shouldChain };

  } finally {
    // Always release lock
    await env.DB.prepare(`DELETE FROM audit_locks WHERE audit_id = ?`)
      .bind(auditId).run();
  }
}