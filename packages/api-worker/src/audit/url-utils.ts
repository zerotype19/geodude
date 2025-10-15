/**
 * URL normalization and filtering utilities for crawl frontier
 */

export function normalizeUrl(raw: string, origin: string): string | null {
  try {
    const u = new URL(raw, origin);
    // same host only
    const o = new URL(origin);
    if (u.host !== o.host) return null;

    u.hash = '';
    // strip common tracking params
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'ref', 'source', 'campaign'
    ];
    trackingParams.forEach(k => u.searchParams.delete(k));
    
    return u.toString();
  } catch { 
    return null; 
  }
}

export function isInternal(raw: string, origin: string): boolean {
  try { 
    return new URL(raw, origin).host === new URL(origin).host; 
  } catch { 
    return false; 
  }
}

export function extractLinks(html: string): string[] {
  const links: string[] = [];
  
  // Simple regex to extract href attributes
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
  let match;
  
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      links.push(href);
    }
  }
  
  return links;
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
