/**
 * Single-Phase-Per-Tick Audit Runner
 * Ensures exactly one phase runs per execution to prevent fall-through
 */

export async function runAuditPhases(env: any, ctx: any, { auditId, resume }: { auditId: string; resume?: boolean }) {
  console.log(`[AuditRunner] Running single phase for audit ${auditId}, resume=${resume}`);
  
  // Always re-read current phase from DB
  const auditRow = await env.DB.prepare(`SELECT phase FROM audits WHERE id=?1`).bind(auditId).first<any>();
  const phase = auditRow?.phase ?? 'init';
  
  console.log(`[AuditRunner] Current phase: ${phase}`);

  switch (phase) {
    case 'crawl': {
      const result = await runCrawlTick(env, auditId, ctx);      // returns continuation info
      
      // If work remains, schedule immediate next tick via ctx.waitUntil
      if (result.shouldContinue) {
        console.log(`[AuditRunner] Scheduling immediate continuation via ctx.waitUntil`);
        ctx.waitUntil(runAuditPhases(env, ctx, { auditId, resume: true }));
      }
      return;                                // 🔴 never run another phase in same tick
    }
    case 'citations': {
      // bounce-back guard lives at top of citations phase
      const { ensureCrawlCompleteOrRewind } = await import('./bounce-back');
      const ok = await ensureCrawlCompleteOrRewind(env, auditId, parseInt(env.CRAWL_MAX_PAGES ?? '50'));
      if (!ok) return;                       // rewound; continuation scheduled
      await runCitationsTick(env, auditId);  // a single batch
      
      // Schedule next phase
      console.log(`[AuditRunner] Scheduling next phase (synth) via ctx.waitUntil`);
      ctx.waitUntil(runAuditPhases(env, ctx, { auditId, resume: true }));
      return;
    }
    case 'synth': {
      const { ensureCrawlCompleteOrRewind } = await import('./bounce-back');
      const ok = await ensureCrawlCompleteOrRewind(env, auditId, parseInt(env.CRAWL_MAX_PAGES ?? '50'));
      if (!ok) return;
      await runSynthTick(env, auditId);      // a single batch if needed
      
      // Schedule next phase
      console.log(`[AuditRunner] Scheduling next phase (finalize) via ctx.waitUntil`);
      ctx.waitUntil(runAuditPhases(env, ctx, { auditId, resume: true }));
      return;
    }
    case 'finalize': {
      const { ensureCrawlCompleteOrRewind } = await import('./bounce-back');
      const ok = await ensureCrawlCompleteOrRewind(env, auditId, parseInt(env.CRAWL_MAX_PAGES ?? '50'));
      if (!ok) return;
      await finalizeAudit(env, auditId);
      return;
    }
    default:
      // discovery/robots/sitemap/probes should ALSO return after each chunk
      await runPhaseOnce(env, auditId, phase);
      
      // Schedule next phase via ctx.waitUntil
      console.log(`[AuditRunner] Scheduling next phase via ctx.waitUntil`);
      ctx.waitUntil(runAuditPhases(env, ctx, { auditId, resume: true }));
      return;
  }
}

