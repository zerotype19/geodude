import { safeFetch } from '../safe-fetch';

const CANDIDATES = [
  '/sitemap.xml',
  '/sitemap_index.xml',      // WP
  '/wp-sitemap.xml',         // WP modern
  '/sitemap.xml.gz',
  '/sitemap_index.xml.gz',
  '/sitemap.txt',
  '/sitemap1.xml', '/sitemap2.xml', // common shards
  '/sitemap-index.xml',
  '/sitemaps.xml',
  '/sitemaps_index.xml',
  '/sitemap-news.xml',       // Google News
  '/sitemap-products.xml',   // E-commerce
  '/sitemap-categories.xml', // E-commerce
];

interface SafeFetchResult {
  ok: boolean;
  text?: string;
  headers?: Record<string, string>;
  finalUrl?: string;
}

export async function discoverSitemaps(env: any, canonicalHost: string): Promise<string[]> {
  console.log(`[SitemapDiscovery] Starting discovery for canonical host: ${canonicalHost}`);
  
  const hostVariants = Array.from(new Set([
    canonicalHost,
    canonicalHost.replace(/^www\./, ''),
    `www.${canonicalHost.replace(/^www\./, '')}`
  ]));

  const baseUrls = [];
  for (const host of hostVariants) {
    baseUrls.push(`https://${host}`);
    baseUrls.push(`http://${host}`); // fallback if https blocks HEAD
  }

  console.log(`[SitemapDiscovery] Trying ${baseUrls.length} base URLs: ${baseUrls.join(', ')}`);

  // 1) robots.txt → collect Sitemap: lines
  const robotsSitemapUrls = await collectSitemapsFromRobots(env, baseUrls);
  console.log(`[SitemapDiscovery] Found ${robotsSitemapUrls.length} sitemaps from robots.txt`);

  // 2) direct candidates (parallel HEAD/GET with timeouts)
  const directCandidates = baseUrls.flatMap(b => CANDIDATES.map(c => `${b}${c}`));

  const urlsToTry = Array.from(new Set([
    ...robotsSitemapUrls,
    ...directCandidates,
  ])).slice(0, 100); // hard cap

  console.log(`[SitemapDiscovery] Testing ${urlsToTry.length} sitemap candidates`);

  // Process URLs in batches to avoid HTTP deadlock
  const batchSize = 3;
  const hits: string[] = [];
  
  for (let i = 0; i < urlsToTry.length; i += batchSize) {
    const batch = urlsToTry.slice(i, i + batchSize);
    const batchPromises = batch.map(async (url) => {
      try {
      // Use GET directly since we need the content for looksLikeSitemap
      const UA = 'OptiviewAuditor/1.0 (+https://app.optiview.ai) Mozilla/5.0';
      
      const r = await safeFetch(url, { 
        timeoutMs: 12000,
        followRedirects: true,
        headers: {
          'User-Agent': UA,
          'Accept': 'application/xml,text/xml,application/octet-stream,*/*'
        }
      });
      
        if (r.ok && looksLikeSitemap(r)) {
          const finalUrl = r.finalUrl ?? url;
          const bytes = r.text?.length ?? 0;
          const contentType = r.headers?.['content-type'] || '';
          console.log(`SITEMAP_ROOT_FETCH { url: "${finalUrl}", status: ${r.status || 200}, ct: "${contentType}", bytes: ${bytes} }`);
          hits.push(finalUrl);
        }
      } catch (error) {
        // Silent fail for individual candidates
      }
    });
    
    // Wait for this batch to complete before starting the next
    await Promise.allSettled(batchPromises);
  }

  // Dedup by normalized host
  const uniqueHits = Array.from(new Set(hits));
  console.log(`[SitemapDiscovery] Found ${uniqueHits.length} valid sitemaps: ${uniqueHits.join(', ')}`);
  
  return uniqueHits;
}

async function collectSitemapsFromRobots(env: any, bases: string[]): Promise<string[]> {
  const out: string[] = [];
  const UA = 'OptiviewAuditor/1.0 (+https://app.optiview.ai) Mozilla/5.0';
  
  for (const base of bases) {
    try {
      const r = await safeFetch(`${base}/robots.txt`, { 
        timeoutMs: 6000,
        headers: { 'User-Agent': UA },
        followRedirects: true
      });
      if (r.ok && r.text) {
        console.log(`[SitemapDiscovery] Parsing robots.txt from ${base}/robots.txt`);
        
        for (const line of r.text.split('\n')) {
          const m = line.match(/^\s*Sitemap:\s*(\S+)/i);
          if (m) {
            const sitemapUrl = m[1].trim();
            out.push(sitemapUrl);
            console.log(`[SitemapDiscovery] Found sitemap in robots.txt: ${sitemapUrl}`);
          }
        }
      }
    } catch (error) {
      console.log(`[SitemapDiscovery] Failed to fetch robots.txt from ${base}: ${error}`);
    }
  }
  
  return out;
}

function looksLikeSitemap(resp: SafeFetchResult): boolean {
  const ct = (resp.headers?.['content-type'] || '').toLowerCase();
  
  // Always sniff the body first - most reliable
  if (resp.text && resp.text.length > 0) {
    const hasXmlStructure = /<\s*(urlset|sitemapindex)\b/i.test(resp.text);
    if (hasXmlStructure) {
      console.log(`[SitemapDiscovery] Detected sitemap by content: ${resp.text.length} bytes`);
      return true;
    }
  }
  
  // Fallback to content-type check
  if (ct.includes('xml') || ct.includes('octet-stream') || ct === '') {
    console.log(`[SitemapDiscovery] Detected sitemap by content-type: "${ct}"`);
    return true;
  }
  
  return false;
}
