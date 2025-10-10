/**
 * Utility functions for Phase F+
 */

/**
 * Remove duplicate items from array
 */
export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Clamp a number between min and max
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Extract pathname from URL, normalized
 */
export function extractPathname(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '/';
  }
}

/**
 * Normalize URL for comparison (strip utm params, tracking, etc.)
 */
export function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    // Strip common tracking params
    const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'msclkid'];
    paramsToRemove.forEach(param => url.searchParams.delete(param));
    
    // Normalize hostname (remove www)
    url.hostname = url.hostname.replace(/^www\./, '');
    
    // Remove trailing slash
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    
    return url.toString();
  } catch {
    return urlString;
  }
}

/**
 * Simple concurrency limiter (p-limit style)
 */
export function pLimit(concurrency: number) {
  const queue: Array<{ fn: () => Promise<any>; resolve: (val: any) => void; reject: (err: any) => void }> = [];
  let activeCount = 0;

  const next = () => {
    if (activeCount < concurrency && queue.length > 0) {
      activeCount++;
      const { fn, resolve, reject } = queue.shift()!;
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeCount--;
          next();
        });
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

