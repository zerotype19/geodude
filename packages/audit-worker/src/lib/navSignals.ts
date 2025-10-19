/**
 * Universal Classification v1.0 - Nav Signals Extraction
 * Extracts navigation terms and taxonomy from HTML
 */

/**
 * Extract text from <nav> elements
 */
function extractNavText(html: string): string[] {
  const navTerms: string[] = [];
  
  // Match <nav>...</nav> blocks
  const navRegex = /<nav[^>]*>([\s\S]*?)<\/nav>/gi;
  let navMatch;
  
  while ((navMatch = navRegex.exec(html)) !== null) {
    const navContent = navMatch[1];
    
    // Extract anchor text from <a href="...">text</a>
    const anchorRegex = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let anchorMatch;
    
    while ((anchorMatch = anchorRegex.exec(navContent)) !== null) {
      const text = anchorMatch[2]
        .replace(/<[^>]+>/g, '') // Remove nested HTML tags
        .replace(/\s+/g, ' ')     // Normalize whitespace
        .trim();
      
      if (text && text.length > 0 && text.length < 50) { // Reasonable length
        navTerms.push(text);
      }
    }
  }
  
  return navTerms;
}

/**
 * Extract first-level path segments from URLs
 */
function extractPathSegments(html: string): string[] {
  const segments: string[] = [];
  
  // Match href="/path" patterns
  const hrefRegex = /href\s*=\s*["']\/([a-z0-9-]+)(?:\/|["'])/gi;
  let match;
  
  while ((match = hrefRegex.exec(html)) !== null) {
    const segment = match[1];
    if (segment && segment.length > 2 && segment.length < 30) {
      segments.push(segment);
    }
  }
  
  return segments;
}

/**
 * Normalize and deduplicate nav terms
 */
function normalizeTerms(terms: string[]): string[] {
  const normalized = terms.map(t => t.toLowerCase().trim());
  const unique = Array.from(new Set(normalized));
  
  // Filter out generic/useless terms
  const blacklist = new Set([
    'home', 'menu', 'skip', 'search', 'login', 'logout', 'sign in', 'sign up',
    'register', 'account', 'cart', 'checkout', 'more', 'view all', 'see all',
    'close', 'open', 'toggle', 'submit', 'click here', 'learn more'
  ]);
  
  return unique.filter(term => {
    if (blacklist.has(term)) return false;
    if (term.length < 3) return false; // Too short
    if (/^\d+$/.test(term)) return false; // Just numbers
    return true;
  });
}

/**
 * Main extraction function
 */
export function extractNavSignals(html: string): string[] {
  const navText = extractNavText(html);
  const pathSegments = extractPathSegments(html);
  
  // Combine and normalize
  const allTerms = [...navText, ...pathSegments];
  const normalized = normalizeTerms(allTerms);
  
  // Return top 20 terms (frequency-weighted)
  const frequency = new Map<string, number>();
  normalized.forEach(term => {
    frequency.set(term, (frequency.get(term) || 0) + 1);
  });
  
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by frequency
    .slice(0, 20)                 // Top 20
    .map(([term]) => term);
}

/**
 * Extract common navigation patterns for industry hints
 */
export function detectNavPatterns(navTerms: string[]): {
  hasCommerce: boolean;
  hasSupport: boolean;
  hasDocs: boolean;
  hasCareers: boolean;
  hasInvestors: boolean;
} {
  const terms = navTerms.join(' ').toLowerCase();
  
  return {
    hasCommerce: /\b(shop|store|products|buy|cart)\b/.test(terms),
    hasSupport: /\b(support|help|faq|contact)\b/.test(terms),
    hasDocs: /\b(docs|documentation|api|developers)\b/.test(terms),
    hasCareers: /\b(careers|jobs|hiring|opportunities)\b/.test(terms),
    hasInvestors: /\b(investors|ir|filings|earnings)\b/.test(terms)
  };
}

