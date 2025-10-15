import { safeFetch } from '../safe-fetch';

interface ParseResult {
  urls: string[];
  indexChildren: string[];
  sitemapIndexCount: number;
  urlsetCount: number;
}

export async function parseSitemap(
  env: any, 
  sitemapUrl: string, 
  caps: { childCap: number; urlCap: number }
): Promise<ParseResult> {
  console.log(`[SitemapParse] Parsing sitemap: ${sitemapUrl}`);
  
  try {
    const res = await safeFetch(sitemapUrl, { 
      timeoutMs: 20000,
      headers: {
        'Accept': 'application/xml,text/xml,application/octet-stream,*/*'
      }
    });
    
    if (!res.ok) {
      console.log(`[SitemapParse] Failed to fetch sitemap ${sitemapUrl}: ${res.status}`);
      return { urls: [], indexChildren: [], sitemapIndexCount: 0, urlsetCount: 0 };
    }

    const xml = res.text ?? '';
    console.log(`[SitemapParse] Retrieved ${xml.length} bytes from ${sitemapUrl}`);

    const isIndex = /<\s*sitemapindex\b/i.test(xml);
    
    if (isIndex) {
      console.log(`[SitemapParse] Detected sitemap index`);
      
      // Extract child sitemap URLs using regex (more robust than DOM parsing)
      const locMatches = Array.from(xml.matchAll(/<\s*loc\s*>\s*([^<]+)\s*<\s*\/loc\s*>/gi));
      const locs = locMatches.map(m => m[1].trim()).slice(0, caps.childCap);
      
      console.log(`SITEMAP_INDEX_CHILDREN { url: "${sitemapUrl}", children: ${locs.length} }`);
      
      return { 
        urls: [], 
        indexChildren: locs, 
        sitemapIndexCount: locs.length, 
        urlsetCount: 0 
      };
    } else {
      console.log(`[SitemapParse] Detected URL set`);
      
      // Extract URLs using regex
      const locMatches = Array.from(xml.matchAll(/<\s*loc\s*>\s*([^<]+)\s*<\s*\/loc\s*>/gi));
      const urls = locMatches.map(m => m[1].trim()).slice(0, caps.urlCap);
      
      console.log(`SITEMAP_URLSET_PARSED { url: "${sitemapUrl}", urls: ${urls.length} }`);
      
      return { 
        urls, 
        indexChildren: [], 
        sitemapIndexCount: 0, 
        urlsetCount: urls.length 
      };
    }
  } catch (error) {
    console.error(`[SitemapParse] Error parsing sitemap ${sitemapUrl}:`, error);
    return { urls: [], indexChildren: [], sitemapIndexCount: 0, urlsetCount: 0 };
  }
}
