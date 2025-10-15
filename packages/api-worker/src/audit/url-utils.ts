/**
 * URL normalization and filtering utilities for crawl frontier
 */

export function normalizeUrl(raw: string, origin: string): string | null {
  try {
    const u = new URL(raw, origin);
    const o = new URL(origin);
    
    // Allow apex↔www and http↔https so BFS can expand
    const stripWww = (h: string) => h.replace(/^www\./i, '');
    if (stripWww(u.hostname) !== stripWww(o.hostname)) return null;

    u.hash = '';
    
    // Enhanced tracking params removal
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'ref', 'source', 'campaign', 'mc_cid', 'mc_eid',
      'affiliate_id', 'clickid', 'medium', 'content', 'term'
    ];
    trackingParams.forEach(k => u.searchParams.delete(k));
    
    // Normalize trailing slashes consistently (keep trailing slash for root, remove for paths)
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    
    // Lowercase host only (do NOT lowercase path)
    u.hostname = u.hostname.toLowerCase();
    
    // Collapse index.html to / where safe
    if (u.pathname.endsWith('/index.html') || u.pathname === '/index.html') {
      u.pathname = u.pathname.replace(/\/index\.html$/, '/');
    }
    
    return u.toString();
  } catch { 
    return null; 
  }
}

export function isInternal(raw: string, origin: string): boolean {
  try { 
    const target = new URL(raw, origin);
    const base = new URL(origin);
    
    // Allow apex<->www and http<->https so BFS can expand
    const stripWww = (h: string) => h.replace(/^www\./i, '');
    return stripWww(target.hostname) === stripWww(base.hostname);
  } catch { 
    return false; 
  }
}

export function extractLinks(html: string): string[] {
  const links: string[] = [];
  
  // More comprehensive regex to extract href attributes
  // Handle both single and double quotes, and various spacing
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
  let match;
  
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1].trim();
    if (href && 
        !href.startsWith('#') && 
        !href.startsWith('mailto:') && 
        !href.startsWith('tel:') &&
        !href.startsWith('javascript:') &&
        !href.startsWith('data:') &&
        href.length > 0) {
      links.push(href);
    }
  }
  
  // Also try to extract from src attributes (for some navigation patterns)
  const srcRegex = /src\s*=\s*["']([^"']+)["']/gi;
  while ((match = srcRegex.exec(html)) !== null) {
    const src = match[1].trim();
    if (src && 
        !src.startsWith('#') && 
        !src.startsWith('mailto:') && 
        !src.startsWith('tel:') &&
        !src.startsWith('javascript:') &&
        !src.startsWith('data:') &&
        src.length > 0 &&
        (src.endsWith('.html') || src.endsWith('.htm') || src.includes('/'))) {
      links.push(src);
    }
  }
  
  return [...new Set(links)]; // Remove duplicates
}

export function isValidPageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    
    // Skip common non-page resources
    const skipExtensions = [
      '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.pdf',
      '.zip', '.doc', '.docx', '.xls', '.xlsx', '.mp4', '.mp3', '.wav'
    ];
    
    const pathname = u.pathname.toLowerCase();
    if (skipExtensions.some(ext => pathname.endsWith(ext))) {
      return false;
    }
    
    // Skip API endpoints and admin areas
    if (pathname.includes('/api/') || pathname.includes('/admin/') || pathname.includes('/wp-admin/')) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}
