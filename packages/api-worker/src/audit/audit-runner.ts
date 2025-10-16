/**
 * Single-Phase-Per-Tick Audit Runner
 * Ensures exactly one phase runs per execution to prevent fall-through
 */

export async function runAuditPhases(env: any, ctx: any, { auditId, resume }: { auditId: string; resume?: boolean }) {
  console.log(`[AuditRunner] Running single phase for audit ${auditId}, resume=${resume}`);
  
  // Always re-read current phase from DB
  const auditRow = await env.DB.prepare(`SELECT phase, pages_crawled FROM audits WHERE id=?1`).bind(auditId).first<any>();
  const phase = auditRow?.phase ?? 'init';
  const pagesCrawled = auditRow?.pages_crawled ?? 0;
  
  console.log(`[AuditRunner] Current phase: ${phase}, pages_crawled: ${pagesCrawled}`);
  
  // Check if crawl is already complete and skip to analysis phases
  const maxPages = parseInt(env.CRAWL_MAX_PAGES ?? '50');
  if (pagesCrawled >= maxPages && ['discovery', 'robots', 'sitemap', 'probes', 'crawl'].includes(phase)) {
    console.log(`[AuditRunner] Crawl already complete (${pagesCrawled}/${maxPages}), skipping to citations phase`);
    await env.DB.prepare(`
      UPDATE audits 
      SET phase='citations', phase_started_at=datetime('now'), phase_heartbeat_at=datetime('now')
      WHERE id=? AND status='running'
    `).bind(auditId).run();
    
    // Re-read the updated phase
    const updatedRow = await env.DB.prepare(`SELECT phase FROM audits WHERE id=?1`).bind(auditId).first<any>();
    const updatedPhase = updatedRow?.phase ?? 'citations';
    console.log(`[AuditRunner] Updated phase: ${updatedPhase}`);
    
    // Continue with the updated phase
    return runAuditPhases(env, ctx, { auditId, resume });
  }

  switch (phase) {
           case 'crawl': {
             const { runHybridCrawlTick } = await import('./crawl-hybrid');
             const result = await runHybridCrawlTick(env, auditId, ctx);      // returns continuation info
             
             // Hybrid tiny-tick: chains up to CHAIN_MAX times, then yields to cron
             console.log(`[AuditRunner] Hybrid tiny-tick complete, shouldContinue: ${result.shouldContinue}`);
             
             // If crawl is complete, transition to citations phase
             if (!result.shouldContinue) {
               const { ensureCrawlCompleteOrRewind } = await import('./bounce-back');
               const crawlComplete = await ensureCrawlCompleteOrRewind(env, auditId, parseInt(env.CRAWL_MAX_PAGES ?? '50'));
               if (crawlComplete) {
                 console.log(`[AuditRunner] Crawl complete, transitioning to citations phase`);
                 await env.DB.prepare(`
                   UPDATE audits 
                   SET phase='citations', phase_started_at=datetime('now'), phase_heartbeat_at=datetime('now')
                   WHERE id=? AND status='running'
                 `).bind(auditId).run();
                 
                 // Schedule next phase
                // Yield to cron pump instead of self-calling
                console.log(`[AuditRunner] Yielding to cron pump for continuation`);
               }
             }
             return;                                // 🔴 never run another phase in same tick
           }
    case 'citations': {
      // bounce-back guard lives at top of citations phase
      const { ensureCrawlCompleteOrRewind } = await import('./bounce-back');
      const ok = await ensureCrawlCompleteOrRewind(env, auditId, parseInt(env.CRAWL_MAX_PAGES ?? '50'));
      if (!ok) return;                       // rewound; continuation scheduled
      await runCitationsTick(env, auditId);  // a single batch
      
      // Yield to cron pump for next phase
      console.log(`[AuditRunner] Yielding to cron pump for next phase (synth)`);
      return;
    }
    case 'synth': {
      const { ensureCrawlCompleteOrRewind } = await import('./bounce-back');
      const ok = await ensureCrawlCompleteOrRewind(env, auditId, parseInt(env.CRAWL_MAX_PAGES ?? '50'));
      if (!ok) return;
      
      const { runSynthTick } = await import('./synth');
      const synthComplete = await runSynthTick(env, auditId);      // a single batch if needed
      
      if (synthComplete) {
        // Synthesis is complete, transition to finalize phase
        console.log(`[AuditRunner] Synthesis complete, transitioning to finalize phase`);
        await env.DB.prepare(`
          UPDATE audits 
          SET phase='finalize', phase_started_at=datetime('now'), phase_heartbeat_at=datetime('now')
          WHERE id=? AND status='running'
        `).bind(auditId).run();
        
        // Run finalize phase immediately
        const { finalizeAudit } = await import('./finalize');
        await finalizeAudit(env, auditId);
        console.log(`[AuditRunner] Audit ${auditId} completed with scores`);
        return;
      }
      
      // Yield to cron pump for more synthesis work
      console.log(`[AuditRunner] Yielding to cron pump for more synthesis work`);
      return;
    }
    case 'finalize': {
      const { ensureCrawlCompleteOrRewind } = await import('./bounce-back');
      const ok = await ensureCrawlCompleteOrRewind(env, auditId, parseInt(env.CRAWL_MAX_PAGES ?? '50'));
      if (!ok) return;
      
      const { finalizeAudit } = await import('./finalize');
      await finalizeAudit(env, auditId);
      return;
    }
    default:
      // discovery/robots/sitemap/probes should ALSO return after each chunk
      await runPhaseOnce(env, auditId, phase, ctx);
      
      // Yield to cron pump for next phase
      console.log(`[AuditRunner] Yielding to cron pump for next phase`);
      return;
  }
}

