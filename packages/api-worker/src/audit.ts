/**
 * Audit Engine
 * Orchestrates website audits: robots.txt, sitemap, crawling, scoring
 */

import { extractJSONLD, extractTitle, extractH1, detectFAQ, countWords, extractOrganization } from './html';
import { calculateScores } from './score';
import { renderPage } from './render';

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
  const maxPages = parseInt(env.AUDIT_MAX_PAGES || '30');
  
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
    has_json_ld: boolean;
    has_faq: boolean;
    word_count: number;
    rendered_words: number;
    snippet: string | null;
    load_time_ms: number;
    error: string | null;
  }> = [];

  try {
    // Step 1: Check robots.txt
    const robotsUrl = `${baseUrl}/robots.txt`;
    const robotsStart = Date.now();
    const robotsResponse = await fetch(robotsUrl, {
      headers: { 'User-Agent': env.USER_AGENT },
    });
    const robotsTime = Date.now() - robotsStart;

    if (robotsResponse.status === 200) {
      const robotsText = await robotsResponse.text();
      
      // Check for AI bot allowances
      const hasSitemap = /sitemap:/i.test(robotsText);
      const allowsGPTBot = /User-agent:\s*GPTBot/i.test(robotsText) && !/Disallow:\s*\//i.test(robotsText);
      const allowsClaudeBot = /User-agent:\s*(Claude-Web|ClaudeBot)/i.test(robotsText);
      
      if (!hasSitemap) {
        issues.push({
          page_url: robotsUrl,
          issue_type: 'robots_missing_sitemap',
          severity: 'warning',
          message: 'robots.txt does not reference a sitemap',
        });
      }

      if (!allowsGPTBot && !allowsClaudeBot) {
        issues.push({
          page_url: robotsUrl,
          issue_type: 'robots_blocks_ai',
          severity: 'critical',
          message: 'robots.txt may be blocking AI crawlers',
          details: 'Consider explicitly allowing GPTBot, ClaudeBot, and other AI agents',
        });
      }
    } else {
      issues.push({
        page_url: robotsUrl,
        issue_type: 'robots_missing',
        severity: 'warning',
        message: 'robots.txt not found',
      });
    }

    // Step 2: Check sitemap
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    const sitemapStart = Date.now();
    const sitemapResponse = await fetch(sitemapUrl, {
      headers: { 'User-Agent': env.USER_AGENT },
    });
    const sitemapTime = Date.now() - sitemapStart;

    let urlsToCrawl: string[] = [baseUrl];

    if (sitemapResponse.status === 200) {
      const sitemapText = await sitemapResponse.text();
      
      // Extract URLs from sitemap (simple regex parsing)
      const urlMatches = sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g);
      const sitemapUrls = Array.from(urlMatches, m => m[1]).slice(0, maxPages);
      
      if (sitemapUrls.length > 0) {
        urlsToCrawl = sitemapUrls;
      } else {
        issues.push({
          page_url: sitemapUrl,
          issue_type: 'sitemap_empty',
          severity: 'warning',
          message: 'Sitemap contains no URLs',
        });
      }
    } else {
      issues.push({
        page_url: sitemapUrl,
        issue_type: 'sitemap_missing',
        severity: 'warning',
        message: 'sitemap.xml not found',
      });
    }

    // Step 3: Crawl pages (max 30, 1 RPS throttle)
    for (let i = 0; i < Math.min(urlsToCrawl.length, maxPages); i++) {
      const pageUrl = urlsToCrawl[i];
      
      // 1 second delay between requests (1 RPS)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      try {
        const pageStart = Date.now();
        
        // Use renderPage for accurate content extraction
        const rendered = await renderPage(env, pageUrl, env.USER_AGENT);
        const pageTime = Date.now() - pageStart;

        if (rendered.status === 200 || rendered.status === 0) {
          const html = rendered.html;
          const title = extractTitle(html);
          const h1 = extractH1(html);
          const jsonLdBlocks = extractJSONLD(html);
          const hasFaq = detectFAQ(html);
          
          // Use rendered word count (more accurate)
          const wordCount = rendered.words;
          const snippet = rendered.snippet;

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
            status_code: rendered.status || 200,
            title,
            h1,
            has_json_ld: jsonLdBlocks.length > 0,
            has_faq: hasFaq,
            word_count: wordCount,
            rendered_words: wordCount,
            snippet,
            load_time_ms: pageTime,
            error: null,
          });

          // Check for issues
          if (!title) {
            issues.push({
              page_url: pageUrl,
              issue_type: 'missing_title',
              severity: 'critical',
              message: 'Page missing title tag',
            });
          }

          if (!h1 || !rendered.hasH1) {
            issues.push({
              page_url: pageUrl,
              issue_type: 'missing_h1',
              severity: 'warning',
              message: 'Page missing H1 heading',
            });
          }

          if (jsonLdBlocks.length === 0 || rendered.jsonLdCount === 0) {
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
          has_json_ld: false,
          has_faq: false,
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

    // Step 4: Calculate scores
    const scores = calculateScores(pages, issues);

    // Step 5: Save results to database
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
         (audit_id, url, status_code, title, h1, has_json_ld, has_faq, word_count, rendered_words, snippet, load_time_ms, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        auditId,
        page.url,
        page.status_code,
        page.title,
        page.h1,
        page.has_json_ld ? 1 : 0,
        page.has_faq ? 1 : 0,
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

