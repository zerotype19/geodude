/**
 * Shared citation utilities for VI connectors
 */

export type Citation = { title?: string; ref_url: string };

export function normalizeUrl(u: string): string | null {
  try {
    const url = new URL(u.trim());
    if (!/^https?:$/i.test(url.protocol)) return null;
    url.hash = ""; // drop fragment
    return url.toString();
  } catch { return null; }
}

export async function validateUrls(urls: string[], timeoutMs: number, brandHosts: string[] = []): Promise<string[]> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const validateUrl = async (u: string) => {
      try {
        // Skip validation for branded hosts
        const host = new URL(u).hostname.replace(/^www\./, '').toLowerCase();
        if (brandHosts.includes(host)) {
          return true;
        }

        // Use GET with Range header for better compatibility
        const r = await fetch(u, { 
          method: "GET",
          headers: { "Range": "bytes=0-0", "Accept": "text/html,application/xhtml+xml" },
          signal: controller.signal,
          redirect: "follow"
        });
        
        // Accept most non-5xx as reachable; some sites 403/405/406/429 on HEAD
        return (r.status >= 200 && r.status < 400) || 
               r.status === 403 || r.status === 405 || r.status === 406 || r.status === 429;
      } catch { 
        // Treat network hiccups as soft-accept for now
        return true;
      }
    };
    
    const ok: string[] = [];
    for (const u of urls) if (await validateUrl(u)) ok.push(u);
    return ok;
  } finally { clearTimeout(t); }
}

// Enhanced parser (SOURCES bullets & markdown links)
export function parseSourcesBlock(s: string): Citation[] {
  const out: Citation[] = [];
  const lines = s.split(/\r?\n/);

  // Handle bullet format with unicode dashes: "- Title — https://..." or "- Title – https://..." or "- Title - https://..."
  const bulletLine = /^\s*[-*•]\s*(?<title>.+?)\s*[—–-]\s*(?<url>https?:\/\/[^\s)]+)\/?\s*$/i;
  
  for (const line of lines) {
    const m = line.match(bulletLine);
    if (m?.groups?.url) {
      const u = normalizeUrl(m.groups.url.trim());
      if (u) {
        const title = m.groups.title?.trim();
        out.push({ title: title || undefined, ref_url: u });
      }
      continue; // Skip other parsing for this line
    }
  }

  // Markdown links: [Title](https://...)
  const markdownLink = /\[(?<title>[^\]]+)]\((?<url>https?:\/\/[^)]+)\)/g;
  for (const line of lines) {
    let md;
    while ((md = markdownLink.exec(line)) !== null) {
      const u = normalizeUrl(md.groups?.url?.trim());
      if (u) {
        out.push({ title: md.groups?.title?.trim(), ref_url: u });
      }
    }
  }

  // Bare URLs (last resort)
  const bareUrl = /(https?:\/\/[^\s)]+)(?![^<]*>)/g;
  for (const line of lines) {
    let bu;
    while ((bu = bareUrl.exec(line)) !== null) {
      const u = normalizeUrl(bu[1].trim());
      if (u) out.push({ ref_url: u });
    }
  }

  // Dedup by URL and improve titles
  const seen = new Set<string>();
  return out.filter(c => {
    if (!c.ref_url) return false;
    if (seen.has(c.ref_url)) return false;
    seen.add(c.ref_url);
    
    // If no title, try to generate one from URL
    if (!c.title) {
      try {
        const url = new URL(c.ref_url);
        const pathParts = url.pathname.split('/').filter(p => p && p.length > 2);
        if (pathParts.length > 0) {
          c.title = pathParts[pathParts.length - 1].replace(/[-_]/g, ' ').replace(/\.[^.]*$/, '');
        } else {
          c.title = url.hostname.replace('www.', '');
        }
      } catch {
        c.title = c.ref_url;
      }
    }
    
    return true;
  });
}
