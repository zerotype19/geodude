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

      // Save page to database
      await env.DB.prepare(`
        INSERT INTO audit_pages(audit_id, url, status_code, title, h1, has_h1, jsonld_count, faq_present, word_count, rendered_words, snippet, load_time_ms, error, fetched_at)
        VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'))
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
          fetched_at=excluded.fetched_at
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
        0, // load_time_ms - we don't track this in renderPage
        null // error
      ).run();

      await markDone(env, auditId, url, 'done');
      processed++;
      
      console.log(`[CrawlBFS] Saved page: ${url} (${res.words} words, status ${res.statusCode})`);

      // Analyze page for schema/H1/E-E-A-T (after saving page data)
      if (res.html && res.html.length > 100) {
        try {
          const { analyzeHtml } = await import('../../analysis/extract');
          const analysis = analyzeHtml(res.html);
          
          await env.DB.prepare(`
            INSERT INTO audit_page_analysis
              (audit_id, url, h1, h1_count, title, meta_description, canonical, robots_meta,
               schema_types, author, date_published, date_modified, images, headings_h2, headings_h3,
               outbound_links, word_count, eeat_flags, analyzed_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, datetime('now'))
            ON CONFLICT(audit_id, url) DO UPDATE SET
              h1=?3, h1_count=?4, title=?5, meta_description=?6, canonical=?7, robots_meta=?8,
              schema_types=?9, author=?10, date_published=?11, date_modified=?12, images=?13,
              headings_h2=?14, headings_h3=?15, outbound_links=?16, word_count=?17, eeat_flags=?18,
              analyzed_at=datetime('now')
          `).bind(
            auditId, url,
            analysis.h1, analysis.h1Count, analysis.title, analysis.metaDescription, 
            analysis.canonical, analysis.robotsMeta, analysis.schema_types, 
            analysis.author, analysis.date_published, analysis.date_modified, 
            analysis.images, analysis.headings_h2, analysis.headings_h3, 
            analysis.outbound_links, res.words || null, analysis.eeat_flags
          ).run();
          
          console.log(`[CrawlBFS] Analyzed page: ${url} (schema: ${analysis.schema_types || 'none'}, E-E-A-T: ${analysis.eeat_flags || 'none'})`);
        } catch (error) {
          console.error(`[CrawlBFS] Error analyzing page ${url}:`, error);
          // Continue crawling even if analysis fails
        }
      }

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
          const newLinks: string[] = [];
          const maxEnqueuePerPage = parseInt(env.CRAWL_MAX_ENQUEUE_PER_PAGE || '100');
          
          for (const href of links) {
            if (newLinks.length >= maxEnqueuePerPage) break; // Safety limit
            
            if (!isInternal(href, origin)) continue;
            
            const normalizedUrl = normalizeUrl(href, origin);
            if (!normalizedUrl || !isValidPageUrl(normalizedUrl)) continue;
            
            // Check if we already have this URL in frontier or pages
            const existing = await env.DB.prepare(`
              SELECT 1 FROM audit_frontier WHERE audit_id=?1 AND url=?2
              UNION
              SELECT 1 FROM audit_pages WHERE audit_id=?1 AND url=?2
            `).bind(auditId, normalizedUrl).first();
            
            if (!existing) {
              newLinks.push(normalizedUrl);
            }
          }
          
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
      
      processed++; // Count failed pages too
    }
  }

  const timeMs = Date.now() - started;
  
  // Check if we should continue
  const remaining = await remainingCount(env, auditId);
  const totalPages = await env.DB.prepare(`SELECT COUNT(*) as c FROM audit_pages WHERE audit_id=?1`)
    .bind(auditId).first<any>();
  const currentTotal = Number(totalPages?.c ?? 0);
  
  const shouldContinue = currentTotal < opts.maxPages && remaining > 0;
  
  console.log(`[CrawlBFS] Batch complete: processed ${processed}, total pages ${currentTotal}/${opts.maxPages}, remaining ${remaining}, continue: ${shouldContinue}`);
  
  return { processed, timeMs, shouldContinue };
}
