/**
 * Audit Engine
 * Orchestrates website audits: robots.txt, sitemap, crawling, scoring
 */

import { extractJSONLD, extractTitle, extractH1, detectFAQ, countWords, extractOrganization } from './html';
import { calculateScores } from './score';
import { renderPage } from './render';
import { checkCrawlability } from './crawl';

interface Env {
  DB: D1Database;
  USER_AGENT: string;
  AUDIT_MAX_PAGES: string;
}

interface AuditIssue {
  page_url: string | null;
  issue_type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string;
}

export async function runAudit(propertyId: string, env: Env): Promise<string> {
  const auditId = `aud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const maxPages = parseInt(env.AUDIT_MAX_PAGES || '100');
  
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
    
    // Check if key AI bots are blocked
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

    // Step 2: Get URLs to crawl (fallback to just homepage if no sitemap)
    let urlsToCrawl: string[] = [baseUrl];
    
    // Try to fetch sitemap for URL list
    try {
      const sitemapUrl = `${baseUrl}/sitemap.xml`;
      const sitemapResponse = await fetch(sitemapUrl, { headers: { 'User-Agent': env.USER_AGENT } });
      
      if (sitemapResponse.ok) {
        const sitemapText = await sitemapResponse.text();
        const urlMatches = sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g);
        let sitemapUrls = Array.from(urlMatches, m => m[1]);
        
        // Filter URLs: exclude non-English paths and limit depth
        sitemapUrls = sitemapUrls.filter(url => {
          try {
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
            
            // Limit URL depth (max 4 levels: / /about /about/team /about/team/history)
            const pathSegments = path.split('/').filter(Boolean);
            if (pathSegments.length > 4) {
              return false;
            }
            
            return true;
          } catch {
            return false;
          }
        });
        
        // Take up to maxPages URLs
        sitemapUrls = sitemapUrls.slice(0, maxPages);
        
        if (sitemapUrls.length > 0) {
          urlsToCrawl = sitemapUrls;
          console.log(`Filtered to ${sitemapUrls.length} English URLs within 4 levels`);
        }
      }
    } catch (error) {
      // Sitemap fetch failed, use homepage only
      console.log('Sitemap fetch failed, using homepage only');
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
    const siteFaqPresent = pages.some(p => p.faq_present);
    const allSchemaTypes: string[] = [];
    
    for (const page of pages) {
      if (page.jsonld_count > 0) {
        // Extract JSON-LD from stored content (if we had it)
        // For now, we'll need to mark this as a TODO or extract during render
        // Placeholder: assume we track this somewhere
      }
    }
    
    // Add site-level FAQ issue if missing
    if (!siteFaqPresent) {
      issues.push({
        page_url: null,
        issue_type: 'site_missing_faq',
        severity: 'info',
        message: 'Site lacks FAQ schema (FAQPage) - consider adding FAQ content with structured data',
        details: 'FAQ schema helps AI assistants provide accurate answers about your product/service',
      });
    }
    
    const structuredData = {
      siteFaqPresent,
      schemaTypes: allSchemaTypes,
    };

    // Step 5: Calculate scores
    const scores = calculateScores(pages, issues, crawlabilityData, structuredData);

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

