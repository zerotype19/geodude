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
  
  const simpleMode = env.CRAWL_SIMPLE_MODE === "1";
  const minRequired = parseInt(env.CRAWL_SEED_REQUIRE_MIN || "20");
  const fallbackHome = env.CRAWL_SEED_FALLBACK_HOME === "1";
  
  let totalEnqueued = 0;
  
  // SIMPLE MODE: Sitemap-first approach
  if (simpleMode) {
    console.log(`[Seed] Using SIMPLE MODE: sitemap-first seeding`);
    
    // 1. Always seed homepage first
    await enqueueUrl(env, auditId, origin, 0, 0, 'seed');
    totalEnqueued++;
    console.log(`[Seed] Added homepage: ${origin}`);
    
    // 2. Sitemap seeds @ depth 1, priority 0.5 (capped)
    const sitemapResult = await loadSitemapUrls(env, origin, { cap: opts.maxSitemap ?? 500 });
    const sm = sitemapResult.urls;
    const sitemapIndexCount = sitemapResult.sitemapIndexCount;
    const urlsetCount = sitemapResult.urlsetCount;
    
    const uniqueSitemap = [...new Set(sm)];
    
    // Batch enqueue with priority sorting
    const priorityPaths = ['pricing', 'product', 'help', 'support', 'docs', 'about', 'blog', 'contact', 'features', 'legal', 'terms'];
    const sortedSitemap = uniqueSitemap.sort((a, b) => {
      const aPath = new URL(a).pathname.toLowerCase();
      const bPath = new URL(b).pathname.toLowerCase();
      
      const aPriority = priorityPaths.some(path => aPath.includes(path)) ? 0 : 1;
      const bPriority = priorityPaths.some(path => bPath.includes(path)) ? 0 : 1;
      
      return aPriority - bPriority;
    });
    
    let enqueuedCount = 0;
    for (const u of sortedSitemap) {
      try {
        await enqueueUrl(env, auditId, u, 1, 0.5, 'sitemap');
        enqueuedCount++;
        totalEnqueued++;
      } catch (error) {
        console.log(`[Seed] Failed to enqueue ${u}:`, error);
      }
    }
    console.log(`[Seed] Added ${enqueuedCount}/${uniqueSitemap.length} sitemap URLs`);
    
    // 3. Check if we have enough seeds
    if (totalEnqueued < minRequired) {
      if (fallbackHome) {
        // Add common path heuristics to reach minimum
        const commonPaths = [
          '/about', '/contact', '/support', '/help', '/faq', '/privacy', '/terms',
          '/blog', '/news', '/products', '/services', '/pricing', '/features',
          '/company', '/team', '/careers', '/press', '/investors', '/security'
        ];
        
        for (const path of commonPaths) {
          if (totalEnqueued >= minRequired) break;
          const url = origin + path;
          await enqueueUrl(env, auditId, url, 1, 0.8, 'fallback');
          totalEnqueued++;
        }
        console.log(`[Seed] Added ${commonPaths.length} fallback paths`);
      }
      
      // If still not enough, fail the seeding
      if (totalEnqueued < minRequired) {
        console.error(`[Seed] SEED_INSUFFICIENT_URLS: Only ${totalEnqueued} URLs enqueued, need ${minRequired}`);
        await env.DB.prepare(`
          UPDATE audits 
          SET phase_state = json_set(
            COALESCE(phase_state, '{}'), 
            '$.crawl.seeded', 0,
            '$.crawl.seeded_at', datetime('now'),
            '$.crawl.seed_failure', 'SEED_INSUFFICIENT_URLS'
          )
          WHERE id = ?1
        `).bind(auditId).run();
        
        return {
          homepage: 1,
          navLinks: 0,
          sitemapUrls: uniqueSitemap.length,
          total: totalEnqueued,
          seeded: false,
          reason: 'SEED_INSUFFICIENT_URLS'
        };
      }
    }
    
    // Set seeded flag only if we have enough URLs
    await env.DB.prepare(`
      UPDATE audits 
      SET phase_state = json_set(
        COALESCE(phase_state, '{}'), 
        '$.crawl.seeded', 1,
        '$.crawl.seeded_at', datetime('now')
      )
      WHERE id = ?1
    `).bind(auditId).run();
    
    console.log(`SEED_SITEMAP { audit: ${auditId}, discovered: ${uniqueSitemap.length}, enqueued: ${totalEnqueued}, seeded: 1, sitemapIndex: ${sitemapIndexCount}, urlsets: ${urlsetCount}, mode: 'simple' }`);
    
    return {
      homepage: 1,
      navLinks: 0,
      sitemapUrls: uniqueSitemap.length,
      total: totalEnqueued,
      seeded: true
    };
  }
  
  // LEGACY MODE: Original seeding logic
  console.log(`[Seed] Using LEGACY MODE: homepage + nav + sitemap`);
  
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
): Promise<{ urls: string[]; sitemapIndexCount: number; urlsetCount: number }> {
  try {
    console.log(`[Seed] Loading sitemap URLs for ${origin}`);
    
    // Try common sitemap locations
    const sitemapUrls = [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemaps.xml`
    ];
    
    const allUrls: string[] = [];
    let sitemapIndexCount = 0;
    let urlsetCount = 0;
    
    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await safeFetch(sitemapUrl, {
          timeoutMs: 30000, // Increased timeout for big sitemaps
          retries: 1,
          headers: {
            'User-Agent': env.USER_AGENT || 'Mozilla/5.0 (compatible; OptiviewAudit/1.0)',
            'Accept': 'application/xml,text/xml,application/octet-stream,*/*'
          }
        });
        
        if (response.ok && response.data) {
          const xml = response.data as string;
          
          // Support both sitemap index and URL set
          if (xml.includes('<sitemapindex') || xml.includes('<sitemap>')) {
            // Sitemap Index: follow child sitemaps (cap at 20)
            const sitemapRegex = /<sitemap>\s*<loc>(.*?)<\/loc>/gi;
            let match;
            const childSitemaps: string[] = [];
            
            while ((match = sitemapRegex.exec(xml)) !== null && childSitemaps.length < 20) {
              const childUrl = match[1].trim();
              if (childUrl && isInternal(childUrl, origin)) {
                childSitemaps.push(childUrl);
              }
            }
            
            console.log(`[Seed] Found sitemap index with ${childSitemaps.length} child sitemaps`);
            sitemapIndexCount = childSitemaps.length;
            
            // Fetch URLs from child sitemaps
            for (const childUrl of childSitemaps) {
              try {
                const childResponse = await safeFetch(childUrl, {
                  timeoutMs: 15000,
                  retries: 1,
                  headers: {
                    'User-Agent': env.USER_AGENT || 'Mozilla/5.0 (compatible; OptiviewAudit/1.0)',
                    'Accept': 'application/xml,text/xml,application/octet-stream,*/*'
                  }
                });
                
                if (childResponse.ok && childResponse.data) {
                  const childXml = childResponse.data as string;
                  const urls = extractUrlsFromXml(childXml, origin);
                  allUrls.push(...urls);
                }
              } catch (error) {
                console.log(`[Seed] Failed to fetch child sitemap ${childUrl}:`, error);
              }
            }
          } else {
            // URL Set: direct URLs
            const urls = extractUrlsFromXml(xml, origin);
            allUrls.push(...urls);
            urlsetCount = urls.length;
          }
          
          console.log(`[Seed] Found ${allUrls.length} URLs in ${sitemapUrl} (index: ${sitemapIndexCount}, urlsets: ${urlsetCount})`);
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
    return { urls: capped, sitemapIndexCount, urlsetCount };
    
  } catch (error) {
    console.error(`[Seed] Error loading sitemap URLs:`, error);
    return { urls: [], sitemapIndexCount: 0, urlsetCount: 0 };
  }
}

function extractUrlsFromXml(xml: string, origin: string): string[] {
  const urls: string[] = [];
  
  // Try XML DOM parsing first (more robust)
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    
    // Handle both <urlset> and namespaced variants
    const locElements = doc.querySelectorAll('loc, *\\:loc');
    for (const loc of locElements) {
      const url = loc.textContent?.trim();
      if (url && isInternal(url, origin) && isValidPageUrl(url)) {
        urls.push(url);
      }
    }
  } catch (error) {
    // Fallback to regex if DOM parsing fails
    console.log(`[Seed] XML DOM parsing failed, using regex fallback`);
    const urlRegex = /<loc>(.*?)<\/loc>/gi;
    let match;
    
    while ((match = urlRegex.exec(xml)) !== null) {
      const url = match[1].trim();
      if (url && isInternal(url, origin) && isValidPageUrl(url)) {
        urls.push(url);
      }
    }
  }
  
  return urls;
}
