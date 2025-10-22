/**
 * Cold-Start Context Builder
 * Builds minimal context for domains without audit/classification_v2
 * Uses homepage title, meta, H1, nav terms, and JSON-LD
 */

import { parseHTML } from '../utils/parse';

export type MinimalContext = {
  brand: string;
  site_type: string;
  industry: string;
  purpose: string;
  category_terms: string[];
  nav_terms: string[];
  lang: string;
  region: string;
  brand_kind?: string | null;
};

const USER_AGENT = "OptiviewAuditBot/1.0 (+https://optiview.ai/bot; admin@optiview.ai)";

export async function buildMinimalContext(domain: string): Promise<MinimalContext | null> {
  try {
    const url = `https://${domain.replace(/^https?:\/\//, "")}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html",
        "Accept-Language": "en-US,en;q=0.9"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000) // 8s timeout
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || domain;
    
    // Extract meta description
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = metaMatch?.[1]?.trim() || "";
    
    // Extract first H1
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const h1 = h1Match?.[1]?.trim() || "";
    
    // Extract nav terms (links in <nav> or menu elements)
    const navRegex = /<(?:nav|header)[^>]*>([\s\S]*?)<\/(?:nav|header)>/gi;
    const navMatches = [...html.matchAll(navRegex)];
    const navTerms: string[] = [];
    for (const match of navMatches.slice(0, 2)) {
      const linkMatches = match[1].matchAll(/<a[^>]*>([^<]+)<\/a>/gi);
      for (const link of linkMatches) {
        const term = link[1].trim();
        if (term && term.length > 2 && term.length < 30 && !term.match(/^\d+$/)) {
          navTerms.push(term);
        }
      }
    }
    
    // Extract JSON-LD types
    const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    const jsonLdTypes: string[] = [];
    for (const match of jsonLdMatches) {
      try {
        const json = JSON.parse(match[1]);
        const type = json["@type"] || json.type;
        if (type) jsonLdTypes.push(Array.isArray(type) ? type[0] : type);
      } catch {}
    }
    
    // Detect language
    const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
    const lang = langMatch?.[1]?.split("-")[0]?.toLowerCase() || "en";
    
    // Infer brand from title or domain
    const brand = title.split(/[|-–—]/)[0].trim() || domain.replace(/^www\./, "").replace(/\..+$/, "");
    
    // Simple heuristics for site_type and industry
    const content = (title + " " + description + " " + h1 + " " + navTerms.join(" ")).toLowerCase();
    
    let site_type = "marketing";
    let industry = "unknown";
    let purpose: "sell" | "inform" | "convert" | "assist" | "investor" = "inform";
    let brand_kind: string | null = null;
    
    // Finance/payment detection
    if (
      content.match(/\b(card|credit|debit|payment|bank|finance|loan|mortgage|insurance)\b/) ||
      jsonLdTypes.includes("BankOrCreditUnion") ||
      jsonLdTypes.includes("FinancialService")
    ) {
      industry = "finance";
      site_type = "financial";
      purpose = "convert";
      
      // Detect brand_kind for finance
      if (content.match(/\b(visa|mastercard|discover|american express|amex)\b/i)) {
        brand_kind = "network";
      } else if (content.match(/\b(bank|chase|bofa|wells fargo|citi)\b/i)) {
        brand_kind = "bank";
      }
    }
    
    // E-commerce/retail detection
    if (
      content.match(/\b(shop|buy|store|cart|checkout|product)\b/) ||
      jsonLdTypes.includes("Store") ||
      jsonLdTypes.includes("Product")
    ) {
      industry = "retail";
      site_type = "ecommerce";
      purpose = "sell";
    }
    
    // Software/SaaS detection
    if (
      content.match(/\b(api|sdk|developer|software|platform|app|integration)\b/) ||
      jsonLdTypes.includes("SoftwareApplication")
    ) {
      industry = "software";
      site_type = "saas";
      purpose = "convert";
    }
    
    // Insurance detection
    if (content.match(/\b(insurance|coverage|policy|claim|premium)\b/)) {
      industry = "insurance";
      site_type = "insurance";
      purpose = "convert";
    }
    
    // Automotive detection
    if (
      content.match(/\b(car|auto|vehicle|drive|dealer|lexus|toyota|ford|honda)\b/) ||
      jsonLdTypes.includes("Car") ||
      jsonLdTypes.includes("Vehicle")
    ) {
      industry = "automotive";
      site_type = "automotive";
      purpose = "sell";
    }
    
    // Travel detection
    if (content.match(/\b(travel|hotel|flight|booking|vacation|destination)\b/)) {
      industry = "travel";
      site_type = "travel";
      purpose = "sell";
    }
    
    // Extract category terms (top keywords from title + description)
    const words = (title + " " + description)
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 3 && w.length < 20);
    const wordFreq: Record<string, number> = {};
    for (const w of words) {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
    const stopwords = new Set(["this", "that", "with", "from", "have", "they", "about", "would", "there", "their", "what", "which"]);
    const category_terms = Object.entries(wordFreq)
      .filter(([w]) => !stopwords.has(w))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w);
    
    return {
      brand,
      site_type,
      industry,
      purpose,
      category_terms,
      nav_terms: navTerms.slice(0, 8),
      lang,
      region: "US", // Default, could be inferred from TLD or currency
      brand_kind
    };
    
  } catch (error) {
    console.error(`[COLD_START] Failed to build context for ${domain}:`, error);
    return null;
  }
}

