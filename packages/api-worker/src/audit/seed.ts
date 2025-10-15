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
  
  // SIMPLE MODE: Smart sitemap-first approach
  if (simpleMode) {
    console.log(`[Seed] Using SIMPLE MODE: smart sitemap-first seeding`);
    
    // Import new components
    const { resolveCanonicalHost } = await import('./canonical-host');
    const { discoverSitemaps } = await import('./sitemap-discovery');
    const { parseSitemap } = await import('./sitemap-parse');
    const { frontierBatchEnqueue, markSeeded } = await import('./frontier-batch');
    
    // 1. Resolve canonical host first and store it
    const canonicalHost = await resolveCanonicalHost(env, origin);
    console.log(`[Seed] Using canonical host: ${canonicalHost}`);
    
    // Store canonical host in audit record
    await env.DB.prepare(`
      UPDATE audits SET canonical_host=?1 WHERE id=?2
    `).bind(canonicalHost, auditId).run();
    console.log(`CANONICAL_HOST_RESOLVED { audit: ${auditId}, to: ${canonicalHost} }`);
    
    // 2. Discover all sitemaps using smart discovery
    const sitemapUrls = await discoverSitemaps(env, canonicalHost);
    console.log(`[Seed] Discovered ${sitemapUrls.length} sitemap URLs: ${sitemapUrls.join(', ')}`);
    
    // 3. Parse all sitemaps to collect URLs
    const allUrls: string[] = [];
    let sitemapIndexCount = 0;
    let urlsetCount = 0;
    
    const urlCap = parseInt(env.SITEMAP_URL_CAP || '500');
    const childCap = 20; // Max child sitemaps to follow
    
    // CRITICAL: Limit sitemap discovery to prevent worker timeouts
    const maxSitemapsToProcess = 3; // Only process first 3 sitemaps
    const maxUrlsPerSitemap = 100;  // Only take first 100 URLs per sitemap
    
    // Process sitemaps with limits to prevent timeouts
    let sitemapsProcessed = 0;
    for (const sitemapUrl of sitemapUrls) {
      if (sitemapsProcessed >= maxSitemapsToProcess) {
        console.log(`[Seed] Limiting to ${maxSitemapsToProcess} sitemaps to prevent timeout`);
        break;
      }
      
      console.log(`[Seed] Parsing sitemap: ${sitemapUrl}`);
      const result = await parseSitemap(env, sitemapUrl, { childCap, urlCap: maxUrlsPerSitemap });
      console.log(`[Seed] Sitemap result: ${result.urls.length} URLs, ${result.sitemapIndexCount} children, ${result.urlsetCount} urlset`);
      allUrls.push(...result.urls);
      sitemapIndexCount += result.sitemapIndexCount;
      urlsetCount += result.urlsetCount;
      
      // Follow child sitemaps (sitemap index) - limit to prevent timeout
      const maxChildren = Math.min(result.indexChildren.length, 5); // Only first 5 children
      for (let i = 0; i < maxChildren; i++) {
        const childUrl = result.indexChildren[i];
        console.log(`[Seed] Parsing child sitemap: ${childUrl}`);
        const childResult = await parseSitemap(env, childUrl, { childCap: 0, urlCap: maxUrlsPerSitemap });
        console.log(`[Seed] Child result: ${childResult.urls.length} URLs`);
        allUrls.push(...childResult.urls);
        urlsetCount += childResult.urlsetCount;
      }
      
      sitemapsProcessed++;
    }
    
    console.log(`[Seed] Collected ${allUrls.length} total URLs from sitemaps`);
    
    // SIMPLE APPROACH: Just take the first 50 URLs from sitemap and crawl them
    const maxPages = parseInt(env.CRAWL_MAX_PAGES || '50');
    
    // 4. Normalize and deduplicate
    const normalized = allUrls
      .map(url => normalizeUrl(url, `https://${canonicalHost}`))
      .filter((url): url is string => Boolean(url));
    
    const unique = [...new Set(normalized)];
    console.log(`[Seed] After normalization: ${unique.length} unique URLs`);
    
    // 5. Take first 50 URLs + homepage
    const homepageUrl = `https://${canonicalHost}/`;
    const urlsToCrawl = [homepageUrl];
    
    // Add sitemap URLs up to the limit
    for (const url of unique) {
      if (url !== homepageUrl && urlsToCrawl.length < maxPages) {
        urlsToCrawl.push(url);
      }
    }
    
    console.log(`[Seed] Selected ${urlsToCrawl.length} URLs to crawl directly`);
    
    // 6. Batch insert URLs for direct crawling
    const inserted = await frontierBatchEnqueue(env, auditId, urlsToCrawl, { 
      depth: 0, 
      priorityBase: 0.5, 
      source: 'sitemap_direct',
      origin: `https://${canonicalHost}`
    });
    
    console.log(`[Seed] Successfully enqueued ${inserted} URLs for direct crawling`);
    
    // 7. Check if we have enough URLs (either newly inserted or already in frontier)
    const existingCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM audit_frontier WHERE audit_id = ?1
    `).bind(auditId).first<{ count: number }>();
    
    const totalUrls = existingCount?.count ?? 0;
    console.log(`[Seed] Total URLs in frontier: ${totalUrls} (newly inserted: ${inserted})`);
    
    if (totalUrls >= minRequired) {
      await markSeeded(env, auditId);
      
      console.log(`SEED_SITEMAP { audit: ${auditId}, candidates: ${urlsToCrawl.length}, enqueued: ${inserted}, total_in_frontier: ${totalUrls}, seeded: 1, sitemapIndex: ${sitemapIndexCount}, urlsets: ${urlsetCount}, mode: 'direct' }`);
      
      return {
        homepage: 1,
        navLinks: 0,
        sitemapUrls: urlsToCrawl.length,
        total: totalUrls,
        seeded: true
      };
    } else if (fallbackHome && totalUrls < minRequired) {
      // 9. Fallback: add common paths if still below threshold
      const commonPaths = [
        '/about', '/contact', '/support', '/help', '/faq', '/privacy', '/terms',
        '/blog', '/news', '/products', '/services', '/pricing', '/features',
        '/company', '/team', '/careers', '/press', '/investors', '/security'
      ];
      
      const fallbackUrls = commonPaths.map(path => `https://${canonicalHost}${path}`);
      const fallbackInserted = await frontierBatchEnqueue(env, auditId, fallbackUrls, { 
        depth: 1, 
        priorityBase: 0.8, 
        source: 'fallback',
        origin: `https://${canonicalHost}`
      });
      
      const totalInserted = inserted + fallbackInserted;
      console.log(`[Seed] Added ${fallbackInserted} fallback URLs, total: ${totalInserted}`);
      
      // Check total URLs in frontier after fallback
      const finalCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM audit_frontier WHERE audit_id = ?1
      `).bind(auditId).first<{ count: number }>();
      
      const finalTotal = finalCount?.count ?? 0;
      console.log(`[Seed] Final total URLs in frontier: ${finalTotal}`);
      
      if (finalTotal >= minRequired) {
        await markSeeded(env, auditId);
        
        console.log(`SEED_SITEMAP { audit: ${auditId}, candidates: ${urlsToCrawl.length + fallbackUrls.length}, enqueued: ${totalInserted}, total_in_frontier: ${finalTotal}, seeded: 1, fallback: ${fallbackInserted}, mode: 'direct+fallback' }`);
        
        return {
          homepage: 1,
          navLinks: 0,
          sitemapUrls: urlsToCrawl.length,
          total: finalTotal,
          seeded: true
        };
      }
    }
    
    // 10. If still not enough, fail the seeding
    console.error(`[Seed] SEED_INSUFFICIENT_URLS: Only ${totalUrls} URLs in frontier, need ${minRequired}`);
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
      sitemapUrls: urlsToCrawl.length,
      total: inserted,
      seeded: false,
      reason: 'SEED_INSUFFICIENT_URLS'
    };
  }
  
  // LEGACY MODE: Original seeding logic
  console.log(`[Seed] Using LEGACY MODE: homepage + nav + sitemap`);
  
  let totalEnqueued = 0;
  
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
    
    // Try common sitemap locations (both www and non-www variants)
    const baseOrigin = origin.replace(/^https?:\/\/(www\.)?/, 'https://');
    const wwwOrigin = origin.replace(/^https?:\//, 'https://www.');
    const nonWwwOrigin = origin.replace(/^https?:\/\/www\./, 'https://');
    
    const sitemapUrls = [
      `${baseOrigin}/sitemap.xml`,
      `${baseOrigin}/sitemap_index.xml`, 
      `${baseOrigin}/sitemaps.xml`,
      `${wwwOrigin}/sitemap.xml`,
      `${wwwOrigin}/sitemap_index.xml`,
      `${wwwOrigin}/sitemaps.xml`,
      `${nonWwwOrigin}/sitemap.xml`,
      `${nonWwwOrigin}/sitemap_index.xml`,
      `${nonWwwOrigin}/sitemaps.xml`
    ].filter((url, index, arr) => arr.indexOf(url) === index); // Remove duplicates
    
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