async function runCrawlTick(env: any, auditId: string, ctx: any) {
  console.log(`[AuditRunner] Running crawl tick for ${auditId}`);
  
  // Frontier safety: demote stale visiting URLs to pending
  await env.DB.prepare(`
    UPDATE audit_frontier 
    SET status='pending', updated_at=datetime('now')
    WHERE audit_id=?1 AND status='visiting' 
    AND DATETIME(updated_at) <= DATETIME('now', '-120 seconds')
  `).bind(auditId).run();
  
  // Import crawl functions
  const { seedFrontier, getHomeNavLinks, loadSitemapUrls } = await import('./seed');
  const { crawlBatchBfs } = await import('./crawl-bfs');
  const { tryAdvanceFromCrawl } = await import('./crawl-exit');
  
  // Get audit details
  const auditRow = await env.DB.prepare(
    'SELECT domain FROM properties WHERE id = (SELECT property_id FROM audits WHERE id = ?)'
  ).bind(auditId).first<{ domain: string }>();
  
  if (!auditRow) {
    throw new Error('Property not found for audit');
  }
  
  const domain = auditRow.domain;
  const baseUrl = `https://${domain}`;
  
  // Check if frontier is already seeded
  const phaseStateRow = await env.DB.prepare(
    'SELECT phase_state FROM audits WHERE id=?1'
  ).bind(auditId).first<{ phase_state: string }>();
  
  let phaseState = {};
  try {
    phaseState = phaseStateRow?.phase_state ? JSON.parse(phaseStateRow.phase_state) : {};
  } catch (e) {
    console.warn(`[AuditRunner] Failed to parse phase_state for ${auditId}:`, e);
  }
  
  if (!phaseState.crawl?.seeded) {
    console.log(`[AuditRunner] Seeding crawl frontier for ${domain}`);
    
    const simpleMode = env.CRAWL_SIMPLE_MODE === "1";
    let navLinks: string[] = [];
    
    // Skip nav extraction in simple mode
    if (!simpleMode) {
      // Get navigation links from homepage
      const navResult = await getHomeNavLinks(env, baseUrl);
      navLinks = navResult.navLinks;
    } else {
      console.log(`[AuditRunner] Simple mode enabled - skipping nav extraction`);
    }
    
    // Get sitemap URLs if available
    const sitemapResult = await loadSitemapUrls(env, baseUrl, { cap: parseInt(env.SITEMAP_URL_CAP || '500') });
    const sitemapUrls = sitemapResult.urls;
    
    // Seed the frontier
    const seedResult = await seedFrontier(env, auditId, baseUrl, {
      navLinks,
      sitemapUrls,
      maxSitemap: parseInt(env.SITEMAP_URL_CAP || '500')
    });
    
    console.log(`[AuditRunner] Frontier seeded: ${seedResult.total} URLs`);
    
    // Mark as seeded in phase_state
    await env.DB.prepare(`
      UPDATE audits 
      SET phase_state = json_set(COALESCE(phase_state, '{}'), '$.crawl.seeded', 1)
      WHERE id=?1
    `).bind(auditId).run();
  }
  
  // Run BFS crawl batch
  const batchSize = parseInt(env.PAGE_BATCH_SIZE || '4');
  const deadlineMs = parseInt(env.CRAWL_TIMEBOX_MS || '25000');
  const maxDepth = parseInt(env.CRAWL_MAX_DEPTH || '3');
  const maxPages = parseInt(env.CRAWL_MAX_PAGES || '50');
  
  console.log(`[AuditRunner] Running BFS batch: batch size ${batchSize}, deadline ${deadlineMs}ms, max depth ${maxDepth}, max pages ${maxPages}`);
  
  const batch = await crawlBatchBfs(env, auditId, baseUrl, {
    deadlineMs,
    batchSize,
    maxDepth,
    maxPages
  });
  
  console.log(`[AuditRunner] BFS batch completed: processed ${batch.processed} pages in ${batch.timeMs}ms`);
  
  // Update heartbeat
  await env.DB.prepare(`
    UPDATE audits 
    SET phase_heartbeat_at = datetime('now')
    WHERE id=?1
  `).bind(auditId).run();
  
  // Demote stale visiting → pending before gate check
  const recoveredResult = await env.DB.prepare(`
    UPDATE audit_frontier
    SET status='pending', updated_at=datetime('now')
    WHERE audit_id=?1
      AND status='visiting'
      AND julianday('now') - julianday(updated_at) > (2.0/1440)
  `).bind(auditId).run();
  
  if (recoveredResult.changes > 0) {
    console.log(`[AuditRunner] Recovered ${recoveredResult.changes} stuck 'visiting' URLs back to 'pending'`);
  }
  
  // Log state before gate check
  const stateRow = await env.DB.prepare(`
    WITH pend AS (SELECT COUNT(*) AS c FROM audit_frontier WHERE audit_id=?1 AND status='pending'),
         visit AS (SELECT COUNT(*) AS c FROM audit_frontier WHERE audit_id=?1 AND status='visiting'),
         done AS (SELECT COUNT(*) AS c FROM audit_frontier WHERE audit_id=?1 AND status='done'),
         pages AS (SELECT COUNT(*) AS c FROM audit_pages WHERE audit_id=?1),
         seeded AS (SELECT json_extract(phase_state,'$.crawl.seeded') AS seeded FROM audits WHERE id=?1)
    SELECT pend.c AS pending, visit.c AS visiting, done.c AS done, pages.c AS pages, seeded.seeded AS seeded
    FROM pend, visit, done, pages, seeded
  `).bind(auditId).first<any>();
  
  // Get analysis count for observability
  const analyzedCount = await env.DB.prepare(`SELECT COUNT(*) as c FROM audit_page_analysis WHERE audit_id=?1`)
    .bind(auditId).first<any>();
  const analyzedTotal = Number(analyzedCount?.c ?? 0);
  
  console.log(`[AuditRunner] Pre-gate state: ${stateRow.pending} pending, ${stateRow.visiting} visiting, ${stateRow.done} done, ${stateRow.pages} pages, seeded=${stateRow.seeded}, batchProcessed=${batch.processed}`);
  
  // Try to advance atomically
  const advanced = await tryAdvanceFromCrawl(env, auditId, maxPages);
  if (!advanced) {
    console.log(`[AuditRunner] More work to do, relying on watchdog to continue`);
    // Don't make HTTP requests to ourselves - let watchdog handle continuation
  } else {
    console.log(`[AuditRunner] Successfully advanced from crawl to citations phase`);
  }
  
  // Tick-level observability
  const timeMs = Date.now() - Date.now(); // TODO: track actual tick start time
  console.log(`CRAWL_TICK {processed: ${batch.processed}, pages: ${stateRow.pages}, analyzed_total: ${analyzedTotal}, pending: ${stateRow.pending}, visiting: ${stateRow.visiting}, ms: ${timeMs}}`);
  
  // Return continuation info
  return { shouldContinue: !advanced && stateRow.pending > 0 }; // 🔴 always stop here
}

