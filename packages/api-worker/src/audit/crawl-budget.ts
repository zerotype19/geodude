/**
 * Time-Budgeted Crawl Implementation
 * Prevents worker timeouts by managing work per tick with strict time budgets
 */

import { makeBudget } from '../lib/timebudget';
import { dequeuePendingBatch, frontierCounts } from './frontier-dequeue';
import { enqueueBatch } from './frontier-batch';

export async function runCrawlTickWithBudget(
  env: any,
  auditId: string,
  ctx: any
): Promise<{ processed: number; enqueued: number; shouldContinue: boolean }> {
  const TICK_BUDGET = parseInt(env.CRAWL_TICK_BUDGET_MS || '18000');
  const ENQ_CAP = parseInt(env.MAX_LINKS_ENQUEUE_PER_TICK || '80');
  const BATCH_SIZE = parseInt(env.PAGE_BATCH_SIZE || '2');
  
  const budget = makeBudget(TICK_BUDGET);
  
  console.log(`[CrawlBudget] Starting tick with ${TICK_BUDGET}ms budget`);
  
  // Hygiene: demote stale 'visiting' to 'pending'
  const demoteResult = await env.DB.prepare(`
    UPDATE audit_frontier
       SET status='pending', updated_at=CURRENT_TIMESTAMP
     WHERE audit_id=? AND status='visiting'
       AND updated_at < datetime('now','-120 seconds')
  `).bind(auditId).run();
  
  if (demoteResult.changes > 0) {
    console.log(`FRONTIER_RECOVER_VISITING { audit: ${auditId}, recovered: ${demoteResult.changes} }`);
  }
  
  // Dequeue small batch
  const pages = await dequeuePendingBatch(env.DB, auditId, BATCH_SIZE);
  if (pages.length === 0) {
    console.log(`[CrawlBudget] No pages to process`);
    return { processed: 0, enqueued: 0, shouldContinue: false };
  }
  
  console.log(`DEQUEUE { batch: ${pages.length} }`);
  
  // Get audit details
  const auditRow = await env.DB.prepare(
    'SELECT domain FROM properties WHERE id = (SELECT property_id FROM audits WHERE id = ?)'
  ).bind(auditId).first<{ domain: string }>();
  
  if (!auditRow) {
    throw new Error('Property not found for audit');
  }
  
  const domain = auditRow.domain;
  const origin = `https://${domain}`;
  
  const toEnqueue: Array<{url: string; depth: number; priority: number}> = [];
  let pagesDone = 0;
  
  for (const page of pages) {
    if (budget.over(2000)) {
      console.log(`[CrawlBudget] Budget running low (${budget.left()}ms left), stopping page processing`);
      break;
    }
    
    const { url, depth } = page;
    
    try {
      // Fetch and render page
      const res = await renderPage(env, url);
      
      // Save page data
      await savePage(env, auditId, url, res);
      
      // Run HTML analysis if we have HTML
      const isHtml = res.html && res.html.length > 0;
      if (isHtml) {
        console.log('ANALYZE_RUN', { url, html_len: res.html.length });
        try {
          const { analyzeHtml } = await import('../analysis/html-analyzer');
          const { mapToDb } = await import('../analysis/map');
          const { saveAnalysisRow } = await import('../analysis/save-analysis');
          
          const parsed = analyzeHtml(res.html, url);
          const row = mapToDb(auditId, url, parsed);
          const r = await saveAnalysisRow(env, row);
          
          if (r.ok) {
            console.log(`[CrawlBudget] ANALYSIS_SAVED for ${url}: h1=${parsed.h1_count}, title=${parsed.title?.length || 0} chars, schema=${parsed.schema_types || 'none'}`);
          }
        } catch (err: any) {
          console.error('ANALYSIS_RUNTIME_ERR', { url, error: (err?.message||String(err)).slice(0,300) });
        }
      }
      
      console.log(`[CrawlBudget] Saved page: ${url} (${res.words} words, status ${res.statusCode})`);
      pagesDone++;
      
      // Extract links if we have content and budget
      if (depth < parseInt(env.CRAWL_MAX_DEPTH || '3') && res.html && res.html.length > 0 && toEnqueue.length < ENQ_CAP) {
        const links = extractLinks(res.html);
        
        for (const href of links) {
          if (toEnqueue.length >= ENQ_CAP) break;
          
          if (!isInternal(href, origin)) continue;
          
          const normalizedUrl = normalizeUrl(href, origin);
          if (!normalizedUrl || !isValidPageUrl(normalizedUrl)) continue;
          
          // Check if URL already exists in frontier
          const existing = await env.DB.prepare(`
            SELECT 1 FROM audit_frontier WHERE audit_id = ? AND url = ?
          `).bind(auditId, normalizedUrl).first();
          
          if (!existing) {
            // Calculate priority
            const currentPath = new URL(url).pathname;
            const linkPath = new URL(normalizedUrl).pathname;
            
            let priority = 1.0;
            if (normalizedUrl === origin) {
              priority = 0.0; // Home page
            } else if (linkPath.startsWith(currentPath) || linkPath === currentPath) {
              priority = 0.5; // Same path
            }
            
            toEnqueue.push({ url: normalizedUrl, depth: depth + 1, priority });
          }
        }
      }
      
    } catch (error) {
      console.error(`[CrawlBudget] Error processing ${url}:`, error);
    }
  }
  
  // Single DB write for all new links (or none)
  let inserted = 0;
  if (toEnqueue.length > 0 && !budget.over(1500)) {
    inserted = await enqueueBatch(env.DB, auditId, toEnqueue);
  }
  
  // Get updated frontier counts
  const counts = await frontierCounts(env.DB, auditId);
  
  console.log(`FRONTIER_COUNTS { pending: ${counts.pending}, visiting: ${counts.visiting}, done: ${counts.done} }`);
  
  console.log(`CRAWL_TICK { audit: ${auditId}, pages_fetched: ${pagesDone}, links_collected: ${toEnqueue.length}, links_enqueued: ${inserted}, time_left_ms: ${budget.left()} }`);
  
  // Check if we should continue
  const shouldContinue = counts.pending > 0 && !budget.over(500);
  
  if (shouldContinue) {
    console.log(`[CrawlBudget] Scheduling next tick (${counts.pending} pending URLs)`);
    ctx.waitUntil(runCrawlTickWithBudget(env, auditId, ctx));
  }
  
  return { processed: pagesDone, enqueued: inserted, shouldContinue };
}

// Import the existing helper functions
async function renderPage(env: any, url: string) {
  // This would import from the existing crawl-bfs.ts
  const { renderPage } = await import('./crawl-bfs');
  return renderPage(env, url);
}

async function savePage(env: any, auditId: string, url: string, res: any) {
  // This would import from the existing crawl-bfs.ts
  const { savePage } = await import('./crawl-bfs');
  return savePage(env, auditId, url, res);
}

function extractLinks(html: string): string[] {
  // This would import from the existing crawl-bfs.ts
  const { extractLinks } = require('./crawl-bfs');
  return extractLinks(html);
}

function isInternal(href: string, origin: string): boolean {
  // This would import from the existing crawl-bfs.ts
  const { isInternal } = require('./crawl-bfs');
  return isInternal(href, origin);
}

function normalizeUrl(url: string, origin: string): string | null {
  // This would import from the existing crawl-bfs.ts
  const { normalizeUrl } = require('./crawl-bfs');
  return normalizeUrl(url, origin);
}

function isValidPageUrl(url: string): boolean {
  // This would import from the existing crawl-bfs.ts
  const { isValidPageUrl } = require('./crawl-bfs');
  return isValidPageUrl(url);
}
