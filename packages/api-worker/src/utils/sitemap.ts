/**
 * Sitemap-first URL collector with depth filtering
 */

export async function getSitemapUrls(rootUrl: string): Promise<string[]> {
  try {
    const base = new URL(rootUrl).origin;
    const candidates = [
      `${base}/sitemap.xml`,
      `${base}/sitemap_index.xml`,
      `${base}/sitemap-index.xml`
    ];
    
    for (const s of candidates) {
      const r = await fetch(s);
      if (r.ok) {
        const xml = await r.text();
        const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi))
          .map(m => m[1].trim());
        return urls;
      }
    }
  } catch (_) {
    // Ignore errors, fall back to anchor discovery
  }
  return [];
}

export function filterUrlsByDepth(urls: string[], maxDepth: number = 1): string[] {
  return urls.filter(url => {
    try {
      const { pathname } = new URL(url);
      const parts = pathname.split("/").filter(Boolean);
      return parts.length <= maxDepth;
    } catch {
      return false;
    }
  });
}

export function prioritizeFaqPages(urls: string[]): string[] {
  const faqPreferred = urls.filter(u =>
    /faq|faqs|support\/(faq|faqs)/i.test(u)
  );
  const rest = urls.filter(u => !faqPreferred.includes(u));
  return [...faqPreferred, ...rest];
}

export function uniqueUrls(urls: string[]): string[] {
  return Array.from(new Set(urls));
}
