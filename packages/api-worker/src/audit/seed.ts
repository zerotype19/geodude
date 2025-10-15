/**
 * Seed crawl frontier with initial URLs from homepage, navigation, and sitemap
 */

import { enqueueUrl } from './frontier';
import { normalizeUrl, isInternal, isValidPageUrl } from './url-utils';
import { safeFetch } from '../safe-fetch';

export async function seedFrontier(
  env: any, 
  auditId: string, 
  origin: string, 
  opts: {
    navLinks?: string[];
    sitemapUrls?: string[];
    maxSitemap?: number;
  }
) {
  console.log(`[Seed] Seeding frontier for audit ${auditId} with origin ${origin}`);
  
  // Always seed home @ depth 0 priority 0
  await enqueueUrl(env, auditId, origin, 0, 0, 'seed');
  console.log(`[Seed] Added homepage: ${origin}`);

  // Nav seeds @ depth 1, priority 0.1
  const nav = (opts.navLinks ?? [])
    .map(href => normalizeUrl(href, origin))
    .filter((url): url is string => Boolean(url) && isValidPageUrl(url)) as string[];
  
  const uniqueNav = [...new Set(nav)];
  for (const u of uniqueNav) {
    await enqueueUrl(env, auditId, u, 1, 0.1, 'nav');
  }
  console.log(`[Seed] Added ${uniqueNav.length} nav links`);

  // Sitemap seeds @ depth 2, priority 0.5 (capped)
  const sm = (opts.sitemapUrls ?? [])
    .slice(0, opts.maxSitemap ?? 500)
    .map(href => normalizeUrl(href, origin))
    .filter((url): url is string => Boolean(url) && isValidPageUrl(url)) as string[];
  
  const uniqueSitemap = [...new Set(sm)];
  for (const u of uniqueSitemap) {
    await enqueueUrl(env, auditId, u, 2, 0.5, 'sitemap');
  }
  console.log(`[Seed] Added ${uniqueSitemap.length} sitemap URLs`);
  
  // Set immutable seeded flag - one-way state that can never be unset
  await env.DB.prepare(`
    UPDATE audits 
    SET phase_state = json_set(
      COALESCE(phase_state, '{}'), 
      '$.crawl.seeded', 1,
      '$.crawl.seeded_at', datetime('now')
    )
    WHERE id = ?1
  `).bind(auditId).run();
  
  console.log(`[Seed] Set immutable seeded flag for audit ${auditId}`);
  
  return {
    homepage: 1,
    navLinks: uniqueNav.length,
    sitemapUrls: uniqueSitemap.length,
    total: 1 + uniqueNav.length + uniqueSitemap.length
  };
}

export async function getHomeNavLinks(env: any, origin: string): Promise<{ navLinks: string[] }> {
  try {
    console.log(`[Seed] Fetching homepage for nav links: ${origin}`);
    
    // Use basic fetch for speed - we just need the HTML structure
    const response = await safeFetch(origin, {
      timeoutMs: 10000,
      retries: 1,
      headers: {
        'User-Agent': env.USER_AGENT || 'Mozilla/5.0 (compatible; OptiviewAudit/1.0)'
      }
    });
    
    if (!response.ok || !response.data) {
      console.log(`[Seed] Failed to fetch homepage: ${response.status}`);
      return { navLinks: [] };
    }
    
    const html = response.data as string;
    
    // Extract links from common navigation areas
    const navLinks: string[] = [];
    
    // Look for links in header, nav, footer areas
    const navSelectors = [
      'header a[href]',
      'nav a[href]', 
      '.header a[href]',
      '.nav a[href]',
      '.navigation a[href]',
      '.menu a[href]',
      'footer a[href]',
      '.footer a[href]'
    ];
    
    // Simple regex extraction since we don't have DOM parsing here
    // This is a fallback - in production you might want to use a proper HTML parser
    const linkRegex = /href\s*=\s*["']([^"']+)["']/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      if (href && isInternal(href, origin) && isValidPageUrl(href)) {
        navLinks.push(href);
      }
    }
    
    // Remove duplicates and limit
    const uniqueLinks = [...new Set(navLinks)];
    const limited = uniqueLinks.slice(0, 50); // NAV_SEED_LIMIT
    
    console.log(`[Seed] Extracted ${limited.length} nav links from homepage`);
    return { navLinks: limited };
    
  } catch (error) {
    console.error(`[Seed] Error fetching homepage nav links:`, error);
    return { navLinks: [] };
  }
}

export async function loadSitemapUrls(
  env: any, 
  origin: string, 
  opts: { cap: number }
): Promise<string[]> {
  try {
    console.log(`[Seed] Loading sitemap URLs for ${origin}`);
    
    // Try common sitemap locations
    const sitemapUrls = [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemaps.xml`
    ];
    
    const allUrls: string[] = [];
    
    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await safeFetch(sitemapUrl, {
          timeoutMs: 15000,
          retries: 1,
          headers: {
            'User-Agent': env.USER_AGENT || 'Mozilla/5.0 (compatible; OptiviewAudit/1.0)'
          }
        });
        
        if (response.ok && response.data) {
          const xml = response.data as string;
          
          // Extract URLs from XML using regex (simple approach)
          const urlRegex = /<loc>(.*?)<\/loc>/gi;
          let match;
          
          while ((match = urlRegex.exec(xml)) !== null) {
            const url = match[1].trim();
            if (url && isInternal(url, origin) && isValidPageUrl(url)) {
              allUrls.push(url);
            }
          }
          
          console.log(`[Seed] Found ${allUrls.length} URLs in ${sitemapUrl}`);
          break; // Found a sitemap, stop trying others
        }
      } catch (error) {
        console.log(`[Seed] Failed to fetch sitemap ${sitemapUrl}:`, error);
        continue;
      }
    }
    
    // Remove duplicates and apply cap
    const unique = [...new Set(allUrls)];
    const capped = unique.slice(0, opts.cap);
    
    console.log(`[Seed] Returning ${capped.length} sitemap URLs (capped from ${unique.length})`);
    return capped;
    
  } catch (error) {
    console.error(`[Seed] Error loading sitemap URLs:`, error);
    return [];
  }
}
