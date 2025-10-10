/**
 * Audit Engine
 * Orchestrates website audits: robots.txt, sitemap, crawling, scoring
 */

import { extractJSONLD, extractTitle, extractH1, detectFAQ, countWords, extractOrganization } from './html';
import { calculateScores } from './score';
import { renderPage } from './render';
import { checkCrawlability, probeAiAccess } from './crawl';
import { runBraveAIQueries, buildSmartQueries, extractPathname, BraveQueryLog, PageData } from './brave/ai';

interface Env {
  DB: D1Database;
  USER_AGENT: string;
  AUDIT_MAX_PAGES: string;
  BRAVE_SEARCH?: string; // Brave Search API key (for regular search)
  BRAVE_SEARCH_AI?: string; // Brave AI API key (for AI Grounding & Summarizer)
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

// Helper: Normalize URL (strip tracking params, lowercase, canonical form)
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Remove tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', '_ga', 'mc_cid', 'mc_eid'
    ];
    
    for (const param of trackingParams) {
      urlObj.searchParams.delete(param);
    }
    
    // Lowercase hostname, preserve path case, remove fragment
    urlObj.hostname = urlObj.hostname.toLowerCase();
    urlObj.hash = '';
    
    // Sort remaining params for consistency
    urlObj.searchParams.sort();
    
    return urlObj.toString();
  } catch {
    return url;
  }
}

// Helper: Check if URL is non-HTML (binary/document)
function isNonHtmlUrl(url: string): boolean {
  const nonHtmlExtensions = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.rar', '.tar', '.gz', '.7z',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mp3', '.wav',
    '.xml', '.json', '.csv', '.txt'
  ];
  
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    return nonHtmlExtensions.some(ext => path.endsWith(ext));
  } catch {
    return false;
  }
}

// Helper: Fetch and parse sitemap (supports sitemap index)
async function fetchSitemapUrls(sitemapUrl: string, userAgent: string, maxUrls: number): Promise<string[]> {
  try {
    const response = await fetch(sitemapUrl, { headers: { 'User-Agent': userAgent } });
    if (!response.ok) return [];
    
    const text = await response.text();
    
    // Check if this is a sitemap index
    if (text.includes('<sitemapindex')) {
      console.log('Detected sitemap index, fetching child sitemaps...');
      const sitemapMatches = text.matchAll(/<loc>([^<]+)<\/loc>/g);
      const childSitemaps = Array.from(sitemapMatches, m => m[1]);
      
      let allUrls: string[] = [];
      for (const childUrl of childSitemaps.slice(0, 10)) { // Max 10 child sitemaps
        const childUrls = await fetchSitemapUrls(childUrl, userAgent, maxUrls - allUrls.length);
        allUrls.push(...childUrls);
        if (allUrls.length >= maxUrls) break;
      }
      return allUrls;
    }
    
    // Regular sitemap
    const urlMatches = text.matchAll(/<loc>([^<]+)<\/loc>/g);
    return Array.from(urlMatches, m => m[1]);
  } catch (error) {
    console.error(`Sitemap fetch failed: ${error}`);
    return [];
  }
}

// Helper: Apply include/exclude filters
function applyIncludeExclude(urls: string[], filters?: { include?: RegExp[]; exclude?: RegExp[] }): string[] {
  let list = urls;

  // Exclude first (removes unwanted paths)
  if (filters?.exclude && filters.exclude.length > 0) {
    list = list.filter(url => {
      try {
        const pathname = new URL(url).pathname;
        return !filters.exclude!.some(rx => rx.test(pathname));
      } catch {
        return true; // Keep if URL parsing fails
      }
    });
  }

  // Include (restrictive - only keep matching paths)
  if (filters?.include && filters.include.length > 0) {
    list = list.filter(url => {
      try {
        const pathname = new URL(url).pathname;
        return filters.include!.some(rx => rx.test(pathname));
      } catch {
        return false; // Drop if URL parsing fails
      }
    });
  }

  return list;
}