async function runCrawlTick(env: any, auditId: string, ctx: any) {
  console.log(`[AuditRunner] Running crawl tick for ${auditId}`);
  
  // TICK HYGIENE: Demote stale visiting URLs to pending (critical for continuation)
  const demoteResult = await env.DB.prepare(`
    UPDATE audit_frontier 
    SET status='pending', updated_at=datetime('now')
    WHERE audit_id=?1 AND status='visiting' 
    AND DATETIME(updated_at) <= DATETIME('now', '-120 seconds')
  `).bind(auditId).run();
  
  if (demoteResult.changes > 0) {
    console.log(`FRONTIER_RECOVER_VISITING { audit: ${auditId}, recovered: ${demoteResult.changes} }`);
  }
  
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
    
    // Seed the frontier using smart discovery
    const seedResult = await seedFrontier(env, auditId, baseUrl, {
      maxSitemap: parseInt(env.SITEMAP_URL_CAP || '500')
    });
    
    console.log(`[AuditRunner] Frontier seeded: ${seedResult.total} URLs, seeded: ${seedResult.seeded}`);
    
    if (!seedResult.seeded) {
      console.error(`[AuditRunner] Seeding failed: ${seedResult.reason || 'unknown'}`);
      return { shouldContinue: false }; // Let watchdog handle failed seeding
    }
    
    phaseState.crawl = { ...phaseState.crawl, seeded: 1, seeded_at: new Date().toISOString() };
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
    console.log(`[AuditRunner] More work to do, scheduling immediate continuation`);
    // GUARANTEED CONTINUATION: Schedule next tick immediately if work remains
    if (stateRow.pending > 0) {
      console.log(`[AuditRunner] Yielding to cron pump for immediate continuation (pending: ${stateRow.pending})`);
    }
  } else {
    console.log(`[AuditRunner] Successfully advanced from crawl to citations phase`);
  }
  
  // Tick-level observability
  const timeMs = Date.now() - Date.now(); // TODO: track actual tick start time
  console.log(`CRAWL_TICK { audit: ${auditId}, saved: ${batch.processed}, analyzed: ${analyzedTotal}, pending: ${stateRow.pending}, visiting: ${stateRow.visiting}, done: ${stateRow.done}, ms: ${timeMs} }`);
  
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

async function runPhaseOnce(env: any, auditId: string, phase: string, ctx: any) {
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
      
      // Use new seeding logic for main-only mode
      const { seedFrontier } = await import('./seed');
      const seedResult = await seedFrontier(env, auditId, baseUrl, ctx);
      
      console.log(`[AuditRunner] Sitemap seeding: ${seedResult.seeded} URLs seeded`);
      
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
