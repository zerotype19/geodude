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
import { calculateScores } from './score';
import { extractJSONLD, extractTitle, extractH1, detectFAQ, countWords, extractOrganization } from './html';

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
  const maxPages = parseInt(env.AUDIT_MAX_PAGES || '100');

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

  // Phase 5: Page Crawling
  const crawlResult = await runPhase(auditId, 'crawl', env, async (ctx) => {
    console.log(`[AuditPhases] Crawling pages for ${domain}`);
    
    // Get URLs to crawl from sitemap if available, otherwise just homepage
    let urlsToCrawl = [baseUrl];
    
    if (sitemapResult.success && sitemapResult.data?.urls && sitemapResult.data.urls.length > 0) {
      console.log(`[AuditPhases] Found ${sitemapResult.data.urls.length} URLs in sitemap`);
      urlsToCrawl = sitemapResult.data.urls.slice(0, maxPages);
    } else {
      console.log(`[AuditPhases] No sitemap URLs found, crawling homepage only`);
    }
    const crawledPages: PageData[] = [];
    const crawlIssues: AuditIssue[] = [];

    for (let i = 0; i < Math.min(urlsToCrawl.length, maxPages); i++) {
      const pageUrl = urlsToCrawl[i];
      
      // Add delay between requests
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      try {
        const pageStart = Date.now();
        
        // Use render semaphore to limit concurrent renders
        const rendered = await withRenderSemaphore(async () => {
          return await withCircuitBreaker('browser', env, async () => {
            return await renderPage(env, pageUrl, { userAgent: env.USER_AGENT });
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

          crawledPages.push({
            url: pageUrl,
            status_code: rendered.statusCode || 200,
            title,
            h1,
            has_h1: hasH1,
            jsonld_count: jsonLdCount,
            faq_present: faqOnPage,
            word_count: wordCount,
            rendered_words: wordCount,
            snippet,
            load_time_ms: pageTime,
            error: null,
          });

          // Check for issues
          if (!title) {
            crawlIssues.push({
              page_url: pageUrl,
              issue_type: 'missing_title',
              severity: 'critical',
              message: 'Page missing title tag',
            });
          }

          if (!hasH1) {
            crawlIssues.push({
              page_url: pageUrl,
              issue_type: 'missing_h1',
              severity: 'warning',
              message: 'Page missing H1 heading',
            });
          }

          if (jsonLdCount === 0) {
            crawlIssues.push({
              page_url: pageUrl,
              issue_type: 'missing_structured_data',
              severity: 'info',
              message: 'Page missing JSON-LD structured data',
            });
          }

          if (wordCount < 120) {
            crawlIssues.push({
              page_url: pageUrl,
              issue_type: 'thin_content',
              severity: 'warning',
              message: `Thin content: only ${wordCount} words`,
              details: JSON.stringify({ words: wordCount, snippet }),
            });
          }
        } else {
          crawledPages.push({
            url: pageUrl,
            status_code: rendered.status || 0,
            title: null,
            h1: null,
            has_h1: false,
            jsonld_count: 0,
            faq_present: false,
            word_count: 0,
            rendered_words: 0,
            snippet: null,
            load_time_ms: pageTime,
            error: `HTTP ${rendered.status}`,
          });

          crawlIssues.push({
            page_url: pageUrl,
            issue_type: 'page_error',
            severity: 'critical',
            message: `Page returned HTTP ${rendered.status}`,
          });
        }
      } catch (error) {
        crawledPages.push({
          url: pageUrl,
          status_code: 0,
          title: null,
          h1: null,
          has_h1: false,
          jsonld_count: 0,
          faq_present: false,
          word_count: 0,
          rendered_words: 0,
          snippet: null,
          load_time_ms: 0,
          error: error instanceof Error ? error.message : String(error),
        });

        crawlIssues.push({
          page_url: pageUrl,
          issue_type: 'page_unreachable',
          severity: 'critical',
          message: 'Failed to fetch page',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      pages: crawledPages,
      issues: crawlIssues,
      urlsTotal: urlsToCrawl.length
    };
  });

  if (!crawlResult.success) {
    throw new Error(`Crawl phase failed: ${crawlResult.error?.message}`);
  }
  
  pages = crawlResult.data.pages;
  issues = crawlResult.data.issues;

  // Phase 6: Brave AI Citations
  const citationsResult = await runPhase(auditId, 'citations', env, async (ctx) => {
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
    console.log(`[AuditPhases] Calculating scores for ${domain}`);
    
    const structuredData = {
      siteFaqSchemaPresent: pages.some(p => p.faq_present),
      siteFaqPagePresent: pages.some(p => {
        const url = p.url.toLowerCase();
        const title = (p.title || '').toLowerCase();
        return url.includes('/faq') || title.includes('faq');
      }),
      schemaTypes: [],
    };

    const scores = calculateScores(pages, issues, crawlabilityData, structuredData);
    return { scores, structuredData };
  });

  if (!synthResult.success) {
    throw new Error(`Synthesis phase failed: ${synthResult.error?.message}`);
  }

  // Phase 8: Finalize (Save to database)
  const finalizeResult = await runPhase(auditId, 'finalize', env, async (ctx) => {
    console.log(`[AuditPhases] Finalizing audit ${auditId}`);
    
    const scores = synthResult.data.scores;
    
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
      pages.length ?? 0,
      crawlResult.data.urlsTotal ?? 0,
      issues.length ?? 0,
      aiAccess ? JSON.stringify(aiAccess) : null,
      null, // aiFlags
      braveQueryLogs.length > 0 ? JSON.stringify({ queries: braveQueryLogs }) : null,
      auditId
    ).run();

    // Save pages
    for (const page of pages) {
      await env.DB.prepare(
        `INSERT INTO audit_pages 
         (audit_id, url, status_code, title, h1, has_h1, jsonld_count, faq_present, word_count, rendered_words, snippet, load_time_ms, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        auditId,
        page.url ?? '',
        page.status_code ?? 0,
        page.title ?? null,
        page.h1 ?? null,
        page.has_h1 ? 1 : 0,
        page.jsonld_count ?? 0,
        page.faq_present ? 1 : 0,
        page.word_count ?? 0,
        page.rendered_words ?? null,
        page.snippet ?? null,
        page.load_time_ms ?? 0,
        page.error ?? null
      ).run();
    }

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
