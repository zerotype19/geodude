/**
 * Enhanced HTML analysis for v2.1 scoring system
 */

import { parseHTML } from "linkedom";
import { AnalysisExtract } from "../types/audit";

export function analyzeHtmlV21(url: string, html: string): AnalysisExtract {
  const { document } = parseHTML(html);

  const title = document.querySelector("title")?.textContent?.trim() || "";
  const h1 = document.querySelector("h1")?.textContent?.trim() || "";

  const canonical_url = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  const robots_meta = document.querySelector('meta[name="robots"]')?.getAttribute("content") || null;

  const textContent = document.body?.textContent || "";
  const word_count = (textContent.trim().match(/\S+/g) || []).length;

  // JSON-LD analysis
  const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const schema_types = new Set<string>();
  let faq_schema_present = false;
  let author: string | null = null;
  let date_published: string | null = null;
  let date_modified: string | null = null;

  for (const s of jsonLdScripts) {
    try {
      const data = JSON.parse(s.textContent || "");
      if (!data) continue;
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const t = node["@type"];
        if (typeof t === "string") schema_types.add(t);
        if (Array.isArray(t)) t.forEach((x) => schema_types.add(String(x)));

        if (t === "FAQPage") faq_schema_present = true;
        if (node?.author?.name) author = node.author.name;
        if (node?.datePublished) date_published = node.datePublished;
        if (node?.dateModified) date_modified = node.dateModified;
      }
    } catch (error) {
      // Ignore malformed JSON-LD
      console.warn(`[AnalyzeV21] Malformed JSON-LD on ${url}:`, error);
    }
  }

  const headings_h2 = document.querySelectorAll("h2").length;
  const headings_h3 = document.querySelectorAll("h3").length;

  // Outbound links analysis
  const aTags = Array.from(document.querySelectorAll("a[href]"))
    .map(a => {
      try {
        return new URL(a.getAttribute("href")!, url).toString();
      } catch {
        return null;
      }
    })
    .filter(Boolean) as string[];
  
  const outbound_domains = new Set(aTags.map(u => {
    try {
      return new URL(u).hostname;
    } catch {
      return null;
    }
  }).filter(Boolean)).size;

  return {
    url,
    canonical_url: canonical_url ? new URL(canonical_url, url).toString() : null,
    status: 200, // pass actual status from crawl
    title,
    h1,
    meta_description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
    word_count,
    robots_meta,
    has_jsonld: jsonLdScripts.length > 0,
    schema_types: Array.from(schema_types),
    faq_schema_present,
    author,
    date_published,
    date_modified,
    headings_h2,
    headings_h3,
    outbound_links: aTags.length,
    outbound_domains,
    https_ok: url.startsWith("https://"),
    load_time_ms: null // Will be populated from crawl data
  };
}
