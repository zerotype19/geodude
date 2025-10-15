/**
 * BFS crawl implementation using persistent frontier
 * Processes pages in breadth-first order until MAX_PAGES is reached
 */

import { dequeueBatch, enqueueUrl, markDone, remainingCount } from './frontier';
import { renderPage } from '../render';
import { normalizeUrl, isInternal, extractLinks, isValidPageUrl } from './url-utils';

export async function crawlBatchBfs(
  env: any, 
  auditId: string, 
  origin: string, 
  opts: {
    deadlineMs: number;
    batchSize: number;
    maxDepth: number;
    maxPages: number;
  }
): Promise<{ processed: number; timeMs: number; shouldContinue: boolean }> {
  const started = Date.now();
  let processed = 0;

  // Short-circuit if we already hit max pages
  const row = await env.DB.prepare(`SELECT COUNT(*) as c FROM audit_pages WHERE audit_id=?1`)
    .bind(auditId).first<any>();
  const already = Number(row?.c ?? 0);
  if (already >= opts.maxPages) {
    console.log(`[CrawlBFS] Already at max pages (${already}/${opts.maxPages}), skipping`);
    return { processed: 0, timeMs: 0, shouldContinue: false };
  }

  const batch = await dequeueBatch(env, auditId, opts.batchSize);
  console.log(`[CrawlBFS] Processing batch of ${batch.length} URLs`);

  for (const item of batch) {
    if (Date.now() - started > opts.deadlineMs) {
      console.log(`[CrawlBFS] Timeout reached, stopping batch`);
      break;
    }

    const { url, depth } = item;
    console.log(`[CrawlBFS] Crawling ${url} (depth ${depth})`);

    try {
      const res = await renderPage(env, url, {
        userAgent: env.USER_AGENT
      });

      // Save page to database with HTML and render telemetry
      await env.DB.prepare(`
        INSERT INTO audit_pages(audit_id, url, status_code, title, h1, has_h1, jsonld_count, faq_present, word_count, rendered_words, snippet, load_time_ms, error, fetched_at, body_text, load_ms, content_type)
        VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'), ?14, ?15, ?16)
        ON CONFLICT(audit_id, url) DO UPDATE SET
          status_code=excluded.status_code,
          title=excluded.title,
          h1=excluded.h1,
          has_h1=excluded.has_h1,
          jsonld_count=excluded.jsonld_count,
          faq_present=excluded.faq_present,
          word_count=excluded.word_count,
          rendered_words=excluded.rendered_words,
          snippet=excluded.snippet,
          load_time_ms=excluded.load_time_ms,
          error=excluded.error,
          fetched_at=excluded.fetched_at,
          body_text=excluded.body_text,
          load_ms=excluded.load_ms,
          content_type=excluded.content_type
      `).bind(
        auditId,
        url,
        res.statusCode || 200,
        res.title || null,
        res.h1 || null,
        res.hasH1 ? 1 : 0,
        res.jsonLdCount || 0,
        res.faqOnPage ? 1 : 0,
        res.words || 0,
        res.words || 0,
        res.snippet || null,
        res.loadTimeMs || 0, // load_time_ms - now tracking this
        null, // error
        res.html || null, // body_text - store HTML for analysis
        res.loadTimeMs || 0, // load_ms (new column)
        res.contentType || null // content_type (new column)
      ).run();

      // Update the pages_crawled counter in the audits table
      await env.DB.prepare(`
        UPDATE audits 
        SET pages_crawled = (SELECT COUNT(*) FROM audit_pages WHERE audit_id = ?1)
        WHERE id = ?1
      `).bind(auditId).run();

      // Log page save success with render telemetry
      console.log('CRAWL_SAVE_OK', { 
        url, 
        status_code: res.statusCode, 
        load_ms: res.loadTimeMs,
        content_type: res.contentType,
        html_len: res.html?.length || 0 
      });

      // Run HTML analysis if we have HTML
      const isHtml = res.html && res.html.length > 0;
      if (isHtml) {
        console.log('ANALYZE_RUN', { url, html_len: res.html.length });
        try {
          const { analyzeHtml } = await import('../../analysis/html-analyzer');
          const { mapToDb } = await import('../../analysis/map');
          const { saveAnalysisRow } = await import('../../analysis/save-analysis');
          
          const parsed = analyzeHtml(res.html, url);       // must not throw; catch inside if needed
          const row = mapToDb(auditId, url, parsed);
          const r = await saveAnalysisRow(env, row);   // logs success/failure
          
          if (!r.ok) {
            console.warn(`[CrawlBFS] ANALYSIS_FAILED for ${url}:`, r.error);
          } else {
            console.log(`[CrawlBFS] ANALYSIS_SAVED for ${url}: h1=${parsed.h1_count}, title=${parsed.title?.length || 0} chars, schema=${parsed.schema_types || 'none'}`);
          }
        } catch (err: any) {
          console.error('ANALYSIS_RUNTIME_ERR', { url, error: (err?.message||String(err)).slice(0,300) });
        }
      } else {
        console.log('ANALYZE_SKIP_NON_HTML', { url });
      }

      await markDone(env, auditId, url, 'done');
      processed++;
      
      console.log(`[CrawlBFS] Saved page: ${url} (${res.words} words, status ${res.statusCode})`);

      // Analysis is now handled above in the new robust pipeline

      // Extract internal links (only if depth < maxDepth and we have content)
      if (depth < opts.maxDepth && res.html && res.html.length > 0) {
        try {
          // Check frontier size before extracting more links
          const frontierCount = await remainingCount(env, auditId);
          const maxFrontier = parseInt(env.CRAWL_MAX_URLS_IN_FRONTIER || '2000');
          if (frontierCount > maxFrontier) {
            console.log(`[CrawlBFS] Frontier size ${frontierCount} exceeds limit ${maxFrontier}, skipping link extraction`);
            continue;
          }

          const links = extractLinks(res.html);
          console.log(`[CrawlBFS] Extracted ${links.length} links from ${url}`);
          
          const newLinks: string[] = [];
          const maxEnqueuePerPage = parseInt(env.CRAWL_MAX_ENQUEUE_PER_PAGE || '100');
          
          let filteredCount = 0;
          let internalCount = 0;
          let normalizedCount = 0;
          let validCount = 0;
          let existingCount = 0;
          
          for (const href of links) {
            if (newLinks.length >= maxEnqueuePerPage) break; // Safety limit
            
            if (!isInternal(href, origin)) {
              filteredCount++;
              continue;
            }
            internalCount++;
            
            const normalizedUrl = normalizeUrl(href, origin);
            if (!normalizedUrl || !isValidPageUrl(normalizedUrl)) {
              normalizedCount++;
              continue;
            }
            validCount++;
            
            // Check if we already have this URL in frontier or pages
            const existing = await env.DB.prepare(`
              SELECT 1 FROM audit_frontier WHERE audit_id=?1 AND url=?2
              UNION
              SELECT 1 FROM audit_pages WHERE audit_id=?1 AND url=?2
            `).bind(auditId, normalizedUrl).first();
            
            if (existing) {
              existingCount++;
            } else {
              newLinks.push(normalizedUrl);
            }
          }
          
          console.log(`[CrawlBFS] Link filtering: ${links.length} total, ${filteredCount} filtered, ${internalCount} internal, ${normalizedCount} invalid, ${validCount} valid, ${existingCount} existing, ${newLinks.length} new`);
          
          // Enqueue new links with smarter prioritization
          for (const link of newLinks) {
            // Calculate priority based on path similarity
            const currentPath = new URL(url).pathname;
            const linkPath = new URL(link).pathname;
            
            let priority = 1.0; // Default for other internal links
            
            if (link === origin) {
              priority = 0.0; // Home page (highest priority)
            } else if (link.includes('/header/') || link.includes('/footer/') || link.includes('/nav/')) {
              priority = 0.1; // Navigation elements
            } else if (linkPath.startsWith(currentPath) || linkPath === currentPath) {
              priority = 0.5; // Same path or subpath
            } else if (link.includes('/sitemap') || link.includes('/map')) {
              priority = 0.8; // Sitemap-related pages
            }
            
            await enqueueUrl(env, auditId, link, depth + 1, priority, url);
          }
          
          if (newLinks.length > 0) {
            console.log(`[CrawlBFS] Discovered ${newLinks.length} new links from ${url} (frontier: ${frontierCount})`);
          }
        } catch (error) {
          console.error(`[CrawlBFS] Error extracting links from ${url}:`, error);
        }
      }

      // Check if we've reached max pages
      const countRow = await env.DB.prepare(`SELECT COUNT(*) as c FROM audit_pages WHERE audit_id=?1`)
        .bind(auditId).first<any>();
      const totalPages = Number(countRow?.c ?? 0);
      
      if (totalPages >= opts.maxPages) {
        console.log(`[CrawlBFS] Reached max pages (${totalPages}/${opts.maxPages}), stopping`);
        break;
      }

    } catch (error) {
      console.error(`[CrawlBFS] Failed to crawl ${url}:`, error);
      
      // Mark as skipped with error
      await markDone(env, auditId, url, 'skipped');
      
      // Still save a failed page record
      await env.DB.prepare(`
        INSERT INTO audit_pages(audit_id, url, status_code, title, h1, has_h1, jsonld_count, faq_present, word_count, rendered_words, snippet, load_time_ms, error, fetched_at)
        VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'))
        ON CONFLICT(audit_id, url) DO UPDATE SET
          error=excluded.error,
          fetched_at=excluded.fetched_at
      `).bind(
        auditId,
        url,
        0,
        null, null, 0, 0, 0, 0, 0, null, 0,
        error instanceof Error ? error.message : String(error)
      ).run();

      // Update the pages_crawled counter in the audits table for failed pages too
      await env.DB.prepare(`
        UPDATE audits 
        SET pages_crawled = (SELECT COUNT(*) FROM audit_pages WHERE audit_id = ?1)
        WHERE id = ?1
      `).bind(auditId).run();
      
      processed++; // Count failed pages too
    }
  }

  const timeMs = Date.now() - started;
  
  // Check if we should continue
  const remaining = await remainingCount(env, auditId);
  const totalPages = await env.DB.prepare(`SELECT COUNT(*) as c FROM audit_pages WHERE audit_id=?1`)
    .bind(auditId).first<any>();
  const currentTotal = Number(totalPages?.c ?? 0);
  
  // Get analysis count for observability
  const analyzedCount = await env.DB.prepare(`SELECT COUNT(*) as c FROM audit_page_analysis WHERE audit_id=?1`)
    .bind(auditId).first<any>();
  const analyzedTotal = Number(analyzedCount?.c ?? 0);
  
  // Get frontier status for observability
  const frontierStatus = await env.DB.prepare(`
    SELECT 
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status='visiting' THEN 1 ELSE 0 END) as visiting
    FROM audit_frontier WHERE audit_id=?1
  `).bind(auditId).first<any>();
  
  const shouldContinue = currentTotal < opts.maxPages && remaining > 0;
  
  // Tick-level observability
  console.log(`CRAWL_TICK {processed: ${processed}, pages: ${currentTotal}, analyzed_total: ${analyzedTotal}, pending: ${frontierStatus?.pending || 0}, visiting: ${frontierStatus?.visiting || 0}, ms: ${timeMs}}`);
  
  return { processed, timeMs, shouldContinue };
}
