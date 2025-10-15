/**
 * HTML Analysis Extractor
 * Extracts schema, H1, E-E-A-T, and SEO elements from HTML
 */

export function analyzeHtml(html: string) {
  // Performance caps to keep analysis under ~75-100ms/page
  const MAX_HTML_SIZE = 1.5 * 1024 * 1024; // 1.5MB cap
  const MAX_JSON_LD_NODES = 8;
  
  // Cap HTML size if too large
  if (html.length > MAX_HTML_SIZE) {
    html = html.slice(0, MAX_HTML_SIZE);
  }
  
  // Remove script/style blocks to speed up regex passes
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Very forgiving parser: DOMParser if available; fallback regex for essentials
  const toText = (s?: string) => (s ?? '').trim().replace(/\s+/g, ' ').slice(0, 8000);

  // 1) Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = toText(titleMatch?.[1]);

  // 2) Meta description
  const md = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const metaDescription = toText(md?.[1]);

  // 3) Canonical
  const canon = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const canonical = canon?.[1]?.trim();

  // 4) Robots meta
  const robots = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  const robotsMeta = robots?.[1]?.trim();

  // 5) H1(s)
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => toText(m[1]));
  const h1 = h1s[0] ?? '';
  const h1Count = h1s.length;

  // 6) Headings H2/H3 counts (quick)
  const h2 = (html.match(/<h2\b/gi) || []).length;
  const h3 = (html.match(/<h3\b/gi) || []).length;

  // 7) Images
  const images = (html.match(/<img\b/gi) || []).length;

  // 8) Outbound links (rough, unique hosts)
  const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)].map(m => m[1]);
  const outboundLinks = new Set(
    links
      .filter(h => /^https?:\/\//i.test(h))
      .map(h => { try { return new URL(h).host; } catch { return null; } })
      .filter(Boolean)
  ).size;

  // 9) JSON-LD types + author/dates
  const schemas = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .slice(0, MAX_JSON_LD_NODES) // cap for performance
    .flatMap(m => {
      try {
        const node = JSON.parse(m[1]);
        const arr = Array.isArray(node) ? node : [node];
        return arr;
      } catch { return []; }
    });

  const schemaTypes = new Set<string>();
  let author = '';
  let datePublished = '';
  let dateModified = '';

  for (const s of schemas) {
    const t = (s['@type'] || s['type']);
    if (t) (Array.isArray(t) ? t : [t]).forEach((tt: string) => schemaTypes.add(String(tt)));
    if (s.author) author ||= (typeof s.author === 'string' ? s.author : s.author.name || '');
    if (s.datePublished) datePublished ||= s.datePublished;
    if (s.dateModified) dateModified ||= s.dateModified;
  }

  // 10) E-E-A-T heuristic flags
  const eeat: string[] = [];
  if (author) eeat.push('HAS_AUTHOR');
  if (h1Count > 1) eeat.push('MULTI_H1');
  if (images >= 3) eeat.push('HAS_MEDIA');
  if (outboundLinks >= 3) eeat.push('HAS_CITATIONS');
  if (dateModified || datePublished) eeat.push('HAS_DATES');
  if (robotsMeta && robotsMeta.toLowerCase().includes('noindex')) eeat.push('ROBOTS_NOINDEX');

  return {
    title, metaDescription, canonical, robotsMeta,
    h1, h1Count, headings_h2: h2, headings_h3: h3,
    images, outbound_links: outboundLinks,
    schema_types: [...schemaTypes].join(','),
    author, date_published: datePublished, date_modified: dateModified,
    eeat_flags: eeat.join(',')
  };
}
