/**
 * Cold-start signal extraction for industry classification
 * Fetches and parses HTML, JSON-LD, and navigation terms from a domain
 */

export async function fetchColdStartHtml(
  host: string, 
  timeoutMs = 3000, 
  maxBytes = 512_000
): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  
  try {
    const res = await fetch(`https://${host}/`, { 
      signal: ctrl.signal, 
      headers: { 
        "Accept": "text/html",
        "User-Agent": "OptiviewAuditBot/1.0 (+https://optiview.ai/bot; admin@optiview.ai)"
      } 
    });
    
    const reader = res.body?.getReader();
    if (!reader) return "";
    
    let received = 0;
    let chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) break;
      chunks.push(value);
    }
    
    const html = new TextDecoder().decode(concat(chunks));
    return html;
  } catch (error) {
    console.warn(`[COLD_START] Failed to fetch ${host}:`, error);
    return "";
  } finally {
    clearTimeout(t);
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

export function extractJsonLd(html: string): any[] {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  return blocks.flatMap(b => {
    try {
      const j = JSON.parse(b[1]);
      return Array.isArray(j) ? j : [j];
    } catch {
      return [];
    }
  });
}

export function extractNavTerms(html: string): string[] {
  const navMatches = [...html.matchAll(/<(nav|a)[^>]*>(.*?)<\/\1>/gis)].map(m => m[2]);
  return navMatches
    .map(s => s.replace(/<[^>]+>/g, " ").toLowerCase())
    .flatMap(s => s.split(/[^a-z0-9+]+/))
    .filter(w => w && w.length > 2)
    .slice(0, 50);
}

