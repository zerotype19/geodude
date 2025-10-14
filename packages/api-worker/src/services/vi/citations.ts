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

export async function validateUrls(urls: string[], timeoutMs: number): Promise<string[]> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const head = async (u: string) => {
      try {
        const r = await fetch(u, { method: "HEAD", signal: controller.signal });
        // Accept most non-5xx as reachable; some sites 403/405 HEAD
        return (r.status >= 200 && r.status < 400) || r.status === 403 || r.status === 405;
      } catch { return false; }
    };
    const ok: string[] = [];
    for (const u of urls) if (await head(u)) ok.push(u);
    return ok;
  } finally { clearTimeout(t); }
}

// Enhanced parser (SOURCES bullets & markdown links)
export function parseSourcesBlock(s: string): Citation[] {
  const out: Citation[] = [];

  // Enhanced Perplexity format: "- Title — https://..." or "- Title — https://... [1]"
  for (const line of s.split("\n")) {
    const m = line.trim().match(/^-+\s*(.+?)\s+—\s+(https?:\/\/[^\s\]]+)(?:\s*\[[^\]]*\])?/i);
    if (m) {
      const u = normalizeUrl(m[2]);
      if (u) {
        const title = m[1].trim();
        out.push({ title: title || undefined, ref_url: u });
      }
    }
  }

  // Standard bullet format: "- Title — https://..."
  for (const line of s.split("\n")) {
    const m = line.trim().match(/^[-•]\s*(.+?)\s+—\s+(https?:\/\/[^\s\]]+)/i);
    if (m) {
      const u = normalizeUrl(m[2]);
      if (u) {
        const title = m[1].trim();
        out.push({ title: title || undefined, ref_url: u });
      }
    }
  }

  // Markdown links: [Title](https://...)
  const md = [...s.matchAll(/\[([^\]]{1,200})\]\((https?:\/\/[^)\s]+)\)/g)];
  for (const m of md) {
    const u = normalizeUrl(m[2]);
    if (u) out.push({ title: m[1].trim(), ref_url: u });
  }

  // Bare URLs (last resort)
  const bare = [...s.matchAll(/(?<!\()(?<!")\bhttps?:\/\/[^\s)]+/g)];
  for (const m of bare) {
    const u = normalizeUrl(m[0]);
    if (u) out.push({ ref_url: u });
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
