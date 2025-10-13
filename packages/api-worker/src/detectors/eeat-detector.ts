/**
 * E-E-A-T Detector - Phase Next
 * Analyzes Experience, Expertise, Authority, and Trust signals
 */

export interface EEATResult {
  experience: number; // 0-100
  expertise: number; // 0-100
  authority: number; // 0-100
  trust: number; // 0-100
  overall: number; // 0-100
  breakdown: {
    experience: {
      originalImages: number;
      methodsPhrasing: boolean;
      uniqueDocImages: number;
    };
    expertise: {
      personSchema: boolean;
      sameAsLinks: number;
      topicalFocus: number;
    };
    authority: {
      mvaScore: number;
      internalHub: boolean;
      inboundLinks: number;
    };
    trust: {
      aboutPage: boolean;
      contactPage: boolean;
      licensing: boolean;
      hsts: boolean;
      canonicalSanity: boolean;
      freshness: number;
    };
  };
}

export function analyzeEEAT(
  html: string,
  url: string,
  title?: string,
  h1?: string,
  mvaScore?: number
): EEATResult {
  const experience = analyzeExperience(html);
  const expertise = analyzeExpertise(html, url);
  const authority = analyzeAuthority(html, url, mvaScore);
  const trust = analyzeTrust(html, url);
  
  const overall = (experience + expertise + authority + trust) / 4;
  
  return {
    experience,
    expertise,
    authority,
    trust,
    overall: Math.round(overall * 100) / 100,
    breakdown: {
      experience: experience.breakdown,
      expertise: expertise.breakdown,
      authority: authority.breakdown,
      trust: trust.breakdown
    }
  };
}

function analyzeExperience(html: string): { score: number; breakdown: any } {
  let score = 0;
  const breakdown = {
    originalImages: 0,
    methodsPhrasing: false,
    uniqueDocImages: 0
  };
  
  // Original images heuristic (40 points)
  const images = extractImages(html);
  const originalImages = images.filter(img => 
    !img.src.includes('stock') && 
    !img.src.includes('placeholder') &&
    !img.src.includes('unsplash') &&
    !img.src.includes('pixabay')
  );
  breakdown.originalImages = originalImages.length;
  score += Math.min(40, originalImages.length * 5);
  
  // Methods/our test phrasing (30 points)
  const methodsPhrases = [
    'our test', 'we tested', 'our research', 'our study',
    'we found', 'our analysis', 'we discovered'
  ];
  const lowerHtml = html.toLowerCase();
  breakdown.methodsPhrasing = methodsPhrases.some(phrase => 
    lowerHtml.includes(phrase)
  );
  if (breakdown.methodsPhrasing) {
    score += 30;
  }
  
  // Unique document images (30 points)
  const docImages = images.filter(img => 
    img.src.includes('screenshot') || 
    img.src.includes('diagram') ||
    img.src.includes('chart') ||
    img.src.includes('graph')
  );
  breakdown.uniqueDocImages = docImages.length;
  score += Math.min(30, docImages.length * 3);
  
  return { score: Math.min(100, score), breakdown };
}

function analyzeExpertise(html: string, url: string): { score: number; breakdown: any } {
  let score = 0;
  const breakdown = {
    personSchema: false,
    sameAsLinks: 0,
    topicalFocus: 0
  };
  
  // Person schema with sameAs (40 points)
  const personSchemas = extractPersonSchemas(html);
  if (personSchemas.length > 0) {
    breakdown.personSchema = true;
    score += 20;
    
    // Check for sameAs links
    const sameAsLinks = personSchemas.flatMap(schema => 
      schema.sameAs || []
    );
    breakdown.sameAsLinks = sameAsLinks.length;
    score += Math.min(20, sameAsLinks.length * 5);
  }
  
  // Site topical focus (40 points)
  const topicalFocus = analyzeTopicalFocus(html, url);
  breakdown.topicalFocus = topicalFocus;
  score += Math.min(40, topicalFocus * 2);
  
  return { score: Math.min(100, score), breakdown };
}

function analyzeAuthority(html: string, url: string, mvaScore?: number): { score: number; breakdown: any } {
  let score = 0;
  const breakdown = {
    mvaScore: mvaScore || 0,
    internalHub: false,
    inboundLinks: 0
  };
  
  // MVA score (50 points)
  if (mvaScore !== undefined) {
    breakdown.mvaScore = mvaScore;
    score += (mvaScore / 100) * 50;
  }
  
  // Internal hub prominence (30 points)
  const internalLinks = extractInternalLinks(html, url);
  breakdown.inboundLinks = internalLinks.length;
  if (internalLinks.length > 5) {
    breakdown.internalHub = true;
    score += 30;
  }
  
  // Domain authority signals (20 points)
  const domainSignals = analyzeDomainAuthority(html);
  score += Math.min(20, domainSignals * 5);
  
  return { score: Math.min(100, score), breakdown };
}

