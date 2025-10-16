/**
 * Phase-Based Audit Runner
 * Replaces the old runAudit with structured phases and timeouts
 */

import { runPhase, runPhasesSequentially, PHASE_CONFIGS } from './phase-runner';
import { safeFetch } from './safe-fetch';
import { withConnectorSemaphore, withRenderSemaphore } from './semaphore';
import { withCircuitBreaker } from './circuit-breaker';
import { checkRobotsTxt, checkSitemap, probeAiAccess } from './crawl';
import { renderPage } from './render';
import { runSmartBraveQueries } from './brave/ai';
import { calculateScores, calculateScoresFromAnalysis } from './score';
import { extractJSONLD, extractTitle, extractH1, detectFAQ, countWords, extractOrganization } from './html';

/**
 * Crawl a batch of pages with immediate persistence and time limits
 */
async function crawlBatch(env: any, auditId: string, urls: string[], opts: {
  deadlineMs: number;
  batchSize: number;
}): Promise<{ processed: number; timeMs: number }> {
  const started = Date.now();
  let processed = 0;

  for (const url of urls) {
    if (processed >= opts.batchSize) break;
    if (Date.now() - started > opts.deadlineMs) break;

    try {
      // Add delay between requests
      if (processed > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const pageStart = Date.now();
      
      // Use render semaphore to limit concurrent renders
      const rendered = await withRenderSemaphore(async () => {
        return await withCircuitBreaker('browser', env, async () => {
          return await renderPage(env, url, { userAgent: env.USER_AGENT });
        });
      });
      
      const pageTime = Date.now() - pageStart;
      
      if (rendered.statusCode === 200 || rendered.statusCode === 0) {
        const html = rendered.html;
        const title = extractTitle(html);
        const h1 = extractH1(html);
        const wordCount = rendered.words;
        const snippet = rendered.snippet;
        const hasH1 = rendered.hasH1;
        const jsonLdCount = rendered.jsonLdCount;
        const faqOnPage = rendered.faqOnPage;

        // IMMEDIATE UPSERT - do not wait until the end of the phase
        await env.DB.prepare(`
          INSERT INTO audit_pages(audit_id, url, status_code, title, h1, has_h1, jsonld_count, faq_present, word_count, rendered_words, snippet, load_time_ms, error)
          VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
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
            error=excluded.error
        `).bind(
          auditId,
          url,
          rendered.statusCode || 200,
          title,
          h1,
          hasH1 ? 1 : 0,
          jsonLdCount,
          faqOnPage ? 1 : 0,
          wordCount,
          wordCount,
          snippet,
          pageTime,
          null
        ).run();
        
        console.log(`[AuditPhases] Saved page to database: ${url} (${wordCount} words)`);
      } else {
        // Save failed page with error
        await env.DB.prepare(`
          INSERT INTO audit_pages(audit_id, url, status_code, title, h1, has_h1, jsonld_count, faq_present, word_count, rendered_words, snippet, load_time_ms, error)
          VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
          ON CONFLICT(audit_id, url) DO UPDATE SET
            status_code=excluded.status_code,
            error=excluded.error
        `).bind(
          auditId,
          url,
          rendered.statusCode || 0,
          null,
          null,
          0,
          0,
          0,
          0,
          null,
          null,
          pageTime,
          `HTTP ${rendered.statusCode}`
        ).run();
      }

      processed++;
    } catch (error) {
      console.error(`[AuditPhases] Failed to crawl page ${url}:`, error);
      
      // Save failed page with error
      await env.DB.prepare(`
        INSERT INTO audit_pages(audit_id, url, status_code, title, h1, has_h1, jsonld_count, faq_present, word_count, rendered_words, snippet, load_time_ms, error)
        VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
        ON CONFLICT(audit_id, url) DO UPDATE SET
          error=excluded.error
      `).bind(
        auditId,
        url,
        0,
        null,
        null,
        0,
        0,
        0,
        0,
        null,
        null,
        0,
        error instanceof Error ? error.message : String(error)
      ).run();
      
      processed++; // Count failed pages too
    }
  }

  return { processed, timeMs: Date.now() - started };
}

/**
 * Extract internal links from HTML content
 */
function extractInternalLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const baseHost = new URL(baseUrl).hostname;
  
  // Simple regex to find href attributes
  const hrefMatches = html.match(/href=["']([^"']+)["']/gi);
  
  if (hrefMatches) {
    for (const match of hrefMatches) {
      const href = match.replace(/href=["']([^"']+)["']/i, '$1');
      
      // Skip external links, fragments, and non-http links
      if (href.startsWith('http')) {
        try {
          const url = new URL(href);
          if (url.hostname === baseHost) {
            links.push(href);
          }
        } catch {
          // Invalid URL, skip
        }
      } else if (href.startsWith('/') && !href.startsWith('//')) {
        // Internal absolute path
        links.push(`${baseUrl}${href}`);
      }
    }
  }
  
  // Remove duplicates and limit to reasonable number for faster execution
  return [...new Set(links)].slice(0, 5);
}