async function runCitationsTick(env: any, auditId: string) {
  console.log(`[AuditRunner] Running citations tick for ${auditId}`);
  // TODO: Implement single citations batch
  // For now, just advance to synth
  await env.DB.prepare(`
    UPDATE audits
    SET phase='synth', phase_started_at=datetime('now'), phase_heartbeat_at=datetime('now')
    WHERE id=?1 AND status='running'
  `).bind(auditId).run();
  
  console.log(`[AuditRunner] Citations phase completed, relying on watchdog to continue`);
}

async function runSynthTick(env: any, auditId: string) {
  console.log(`[AuditRunner] Running synth tick for ${auditId}`);
  // TODO: Implement single synth batch
  // For now, just advance to finalize
  await env.DB.prepare(`
    UPDATE audits
    SET phase='finalize', phase_started_at=datetime('now'), phase_heartbeat_at=datetime('now')
    WHERE id=?1 AND status='running'
  `).bind(auditId).run();
  
  console.log(`[AuditRunner] Citations phase completed, relying on watchdog to continue`);
}

async function finalizeAudit(env: any, auditId: string) {
  console.log(`[AuditRunner] Finalizing audit ${auditId}`);
  // TODO: Implement finalization
  await env.DB.prepare(`
    UPDATE audits
    SET status='completed', completed_at=datetime('now')
    WHERE id=?1 AND status='running'
  `).bind(auditId).run();
}