function analyzeTrust(html: string, url: string): { score: number; breakdown: any } {
  let score = 0;
  const breakdown = {
    aboutPage: false,
    contactPage: false,
    licensing: false,
    hsts: false,
    canonicalSanity: false,
    freshness: 0
  };
  
  // About/Contact pages (25 points)
  const aboutContactLinks = extractAboutContactLinks(html);
  if (aboutContactLinks.about) {
    breakdown.aboutPage = true;
    score += 15;
  }
  if (aboutContactLinks.contact) {
    breakdown.contactPage = true;
    score += 10;
  }
  
  // Licensing text (20 points)
  const licensingText = [
    'copyright', 'license', 'terms of use', 'privacy policy',
    'all rights reserved', 'creative commons'
  ];
  const lowerHtml = html.toLowerCase();
  breakdown.licensing = licensingText.some(text => 
    lowerHtml.includes(text)
  );
  if (breakdown.licensing) {
    score += 20;
  }
  
  // HSTS (15 points)
  // Note: This would need to be checked via headers, not HTML
  // For now, we'll assume it's present if not explicitly blocked
  breakdown.hsts = true;
  score += 15;
  
  // Canonical sanity (20 points)
  const canonicalUrl = extractCanonicalUrl(html);
  if (canonicalUrl && isCanonicalSane(canonicalUrl, url)) {
    breakdown.canonicalSanity = true;
    score += 20;
  }
  
  // Freshness (20 points)
  const freshness = analyzeFreshness(html);
  breakdown.freshness = freshness;
  score += Math.min(20, freshness * 2);
  
  return { score: Math.min(100, score), breakdown };
}

function extractImages(html: string): Array<{ src: string; alt?: string }> {
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  const images: Array<{ src: string; alt?: string }> = [];
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    images.push({
      src: match[1],
      alt: match[2]
    });
  }
  
  return images;
}

function extractPersonSchemas(html: string): Array<{ sameAs?: string[] }> {
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
  const personSchemas: Array<{ sameAs?: string[] }> = [];
  let match;
  
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const schemas = Array.isArray(parsed) ? parsed : [parsed];
      
      for (const schema of schemas) {
        if (schema['@type'] === 'Person' || schema['@type']?.includes('Person')) {
          personSchemas.push({
            sameAs: schema.sameAs || []
          });
        }
      }
    } catch (error) {
      // Skip invalid JSON
      continue;
    }
  }
  
  return personSchemas;
}

function analyzeTopicalFocus(html: string, url: string): number {
  // Simple heuristic: count domain-specific keywords
  const domain = new URL(url).hostname.toLowerCase();
  const domainKeywords = domain.split('.').filter(part => part.length > 2);
  
  const content = html.replace(/<[^>]+>/g, ' ').toLowerCase();
  let focusScore = 0;
  
  for (const keyword of domainKeywords) {
    const keywordCount = (content.match(new RegExp(keyword, 'g')) || []).length;
    focusScore += keywordCount;
  }
  
  return Math.min(20, focusScore);
}

function extractInternalLinks(html: string, url: string): string[] {
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
  const links: string[] = [];
  let match;
  
  const baseDomain = new URL(url).hostname;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    try {
      const linkUrl = new URL(href, url);
      if (linkUrl.hostname === baseDomain) {
        links.push(linkUrl.href);
      }
    } catch (error) {
      // Skip invalid URLs
      continue;
    }
  }
  
  return links;
}

function analyzeDomainAuthority(html: string): number {
  const authoritySignals = [
    'established', 'founded', 'since', 'years of experience',
    'industry leader', 'trusted', 'award-winning', 'certified'
  ];
  
  const lowerHtml = html.toLowerCase();
  return authoritySignals.filter(signal => 
    lowerHtml.includes(signal)
  ).length;
}

function extractAboutContactLinks(html: string): { about: boolean; contact: boolean } {
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match;
  const result = { about: false, contact: false };
  
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].toLowerCase();
    const text = match[2].toLowerCase();
    
    if (href.includes('about') || text.includes('about')) {
      result.about = true;
    }
    if (href.includes('contact') || text.includes('contact')) {
      result.contact = true;
    }
  }
  
  return result;
}

function extractCanonicalUrl(html: string): string | null {
  const canonicalRegex = /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i;
  const match = html.match(canonicalRegex);
  return match ? match[1] : null;
}

function isCanonicalSane(canonicalUrl: string, pageUrl: string): boolean {
  try {
    const canonical = new URL(canonicalUrl);
    const page = new URL(pageUrl);
    
    // Canonical should be on same domain
    return canonical.hostname === page.hostname;
  } catch (error) {
    return false;
  }
}

function analyzeFreshness(html: string): number {
  const freshnessSignals = [
    'updated', 'modified', 'last updated', 'recently',
    'new', 'latest', 'current', '2024', '2025'
  ];
  
  const lowerHtml = html.toLowerCase();
  return freshnessSignals.filter(signal => 
    lowerHtml.includes(signal)
  ).length;
}
