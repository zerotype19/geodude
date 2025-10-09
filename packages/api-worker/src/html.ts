/**
 * HTML Parsing Utilities
 * Extract structured data, metadata, and content from HTML
 */

export function extractJSONLD(html: string): any[] {
  const blocks: any[] = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const jsonLd = JSON.parse(match[1]);
      blocks.push(jsonLd);
    } catch (e) {
      // Invalid JSON-LD, skip
    }
  }

  return blocks;
}

export function extractTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

export function extractH1(html: string): string | null {
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  return h1Match ? h1Match[1].trim() : null;
}

export function detectFAQ(html: string): boolean {
  // Check for FAQ schema
  const jsonLdBlocks = extractJSONLD(html);
  const hasFaqSchema = jsonLdBlocks.some(
    (block) => block['@type'] === 'FAQPage' || block['@type'] === 'Question'
  );

  if (hasFaqSchema) return true;

  // Check for FAQ-like patterns in HTML
  const faqPatterns = [
    /class=["'][^"']*faq[^"']*["']/i,
    /id=["'][^"']*faq[^"']*["']/i,
    /<h\d[^>]*>.*?\?.*?<\/h\d>/i, // Headings with question marks
  ];

  return faqPatterns.some((pattern) => pattern.test(html));
}

export function countWords(html: string): number {
  // Remove script and style tags
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  
  // Count words
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  
  return words.length;
}

export function extractMetaDescription(html: string): string | null {
  const descMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  return descMatch ? descMatch[1].trim() : null;
}

export function extractCanonical(html: string): string | null {
  const canonicalMatch = html.match(
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i
  );
  return canonicalMatch ? canonicalMatch[1].trim() : null;
}

export function hasValidOpenGraph(html: string): boolean {
  const ogTitle = /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i.test(html);
  const ogDescription = /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i.test(html);
  const ogImage = /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i.test(html);

  return ogTitle && ogDescription && ogImage;
}

export interface OrganizationData {
  hasOrg: boolean;
  name?: string;
  url?: string;
  sameAs?: string[];
}

export function extractOrganization(jsonLdBlocks: any[]): OrganizationData {
  // Find Organization schema
  const org = jsonLdBlocks.find((block) => block['@type'] === 'Organization');

  if (!org) {
    return { hasOrg: false };
  }

  // Extract sameAs array
  const sameAs = org.sameAs
    ? Array.isArray(org.sameAs)
      ? org.sameAs
      : [org.sameAs]
    : [];

  return {
    hasOrg: true,
    name: org.name || undefined,
    url: org.url || undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  };
}

