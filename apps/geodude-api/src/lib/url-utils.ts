/**
 * URL utilities for content asset management and normalization
 */

/**
 * Normalize URL for content asset creation
 * - Lower-case host, keep scheme
 * - Strip fragments, UTM/known tracking params
 * - Collapse duplicate slashes
 * - Keep trailing slash for directories
 */
export function normalizeUrlForAsset(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    const urlObj = new URL(url);
    
    // Normalize hostname (lowercase, strip www)
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    // Build normalized URL
    const normalized = new URL(url);
    normalized.hostname = hostname;
    
    // Remove fragment
    normalized.hash = '';
    
    // Remove UTM and known tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'ref', 'source', 'campaign',
      'mc_cid', 'mc_eid', 'mc_tc', 'mc_rid', 'mc_oid',
      'yclid', 'zanpid', 'zanpid', 'zanpid', 'zanpid'
    ];
    
    trackingParams.forEach(param => {
      normalized.searchParams.delete(param);
    });
    
    // Collapse duplicate slashes in pathname
    let pathname = normalized.pathname;
    pathname = pathname.replace(/\/+/g, '/');
    
    // Keep trailing slash for root and directory-like paths
    if (pathname === '' || pathname.endsWith('/') || pathname.includes('.')) {
      // Keep as is
    } else {
      // Add trailing slash for directory-like paths
      pathname += '/';
    }
    
    normalized.pathname = pathname;
    
    return normalized.toString();
  } catch (error) {
    // If URL parsing fails, return the original string
    console.warn('Failed to normalize URL:', url, error);
    return url;
  }
}

/**
 * Extract domain from URL for property matching
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch {
    return null;
  }
}

/**
 * Check if URL is likely a directory (ends with / or no file extension)
 */
export function isDirectoryUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Ends with slash
    if (pathname.endsWith('/')) {
      return true;
    }
    
    // No file extension in pathname
    const lastSegment = pathname.split('/').pop() || '';
    if (!lastSegment.includes('.')) {
      return true;
    }
    
    // Common directory indicators
    const directoryIndicators = ['index', 'default', 'home', 'main'];
    if (directoryIndicators.some(indicator => lastSegment.toLowerCase().includes(indicator))) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Generate a content type based on URL patterns
 */
export function inferContentType(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    // File extensions
    if (pathname.includes('.html') || pathname.includes('.htm')) return 'page';
    if (pathname.includes('.pdf')) return 'document';
    if (pathname.includes('.jpg') || pathname.includes('.jpeg') || pathname.includes('.png') || pathname.includes('.gif')) return 'image';
    if (pathname.includes('.mp4') || pathname.includes('.avi') || pathname.includes('.mov')) return 'video';
    if (pathname.includes('.mp3') || pathname.includes('.wav')) return 'audio';
    
    // Path patterns
    if (pathname.includes('/blog/') || pathname.includes('/post/') || pathname.includes('/article/')) return 'article';
    if (pathname.includes('/product/') || pathname.includes('/item/')) return 'product';
    if (pathname.includes('/category/') || pathname.includes('/tag/')) return 'category';
    if (pathname.includes('/author/') || pathname.includes('/profile/')) return 'profile';
    
    // Default to page
    return 'page';
  } catch {
    return 'page';
  }
}
