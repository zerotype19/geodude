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

// Fallback parser (SOURCES bullets & markdown links)
export function parseSourcesBlock(s: string): Citation[] {
  const out: Citation[] = [];

  // "- Title — https://..."
  for (const line of s.split("\n")) {
    const m = line.trim().match(/^-+\s*(.+?)\s+—\s+(https?:\/\/\S+)/i);
    if (m) {
      const u = normalizeUrl(m[2]);
      if (u) out.push({ title: m[1], ref_url: u });
    }
  }

  // [Title](https://...)
  const md = [...s.matchAll(/\[([^\]]{1,200})\]\((https?:\/\/[^)\s]+)\)/g)];
  for (const m of md) {
    const u = normalizeUrl(m[2]);
    if (u) out.push({ title: m[1], ref_url: u });
  }

  // Bare URLs
  const bare = [...s.matchAll(/(?<!\()(?<!")\bhttps?:\/\/[^\s)]+/g)];
  for (const m of bare) {
    const u = normalizeUrl(m[0]);
    if (u) out.push({ ref_url: u });
  }

  // Dedup by URL
  const seen = new Set<string>();
  return out.filter(c => {
    if (!c.ref_url) return false;
    if (seen.has(c.ref_url)) return false;
    seen.add(c.ref_url);
    return true;
  });
}
