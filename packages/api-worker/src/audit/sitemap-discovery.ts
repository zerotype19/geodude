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

  const hits: string[] = [];
  const promises = urlsToTry.map(async (url) => {
    try {
      const r = await safeFetch(url, { 
        timeoutMs: 12000, 
        headers: {
          'Accept': 'application/xml,text/xml,application/octet-stream,*/*'
        }
      });
      
      if (r.ok && looksLikeSitemap(r)) {
        const finalUrl = r.finalUrl ?? url;
        console.log(`SITEMAP_ROOT_FETCH { url: "${finalUrl}", status: ${r.status || 200} }`);
        hits.push(finalUrl);
      }
    } catch (error) {
      // Silent fail for individual candidates
    }
  });

  // Wait for all candidates with a reasonable timeout
  await Promise.allSettled(promises);

  // Dedup by normalized host
  const uniqueHits = Array.from(new Set(hits));
  console.log(`[SitemapDiscovery] Found ${uniqueHits.length} valid sitemaps: ${uniqueHits.join(', ')}`);
  
  return uniqueHits;
}

async function collectSitemapsFromRobots(env: any, bases: string[]): Promise<string[]> {
  const out: string[] = [];
  
  for (const base of bases) {
    try {
      const r = await safeFetch(`${base}/robots.txt`, { timeoutMs: 6000 });
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
  if (ct.includes('xml') || ct.includes('octet-stream') || ct === '') return true;
  
  // Some servers lie; fallback by sniffing body
  if (resp.text) {
    return /<\s*(urlset|sitemapindex)\b/i.test(resp.text);
  }
  
  return false;
}