interface Env {
  DB: D1Database;
  USER_AGENT: string;
  AUDIT_MAX_PAGES: string;
  BRAVE_SEARCH_AI?: string;
  BRAVE_AI_MAX_QUERIES?: string;
  BRAVE_AI_HARD_CAP?: string;
  BRAVE_TIMEOUT_MS?: string;
  BRAVE_CONCURRENCY?: string;
  BRAVE_AI_ENABLE_COMPARE?: string;
}

interface AuditIssue {
  page_url: string | null;
  issue_type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string;
}

interface PageData {
  url: string;
  status_code: number;
  title: string | null;
  h1: string | null;
  has_h1: boolean;
  jsonld_count: number;
  faq_present: boolean;
  word_count: number;
  rendered_words: number;
  snippet: string | null;
  load_time_ms: number;
  error: string | null;
}

/**
 * Run audit using structured phases with timeouts and heartbeats
 */
export async function runAuditPhases(auditId: string, env: Env): Promise<string> {
  console.log(`[AuditPhases] Starting phase-based audit ${auditId}`);

  // Get property details
  const property = await env.DB.prepare(
    'SELECT domain FROM properties WHERE id = (SELECT property_id FROM audits WHERE id = ?)'
  ).bind(auditId).first<{ domain: string }>();

  if (!property) {
    throw new Error('Property not found for audit');
  }

  const domain = property.domain;
  const baseUrl = `https://${domain}`;
  const maxPages = parseInt(env.CRAWL_MAX_PAGES || '50'); // Use CRAWL_MAX_PAGES for consistency

  let crawlabilityData: any;
  let aiAccess: any;
  let pages: PageData[] = [];
  let issues: AuditIssue[] = [];
  let braveQueryLogs: any[] = [];

  // Phase 1: Discovery
  const discoveryResult = await runPhase(auditId, 'discovery', env, async (ctx) => {
    console.log(`[AuditPhases] Discovery phase for ${domain}`);
    return {
      domain,
      baseUrl,
      maxPages
    };
  });

  if (!discoveryResult.success) {
    throw new Error(`Discovery phase failed: ${discoveryResult.error?.message}`);
  }

  // Phase 2: Robots.txt
  const robotsResult = await runPhase(auditId, 'robots', env, async (ctx) => {
    console.log(`[AuditPhases] Checking robots.txt for ${domain}`);
    return await checkRobotsTxt(baseUrl);
  });

  if (!robotsResult.success) {
    throw new Error(`Robots phase failed: ${robotsResult.error?.message}`);
  }
  crawlabilityData = robotsResult.data;

  // Phase 3: Sitemap
  const sitemapResult = await runPhase(auditId, 'sitemap', env, async (ctx) => {
    console.log(`[AuditPhases] Checking sitemap for ${domain}`);
    return await checkSitemap(baseUrl, crawlabilityData.sitemapUrls);
  });

  if (!sitemapResult.success) {
    console.warn(`[AuditPhases] Sitemap phase failed, continuing: ${sitemapResult.error?.message}`);
  }

  // Phase 4: AI Access Probes
  const probesResult = await runPhase(auditId, 'probes', env, async (ctx) => {
    console.log(`[AuditPhases] Probing AI access for ${domain}`);
    return await withConnectorSemaphore(async () => {
      return await withCircuitBreaker('ai-probes', env, async () => {
        return await probeAiAccess(baseUrl);
      });
    });
  });

  if (!probesResult.success) {
    console.warn(`[AuditPhases] AI probes failed, continuing: ${probesResult.error?.message}`);
    aiAccess = { results: [], baselineStatus: 0 };
  } else {
    aiAccess = probesResult.data;
  }

  // Phase 5: Page Crawling with BFS Frontier
  const crawlResult = await runPhase(auditId, 'crawl', env, async (ctx) => {
    console.log(`[AuditPhases] Starting BFS crawl for ${domain}`);
    
    // Import BFS functions
    const { seedFrontier, getHomeNavLinks, loadSitemapUrls } = await import('./audit/seed');
    const { crawlBatchBfs } = await import('./audit/crawl-bfs');
    
    // Check if frontier is already seeded
    const phaseState = await getPhaseState(env, auditId, 'crawl');
    
    if (!phaseState?.seeded) {
      console.log(`[AuditPhases] Seeding crawl frontier for ${domain}`);
      
      // Get navigation links from homepage
      const { navLinks } = await getHomeNavLinks(env, baseUrl);
      
      // Get sitemap URLs if available
      const sitemapUrls = sitemapResult.success && sitemapResult.data?.urls 
        ? sitemapResult.data.urls 
        : await loadSitemapUrls(env, baseUrl, { cap: parseInt(env.SITEMAP_URL_CAP || '500') });
      
      // Seed the frontier
      const seedResult = await seedFrontier(env, auditId, baseUrl, {
        navLinks,
        sitemapUrls,
        maxSitemap: parseInt(env.SITEMAP_URL_CAP || '500')
      });
      
      console.log(`[AuditPhases] Frontier seeded: ${seedResult.total} URLs (home: ${seedResult.homepage}, nav: ${seedResult.navLinks}, sitemap: ${seedResult.sitemapUrls})`);
      
      // Mark as seeded
      await setPhaseState(env, auditId, 'crawl', { seeded: true });
    }
    
    // Run BFS crawl batch
    const batchSize = parseInt(env.PAGE_BATCH_SIZE || '2');
    const deadlineMs = parseInt(env.CRAWL_TIMEBOX_MS || '20000');
    const maxDepth = parseInt(env.CRAWL_MAX_DEPTH || '3');
    // Use the same maxPages variable from the function scope for consistency
    
    console.log(`[AuditPhases] Running BFS batch: batch size ${batchSize}, deadline ${deadlineMs}ms, max depth ${maxDepth}, max pages ${maxPages}`);
    
    const batch = await crawlBatchBfs(env, auditId, baseUrl, {
      deadlineMs,
      batchSize,
      maxDepth,
      maxPages
    });
    
    console.log(`[AuditPhases] BFS batch completed: processed ${batch.processed} pages in ${batch.timeMs}ms, should continue: ${batch.shouldContinue}`);
    
    // PR-Fix-7: Atomic gate for leaving crawl - prevents race conditions
    const { tryAdvanceFromCrawl } = await import('./audit/crawl-exit');
    const advanced = await tryAdvanceFromCrawl(env, auditId, maxPages);

    if (!advanced) {
      // We still have pending work or haven't hit the goal → continue crawling
      console.log(`[AuditPhases] More work to do, yielding to cron pump`);
      // No more self-calling - rely on cron pump
      return { pages: [], issues: [], urlsTotal: 0, urlsProcessed: batch.processed };
    }
    
    console.log(`[AuditPhases] Successfully advanced from crawl to citations phase`);
    
    // Get the pages we just crawled
    const savedPages = await env.DB.prepare(
      `SELECT * FROM audit_pages WHERE audit_id = ? ORDER BY fetched_at DESC LIMIT ?`
    ).bind(auditId, maxPages).all();

    return {
      pages: savedPages.results as PageData[],
      issues: [], // Issues will be generated during analysis phase
      urlsTotal: maxPages,
      urlsProcessed: batch.processed
    };
  });

  if (!crawlResult.success) {
    throw new Error(`Crawl phase failed: ${crawlResult.error?.message}`);
  }
  
  pages = crawlResult.data.pages;
  issues = crawlResult.data.issues;

  // Phase 6: Brave AI Citations
  const citationsResult = await runPhase(auditId, 'citations', env, async (ctx) => {
    // Bounce-back guard to ensure crawl is complete
    const { ensureCrawlCompleteOrRewind } = await import('./audit/bounce-back');
    if (!(await ensureCrawlCompleteOrRewind(env, auditId, parseInt(env.CRAWL_MAX_PAGES || '50')))) {
      return { logs: [] }; // Don't run citations yet
    }

    console.log(`[AuditPhases] Running Brave AI queries for ${domain}`);
    
    if (!env.BRAVE_SEARCH_AI) {
      console.log('[AuditPhases] Brave AI disabled, skipping citations');
      return { logs: [] };
    }

    return await withConnectorSemaphore(async () => {
      return await withCircuitBreaker('brave', env, async () => {
        const maxQueries = Number(env.BRAVE_AI_MAX_QUERIES ?? 50);
        const hardCap = Number(env.BRAVE_AI_HARD_CAP ?? 100);
        const strategy = 'smart' as const;
        const enableCompare = env.BRAVE_AI_ENABLE_COMPARE === 'true';
        const brand = domain.replace(/^www\./, '').split('.')[0];
        
        const minimalPages = pages.map(p => ({
          path: p.url.replace(baseUrl, '').replace(/^https?:\/\/[^/]+/, '') || '/',
          h1: p.h1 || null,
          words: p.word_count || 0
        }));
        
        const result = await runSmartBraveQueries(env.BRAVE_SEARCH_AI, {
          domain,
          brand,
          pages: minimalPages,
          strategy,
          maxQueries,
          hardCap,
          enableCompare,
          timeoutMs: Number(env.BRAVE_TIMEOUT_MS ?? 7000),
          concurrency: Number(env.BRAVE_CONCURRENCY ?? 2),
          enableRetry: true,
        });

        return result;
      });
    });
  });

  if (citationsResult.success) {
    braveQueryLogs = citationsResult.data.logs || [];
  } else {
    console.warn(`[AuditPhases] Citations phase failed, continuing: ${citationsResult.error?.message}`);
  }

  // Phase 7: Synthesis (Calculate scores)
  const synthResult = await runPhase(auditId, 'synth', env, async (ctx) => {
    // Bounce-back guard to ensure crawl is complete
    const { ensureCrawlCompleteOrRewind } = await import('./audit/bounce-back');
    if (!(await ensureCrawlCompleteOrRewind(env, auditId, parseInt(env.CRAWL_MAX_PAGES || '50')))) {
      return { scores: {} }; // Don't run synth yet
    }

    console.log(`[AuditPhases] Running page analysis and score calculation for ${domain}`);
    
    // First, run page analysis to populate audit_page_analysis table
    const { runSynthTick } = await import('./audit/synth');
    const analysisComplete = await runSynthTick(env, auditId);
    
    if (!analysisComplete) {
      console.log(`[AuditPhases] Page analysis not complete, more work needed`);
      return { scores: {} }; // More work to do
    }
    
    console.log(`[AuditPhases] Page analysis complete, calculating scores`);
    
    // Get analysis data from audit_page_analysis table
    const analysisData = await env.DB.prepare(`
      SELECT url, h1, h1_count, title, meta_description, canonical, robots_meta,
             schema_types, author, date_published, date_modified, images,
             headings_h2, headings_h3, outbound_links, word_count, eeat_flags
      FROM audit_page_analysis 
      WHERE audit_id = ?
    `).bind(auditId).all();
    
    console.log(`[AuditPhases] Found ${analysisData.results?.length || 0} analyzed pages`);
    
    const structuredData = {
      siteFaqSchemaPresent: analysisData.results?.some((p: any) => p.schema_types?.includes('FAQPage')) || false,
      siteFaqPagePresent: analysisData.results?.some((p: any) => {
        const url = p.url.toLowerCase();
        const title = (p.title || '').toLowerCase();
        return url.includes('/faq') || title.includes('faq');
      }) || false,
      schemaTypes: analysisData.results?.map((p: any) => p.schema_types).filter(Boolean) || [],
    };

    // Use analysis data for score calculation
    const scores = calculateScoresFromAnalysis(analysisData.results || [], issues, crawlabilityData, structuredData);
    
    // Convert raw points to percentages for storage
    const scoresWithPercentages = {
      ...scores,
      overall: scores.overall, // Already a percentage
      crawlability: Math.round((scores.crawlability / 42) * 100), // Convert to percentage
      structured: Math.round((scores.structured / 30) * 100), // Convert to percentage
      answerability: Math.round((scores.answerability / 20) * 100), // Convert to percentage
      trust: Math.round((scores.trust / 10) * 100), // Convert to percentage
    };
    
    return { scores: scoresWithPercentages, structuredData };
  });

  if (!synthResult.success) {
    throw new Error(`Synthesis phase failed: ${synthResult.error?.message}`);
  }

  // Phase 8: Finalize (Save to database)
  const finalizeResult = await runPhase(auditId, 'finalize', env, async (ctx) => {
    // Bounce-back guard to ensure crawl is complete
    const { ensureCrawlCompleteOrRewind } = await import('./audit/bounce-back');
    if (!(await ensureCrawlCompleteOrRewind(env, auditId, parseInt(env.CRAWL_MAX_PAGES || '50')))) {
      return { success: true }; // Don't run finalize yet
    }

    console.log(`[AuditPhases] Finalizing audit ${auditId}`);
    
    const scores = synthResult.data.scores;
    
    // Get actual counts from database
    const pageCount = await env.DB.prepare(`SELECT COUNT(*) as count FROM audit_pages WHERE audit_id = ?`).bind(auditId).first();
    const issueCount = await env.DB.prepare(`SELECT COUNT(*) as count FROM audit_issues WHERE audit_id = ?`).bind(auditId).first();
    
    const actualPagesTotal = pageCount?.count || 0;
    const actualIssuesCount = issueCount?.count || 0;

    // Update audit record
    await env.DB.prepare(
      `UPDATE audits 
       SET status = 'completed',
           score_overall = ?,
           score_crawlability = ?,
           score_structured = ?,
           score_answerability = ?,
           score_trust = ?,
           pages_crawled = ?,
           pages_total = ?,
           issues_count = ?,
           ai_access_json = ?,
           ai_flags_json = ?,
           brave_ai_json = ?,
           completed_at = datetime('now')
       WHERE id = ?`
    ).bind(
      scores.overall ?? 0,
      scores.crawlability ?? 0,
      scores.structured ?? 0,
      scores.answerability ?? 0,
      scores.trust ?? 0,
      actualPagesTotal,
      actualPagesTotal,
      actualIssuesCount,
      aiAccess ? JSON.stringify(aiAccess) : null,
      null, // aiFlags
      braveQueryLogs.length > 0 ? JSON.stringify({ queries: braveQueryLogs }) : null,
      auditId
    ).run();

    // Pages are now saved immediately during crawling to prevent data loss
    // No need to save them again here

    // Save issues
    for (const issue of issues) {
      await env.DB.prepare(
        `INSERT INTO audit_issues 
         (audit_id, page_url, issue_type, severity, message, details)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        auditId,
        issue.page_url ?? null,
        issue.issue_type ?? '',
        issue.severity ?? 'info',
        issue.message ?? '',
        issue.details ?? null
      ).run();
    }

    return { success: true };
  });

  if (!finalizeResult.success) {
    throw new Error(`Finalize phase failed: ${finalizeResult.error?.message}`);
  }

  console.log(`[AuditPhases] Audit ${auditId} completed successfully`);
  return auditId;
}

/**
 * Get phase state from database
 */
async function getPhaseState(env: any, auditId: string, phase: string): Promise<any> {
  try {
    const row = await env.DB.prepare(
      `SELECT phase_state FROM audits WHERE id = ?`
    ).bind(auditId).first<{ phase_state: string }>();
    
    if (!row?.phase_state) return null;
    
    return JSON.parse(row.phase_state);
  } catch (error) {
    console.error(`[AuditPhases] Error getting phase state:`, error);
    return null;
  }
}

/**
 * Set phase state in database
 */
async function setPhaseState(env: any, auditId: string, phase: string, state: any): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE audits SET phase_state = ? WHERE id = ?`
    ).bind(JSON.stringify(state), auditId).run();
  } catch (error) {
    console.error(`[AuditPhases] Error setting phase state:`, error);
  }
}

// Removed selfContinue function - no more HTTP self-calling
