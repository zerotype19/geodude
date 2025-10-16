/**
 * Main Sitemap Fetcher + Parser
 * Only fetches sitemap.xml at the canonical host, no robots.txt or indexes
 */

const TEXT_CT = /xml|text\/plain|text\/xml/i;

export async function fetchMainSitemap(fetchFn: typeof fetch, host: string) {
  const candidates = [
    `https://${host}/sitemap.xml`,
    `https://www.${host.replace(/^www\./,'')}/sitemap.xml`,
    `https://${host.replace(/^www\./,'')}/sitemap.xml`,
    `http://${host}/sitemap.xml`,
  ];
  
  for (const url of candidates) {
    try {
      const res = await fetchFn(url, { method: 'GET' });
      
      if (!res.ok) { 
        try { res.body?.cancel(); } catch {} ; 
        continue; 
      }
      
      const ct = res.headers.get('content-type') || '';
      if (!TEXT_CT.test(ct)) { 
        try { res.body?.cancel(); } catch {} ; 
        continue; 
      }
      
      const buf = await res.arrayBuffer(); // consume to avoid deadlock
      return { 
        url, 
        bytes: buf.byteLength, 
        text: new TextDecoder().decode(buf) 
      };
    } catch {
      // Continue to next candidate
    }
  }
  
  return null;
}

export function parseFirstUrls(xml: string, limit: number): string[] {
  // Support both XML urlset and plaintext lists (some sites serve that)
  if (xml.trim().startsWith('http')) {
    return xml.split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, limit);
  }
  
  // super-fast, namespace-agnostic <loc> extractor
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
    .map(m => m[1]);
    
  return locs.slice(0, limit);
}
