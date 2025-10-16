/**
 * Tiny Tick Crawl Logic
 * Process exactly 1 page per tick, chain aggressively
 */

import { leaseOneUrl, markUrlDone, demoteStaleVisiting, getFrontierCounts } from './frontier-lease';
import { renderPage } from '../render';
import { makeBudget } from '../lib/timebudget';

export async function runTinyCrawlTick(
  env: any,
  auditId: string,
  ctx: any
): Promise<{shouldContinue: boolean}> {
  console.log(`[TinyCrawl] Starting tiny crawl tick for ${auditId}`);
  
  const budget = makeBudget(parseInt(env.CRAWL_TICK_BUDGET_MS || '8000'));
  
  // 1. Demote stale visiting URLs first thing
  const demoted = await demoteStaleVisiting(env.DB, auditId, parseInt(env.VISITING_TTL_MS || '60000'));
  if (demoted > 0) {
    console.log(`[TinyCrawl] Demoted ${demoted} stale visiting URLs to pending`);
  }
  
  // 2. Lease exactly one URL atomically
  const leased = await leaseOneUrl(env.DB, auditId);
  if (!leased) {
    console.log(`[TinyCrawl] No URLs available to lease`);
    const counts = await getFrontierCounts(env.DB, auditId);
    return { shouldContinue: counts.pending > 0 || counts.visiting > 0 };
  }
  
  console.log(`[TinyCrawl] Leased URL: ${leased.url} (depth: ${leased.depth})`);
  
  // 3. Process this one URL
  try {
    const renderResult = await renderPage(env, leased.url);
    
    // Save page immediately
    await env.DB.prepare(`
      INSERT INTO audit_pages (
        audit_id, url, status_code, load_ms, content_type, body_text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(audit_id, url) DO UPDATE SET
        status_code=excluded.status_code,
        load_ms=excluded.load_ms,
        content_type=excluded.content_type,
        body_text=excluded.body_text,
        updated_at=CURRENT_TIMESTAMP
    `).bind(
      auditId,
      leased.url,
      renderResult.statusCode || 200,
      renderResult.loadTimeMs || 0,
      renderResult.contentType || 'text/html',
      renderResult.html || ''
    ).run();
    
    console.log(`[TinyCrawl] Saved page: ${leased.url} (${renderResult.loadTimeMs}ms)`);
    
    // Mark URL as done
    await markUrlDone(env.DB, auditId, leased.url);
    
    // Update pages_crawled counter
    await env.DB.prepare(`
      UPDATE audits 
      SET pages_crawled = (SELECT COUNT(*) FROM audit_pages WHERE audit_id = ?),
          phase_heartbeat_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(auditId, auditId).run();
    
    // Optional: Run analysis during crawl (if enabled)
    if (env.ANALYZE_DURING_CRAWL === "1" && renderResult.html) {
      try {
        const { analyzeHtml } = await import('./html-analyzer');
        const analysis = analyzeHtml(renderResult.html);
        
        await env.DB.prepare(`
          INSERT INTO audit_page_analysis (
            audit_id, url, h1, title, meta_description, canonical, robots_meta,
            schema_types, author, date_published, date_modified, images_count,
            headings_count, outbound_links_count, word_count, eeat_flags,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(audit_id, url) DO UPDATE SET
            h1=excluded.h1, title=excluded.title, meta_description=excluded.meta_description,
            canonical=excluded.canonical, robots_meta=excluded.robots_meta,
            schema_types=excluded.schema_types, author=excluded.author,
            date_published=excluded.date_published, date_modified=excluded.date_modified,
            images_count=excluded.images_count, headings_count=excluded.headings_count,
            outbound_links_count=excluded.outbound_links_count, word_count=excluded.word_count,
            eeat_flags=excluded.eeat_flags, updated_at=CURRENT_TIMESTAMP
        `).bind(
          auditId, leased.url, analysis.h1, analysis.title, analysis.metaDescription,
          analysis.canonical, analysis.robotsMeta, analysis.schemaTypes, analysis.author,
          analysis.datePublished, analysis.dateModified, analysis.imagesCount,
          analysis.headingsCount, analysis.outboundLinksCount, analysis.wordCount,
          analysis.eeatFlags
        ).run();
        
        console.log(`[TinyCrawl] Analyzed page: ${leased.url}`);
      } catch (error) {
        console.error(`[TinyCrawl] Analysis failed for ${leased.url}:`, error);
      }
    }
    
  } catch (error) {
    console.error(`[TinyCrawl] Failed to process ${leased.url}:`, error);
    // Mark as done even if failed to prevent retry loops
    await markUrlDone(env.DB, auditId, leased.url);
  }
  
  // 4. Check if we should continue
  const counts = await getFrontierCounts(env.DB, auditId);
  const pagesCount = await env.DB.prepare(`SELECT COUNT(*) as c FROM audit_pages WHERE audit_id=?`)
    .bind(auditId).first<{c: number}>();
  
  const pagesDone = pagesCount?.c ?? 0;
  const shouldContinue = (counts.pending > 0 || counts.visiting > 0) && pagesDone < 50;
  
  console.log(`[TinyCrawl] Tick complete: ${counts.pending} pending, ${counts.visiting} visiting, ${counts.done} done, ${pagesDone} pages, shouldContinue: ${shouldContinue}`);
  
  return { shouldContinue };
}