export async function runAudit(
  propertyId: string, 
  env: Env,
  options?: {
    maxPages?: number;
    filters?: {
      include?: RegExp[];
      exclude?: RegExp[];
    };
  }
): Promise<string> {
  const auditId = `aud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const maxPages = options?.maxPages ?? parseInt(env.AUDIT_MAX_PAGES || '100');
  
  // Get property details
  const property = await env.DB.prepare(
    'SELECT domain FROM properties WHERE id = ?'
  ).bind(propertyId).first<{ domain: string }>();

  if (!property) {
    throw new Error('Property not found');
  }

  const domain = property.domain;
  const baseUrl = `https://${domain}`;
  
  // Initialize audit record
  await env.DB.prepare(
    `INSERT INTO audits (id, property_id, status, pages_total) 
     VALUES (?, ?, 'running', 0)`
  ).bind(auditId, propertyId).run();

  const issues: AuditIssue[] = [];
  const pages: Array<{
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
  }> = [];

  try {
    // Step 1: Check crawlability (robots.txt, sitemap, AI bots)
    const crawlabilityData = await checkCrawlability(baseUrl);
    
    // Step 1a: Probe AI bot access to detect CDN/WAF blocking
    console.log('Probing AI bot access...');
    const aiAccess = await probeAiAccess(baseUrl);
    console.log('AI access probe complete:', JSON.stringify(aiAccess).substring(0, 200));
    const blockedBotsProbe = aiAccess.results.filter(r => r.blocked);
    
    // Compute flags for quick access
    const aiBlockedBots = blockedBotsProbe.map(b => b.bot);
    const robotsBlockedBots = Object.entries(crawlabilityData.aiBotsAllowed)
      .filter(([bot, allowed]) => !allowed)
      .map(([bot]) => bot);
    const allBlockedBots = [...new Set([...aiBlockedBots, ...robotsBlockedBots])];
    
    const blockedBy = 
      allBlockedBots.length === 0 ? null :
      blockedBotsProbe.length > 0 && (blockedBotsProbe[0].cfRay || blockedBotsProbe[0].akamai) ? 'waf' :
      robotsBlockedBots.length > 0 ? 'robots' :
      'unknown';
    
    const aiFlags = {
      aiBlocked: allBlockedBots.length > 0,
      blockedBy,
      blockedBots: allBlockedBots,
      wafName: blockedBotsProbe[0]?.cfRay ? 'Cloudflare' : blockedBotsProbe[0]?.akamai ? 'Akamai' : null
    };
    
    // Add issues based on crawlability checks
    if (!crawlabilityData.robotsFound) {
      issues.push({
        page_url: null,
        issue_type: 'robots_missing',
        severity: 'warning',
        message: 'robots.txt not found - consider adding one to guide AI crawlers',
      });
    }
    
    if (!crawlabilityData.sitemapFound) {
      issues.push({
        page_url: null,
        issue_type: 'sitemap_missing',
        severity: 'warning',
        message: 'Sitemap not found or not referenced in robots.txt',
      });
    }
    
    // Check if key AI bots are blocked by robots.txt
    const blockedBots = Object.entries(crawlabilityData.aiBotsAllowed)
      .filter(([bot, allowed]) => !allowed)
      .map(([bot]) => bot);
    
    if (blockedBots.length > 0) {
      issues.push({
        page_url: null,
        issue_type: 'robots_blocks_ai',
        severity: 'critical',
        message: `robots.txt is blocking AI bots: ${blockedBots.join(', ')}`,
        details: 'Consider explicitly allowing GPTBot, ClaudeBot, PerplexityBot, and other AI agents',
      });
    }
    
    // Check if AI bots are blocked by CDN/WAF
    if (blockedBotsProbe.length > 0) {
      const blockedBotNames = blockedBotsProbe.map(b => b.bot).join(', ');
      const cdnInfo = blockedBotsProbe[0].cfRay ? 'Cloudflare' : blockedBotsProbe[0].akamai ? 'Akamai' : 'CDN/WAF';
      issues.push({
        page_url: null,
        issue_type: 'cdn_blocks_ai',
        severity: 'critical',
        message: `${cdnInfo} is blocking AI bots: ${blockedBotNames}`,
        details: JSON.stringify({ 
          blockedBots: blockedBotsProbe.map(b => ({ bot: b.bot, status: b.status, server: b.server })),
          baseline: aiAccess.baselineStatus
        }),
      });
    }

    // Step 2: Get URLs to crawl (fallback to just homepage if no sitemap)
    let urlsToCrawl: string[] = [baseUrl];
    
    // Step 2a: Fetch sitemap URLs (supports sitemap index)
    let sitemapUrls = await fetchSitemapUrls(`${baseUrl}/sitemap.xml`, env.USER_AGENT, maxPages * 2);
    
    if (sitemapUrls.length > 0) {
      console.log(`Fetched ${sitemapUrls.length} URLs from sitemap`);
      
      // Step 2b: Normalize and dedupe URLs first
      const normalizedMap = new Map<string, string>();
      for (const url of sitemapUrls) {
        const normalized = normalizeUrl(url);
        if (!normalizedMap.has(normalized)) {
          normalizedMap.set(normalized, url); // Keep original URL
        }
      }
      let filteredUrls = Array.from(normalizedMap.values());
      console.log(`After normalization: ${filteredUrls.length} unique URLs`);
      
      // Step 2c: Apply user filters (include/exclude)
      const beforeUserFilters = filteredUrls.length;
      filteredUrls = applyIncludeExclude(filteredUrls, options?.filters);
      if (options?.filters?.include && options.filters.include.length > 0) {
        console.log(`filters.include: ${options.filters.include.map(r => r.source).join(', ')}`);
      }
      if (options?.filters?.exclude && options.filters.exclude.length > 0) {
        console.log(`filters.exclude: ${options.filters.exclude.map(r => r.source).join(', ')}`);
      }
      if (beforeUserFilters !== filteredUrls.length) {
        console.log(`After user filters: ${filteredUrls.length}/${beforeUserFilters} URLs`);
      }
      
      // Step 2d: Apply safety filters (non-HTML, language, depth)
      filteredUrls = filteredUrls.filter(url => {
        try {
          // Skip non-HTML files
          if (isNonHtmlUrl(url)) {
            return false;
          }
          
          const urlObj = new URL(url);
          const path = urlObj.pathname.toLowerCase();
          
          // Exclude non-English language paths
          const nonEnglishPatterns = [
            '/es-us/', '/es/', '/es-mx/', '/es-la/',  // Spanish
            '/fr/', '/fr-ca/', '/fr-fr/',              // French
            '/de/', '/de-de/',                         // German
            '/pt/', '/pt-br/',                         // Portuguese
            '/it/', '/it-it/',                         // Italian
            '/ja/', '/ja-jp/',                         // Japanese
            '/zh/', '/zh-cn/', '/zh-tw/',              // Chinese
            '/ko/', '/ko-kr/',                         // Korean
            '/ru/', '/ru-ru/',                         // Russian
            '/ar/', '/ar-sa/',                         // Arabic
          ];
          
          for (const pattern of nonEnglishPatterns) {
            if (path.includes(pattern)) {
              return false;
            }
          }
          
          // Limit URL depth (max 4 levels)
          const pathSegments = path.split('/').filter(Boolean);
          if (pathSegments.length > 4) {
            return false;
          }
          
          return true;
        } catch {
          return false;
        }
      });
      
      // Step 2e: Cap to maxPages
      urlsToCrawl = filteredUrls.slice(0, maxPages);
      console.log(`maxPages: ${maxPages}`);
      console.log(`Final crawl list: ${urlsToCrawl.length} English HTML URLs (from ${sitemapUrls.length} sitemap entries)`);
    } else {
      console.log('No sitemap URLs found, using homepage only');
    }

    // Step 3: Crawl pages (max 100 English URLs within 4 levels, 1 RPS throttle)
    for (let i = 0; i < Math.min(urlsToCrawl.length, maxPages); i++) {
      const pageUrl = urlsToCrawl[i];
      
      // 1 second delay between requests (1 RPS)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      try {
        const pageStart = Date.now();
        
        // Use renderPage for accurate content extraction
        const rendered = await renderPage(env, pageUrl, { userAgent: env.USER_AGENT });
        const pageTime = Date.now() - pageStart;
        
        // Log render mode for observability
        console.log(`render: ${pageUrl} -> mode=${rendered.mode}, words=${rendered.words}`);

        if (rendered.statusCode === 200 || rendered.statusCode === 0) {
          const html = rendered.html;
          const title = extractTitle(html);
          const h1 = extractH1(html);
          
          // Use rendered values (more accurate than parsing)
          const wordCount = rendered.words;
          const snippet = rendered.snippet;
          const hasH1 = rendered.hasH1;
          const jsonLdCount = rendered.jsonLdCount;
          const faqOnPage = rendered.faqOnPage; // Per-page FAQ detection

          // Still need to extract JSON-LD blocks for Organization check
          const jsonLdBlocks = extractJSONLD(html);

          // Check for Organization sameAs (only on homepage)
          if (pageUrl === baseUrl || pageUrl === `${baseUrl}/`) {
            const orgData = extractOrganization(jsonLdBlocks);
            if (orgData.hasOrg && !orgData.sameAs) {
              issues.push({
                page_url: pageUrl,
                issue_type: 'structured_data',
                severity: 'warning',
                message: 'Organization schema missing sameAs links for entity verification',
                details: JSON.stringify({
                  recommendation: 'Add sameAs property to link to authoritative profiles',
                  entity: orgData.name,
                  category: 'entity_graph'
                }),
              });
            }
          }

          pages.push({
            url: pageUrl,
            status_code: rendered.statusCode || 200,
            title,
            h1,
            has_h1: hasH1,
            jsonld_count: jsonLdCount,
            faq_present: faqOnPage, // Store per-page FAQ detection
            word_count: wordCount,
            rendered_words: wordCount,
            snippet,
            load_time_ms: pageTime,
            error: null,
          });

          // Check for issues using rendered values
          if (!title) {
            issues.push({
              page_url: pageUrl,
              issue_type: 'missing_title',
              severity: 'critical',
              message: 'Page missing title tag',
            });
          }

          if (!hasH1) {
            issues.push({
              page_url: pageUrl,
              issue_type: 'missing_h1',
              severity: 'warning',
              message: 'Page missing H1 heading',
            });
          }

          if (jsonLdCount === 0) {
            issues.push({
              page_url: pageUrl,
              issue_type: 'missing_structured_data',
              severity: 'info',
              message: 'Page missing JSON-LD structured data',
            });
          }

          // Raise threshold to 120 words to reduce false positives
          if (wordCount < 120) {
            issues.push({
              page_url: pageUrl,
              issue_type: 'thin_content',
              severity: 'warning',
              message: `Thin content: only ${wordCount} words`,
              details: JSON.stringify({ words: wordCount, snippet }),
            });
          }
        } else {
          pages.push({
            url: pageUrl,
            status_code: rendered.status,
            title: null,
            h1: null,
            has_json_ld: false,
            has_faq: false,
            word_count: 0,
            rendered_words: 0,
            snippet: null,
            load_time_ms: pageTime,
            error: `HTTP ${rendered.status}`,
          });

          issues.push({
            page_url: pageUrl,
            issue_type: 'page_error',
            severity: 'critical',
            message: `Page returned HTTP ${rendered.status}`,
          });
        }
      } catch (error) {
        pages.push({
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

        issues.push({
          page_url: pageUrl,
          issue_type: 'page_unreachable',
          severity: 'critical',
          message: 'Failed to fetch page',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Step 4: Compute site-level rollups
    
    // FAQ Schema Present: Does ANY page have FAQPage JSON-LD?
    const siteFaqSchemaPresent = pages.some(p => p.faq_present);
    
    // FAQ Page Present: Does ANY page look like an FAQ page (URL heuristic)?
    const siteFaqPagePresent = pages.some(p => {
      const url = p.url.toLowerCase();
      const title = (p.title || '').toLowerCase();
      return (
        url.includes('/faq') || 
        url.includes('/faqs') || 
        url.includes('/frequently-asked') ||
        title.includes('faq') ||
        title.includes('frequently asked')
      );
    });
    
    const allSchemaTypes: string[] = [];
    
    for (const page of pages) {
      if (page.jsonld_count > 0) {
        // Extract JSON-LD from stored content (if we had it)
        // For now, we'll need to mark this as a TODO or extract during render
        // Placeholder: assume we track this somewhere
      }
    }
    
    // Add site-level FAQ issue if missing BOTH page and schema
    if (!siteFaqSchemaPresent && !siteFaqPagePresent) {
      issues.push({
        page_url: null,
        issue_type: 'site_missing_faq',
        severity: 'info',
        message: 'Site lacks FAQ content - consider adding an FAQ page with structured data',
        details: 'FAQ content helps AI assistants provide accurate answers about your product/service',
      });
    } else if (siteFaqPagePresent && !siteFaqSchemaPresent) {
      issues.push({
        page_url: null,
        issue_type: 'faq_missing_schema',
        severity: 'warning',
        message: 'FAQ page found but missing FAQPage schema',
        details: 'Add JSON-LD FAQPage markup to your FAQ page for better AI visibility',
      });
    }
    
    const structuredData = {
      siteFaqSchemaPresent,
      siteFaqPagePresent,
      schemaTypes: allSchemaTypes,
    };

    // Step 5: Calculate scores
    const scores = calculateScores(pages, issues, crawlabilityData, structuredData);

    // Step 5.5: Run Brave AI queries (Phase F+ with smart query builder)
    let braveQueryLogs: BraveQueryLog[] = [];
    const ENABLE_BRAVE = !!env.BRAVE_SEARCH_AI;
    
    if (ENABLE_BRAVE) {
      try {
        console.log('Running Brave AI queries (Phase F+)...');
        
        // Prepare config
        const maxQueries = Number(env.BRAVE_AI_MAX_QUERIES ?? 30);
        const hardCap = Number(env.BRAVE_AI_HARD_CAP ?? 60);
        const enableCompare = env.BRAVE_AI_ENABLE_COMPARE === 'true';
        const brand = property.display_name || property.domain.replace(/^www\./, '').split('.')[0];
        
        // Convert pages to minimal format for query builder
        const minimalPages: PageData[] = pages.map(p => ({
          path: p.pathname || p.url.replace(property.domain, '').replace(/^https?:\/\/[^/]+/, '') || '/',
          h1: p.h1 || null,
          words: p.word_count || 0
        }));
        
        // Build smart queries (path-aware, H1-driven, entity intents)
        const smartQueries = buildSmartQueries({
          brand,
          domain: property.domain,
          pages: minimalPages,
          extraTerms: [], // Can be extended from request body in future
          maxQueries,
          hardCap,
          enableCompare
        });
        
        console.log(`Generated ${smartQueries.length} smart queries for ${brand}`);
        
        // Run queries (fixed: uses correct Brave Web Search API)
        braveQueryLogs = await runBraveAIQueries(
          env.BRAVE_SEARCH_AI!,
          smartQueries,
          property.domain,
          {
            timeoutMs: Number(env.BRAVE_TIMEOUT_MS ?? 7000),
            concurrency: Number(env.BRAVE_CONCURRENCY ?? 2)
          }
        );
        
        // Calculate summary stats
        const totalSources = braveQueryLogs.reduce((sum, log) => sum + (log.sourcesTotal ?? 0), 0);
        const domainSources = braveQueryLogs.reduce((sum, log) => sum + (log.domainSources ?? 0), 0);
        const uniquePaths = Array.from(new Set(braveQueryLogs.flatMap(log => log.domainPaths ?? [])));
        
        console.log(`Brave AI complete: ${braveQueryLogs.length} queries, ${totalSources} total sources, ${domainSources} from domain, ${uniquePaths.length} unique paths cited`);
      } catch (e) {
        console.error('Brave AI failed:', e instanceof Error ? e.message : String(e));
        braveQueryLogs = []; // Graceful fallback
      }
    } else {
      console.log('Brave AI disabled (no BRAVE_SEARCH_AI key)');
    }

    // Step 6: Save results to database
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
      scores.overall,
      scores.crawlability,
      scores.structured,
      scores.answerability,
      scores.trust,
      pages.length,
      urlsToCrawl.length,
      issues.length,
      JSON.stringify(aiAccess),
      JSON.stringify(aiFlags),
      braveQueryLogs.length > 0 ? JSON.stringify({ queries: braveQueryLogs }) : null,
      auditId
    ).run();
    
    console.log('Audit saved. AI access JSON length:', JSON.stringify(aiAccess).length);

    // Save pages
    for (const page of pages) {
      await env.DB.prepare(
        `INSERT INTO audit_pages 
         (audit_id, url, status_code, title, h1, has_h1, jsonld_count, faq_present, word_count, rendered_words, snippet, load_time_ms, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        auditId,
        page.url,
        page.status_code,
        page.title,
        page.h1,
        page.has_h1 ? 1 : 0,
        page.jsonld_count ?? 0,
        page.faq_present ? 1 : 0,
        page.word_count,
        page.rendered_words,
        page.snippet,
        page.load_time_ms,
        page.error
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
        issue.page_url,
        issue.issue_type,
        issue.severity,
        issue.message,
        issue.details || null
      ).run();
    }

    return auditId;
  } catch (error) {
    // Update audit with error
    await env.DB.prepare(
      `UPDATE audits 
       SET status = 'failed', 
           error = ?,
           completed_at = datetime('now')
       WHERE id = ?`
    ).bind(
      error instanceof Error ? error.message : String(error),
      auditId
    ).run();

    throw error;
  }
}