async function runPhaseOnce(env: any, auditId: string, phase: string) {
  console.log(`[AuditRunner] Running phase ${phase} for ${auditId}`);
  
  // Get audit details
  const auditRow = await env.DB.prepare(
    'SELECT domain FROM properties WHERE id = (SELECT property_id FROM audits WHERE id = ?)'
  ).bind(auditId).first<{ domain: string }>();
  
  if (!auditRow) {
    throw new Error('Property not found for audit');
  }
  
  const domain = auditRow.domain;
  const baseUrl = `https://${domain}`;
  
  switch (phase) {
    case 'init': {
      console.log(`[AuditRunner] Init phase for ${domain}`);
      // Update heartbeat
      await env.DB.prepare(`
        UPDATE audits 
        SET phase_heartbeat_at = datetime('now')
        WHERE id=?1
      `).bind(auditId).run();
      
      // Advance to discovery
      await env.DB.prepare(`
        UPDATE audits
        SET phase='discovery', phase_started_at=datetime('now'), phase_heartbeat_at=datetime('now')
        WHERE id=?1 AND status='running'
      `).bind(auditId).run();
      break;
    }
    
    case 'discovery': {
      console.log(`[AuditRunner] Discovery phase for ${domain}`);
      // Update heartbeat
      await env.DB.prepare(`
        UPDATE audits 
        SET phase_heartbeat_at = datetime('now')
        WHERE id=?1
      `).bind(auditId).run();
      
      // Advance to robots
      await env.DB.prepare(`
        UPDATE audits
        SET phase='robots', phase_started_at=datetime('now'), phase_heartbeat_at=datetime('now')
        WHERE id=?1 AND status='running'
      `).bind(auditId).run();
      break;
    }
    
    case 'robots': {
      console.log(`[AuditRunner] Robots phase for ${domain}`);
      const { checkRobotsTxt } = await import('../crawl');
      await checkRobotsTxt(baseUrl);
      
      // Advance to sitemap
      await env.DB.prepare(`
        UPDATE audits
        SET phase='sitemap', phase_started_at=datetime('now'), phase_heartbeat_at=datetime('now')
        WHERE id=?1 AND status='running'
      `).bind(auditId).run();
      break;
    }
    
    case 'sitemap': {
      console.log(`[AuditRunner] Sitemap phase for ${domain}`);
      const { checkSitemap } = await import('../crawl');
      await checkSitemap(baseUrl, []); // TODO: Pass sitemap URLs from robots
      
      // Advance to probes
      await env.DB.prepare(`
        UPDATE audits
        SET phase='probes', phase_started_at=datetime('now'), phase_heartbeat_at=datetime('now')
        WHERE id=?1 AND status='running'
      `).bind(auditId).run();
      break;
    }
    
    case 'probes': {
      console.log(`[AuditRunner] Probes phase for ${domain}`);
      const { probeAiAccess } = await import('../crawl');
      await probeAiAccess(domain);
      
      // Advance to crawl
      await env.DB.prepare(`
        UPDATE audits
        SET phase='crawl', phase_started_at=datetime('now'), phase_heartbeat_at=datetime('now')
        WHERE id=?1 AND status='running'
      `).bind(auditId).run();
      break;
    }
    
    default:
      console.log(`[AuditRunner] Unknown phase ${phase}, advancing to crawl`);
      await env.DB.prepare(`
        UPDATE audits
        SET phase='crawl', phase_started_at=datetime('now'), phase_heartbeat_at=datetime('now')
        WHERE id=?1 AND status='running'
      `).bind(auditId).run();
  }
  
  console.log(`[AuditRunner] Citations phase completed, relying on watchdog to continue`);
}

function getNextPhase(currentPhase: string): string {
  const phases = ['init', 'discovery', 'robots', 'sitemap', 'probes', 'crawl', 'citations', 'synth', 'finalize'];
  const currentIndex = phases.indexOf(currentPhase);
  return currentIndex < phases.length - 1 ? phases[currentIndex + 1] : 'finalize';
}
