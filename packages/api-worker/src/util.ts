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

/**
 * Phase F++ Gap #6: Fuzzy text matching utilities
 */

/**
 * Tokenize text for comparison (lowercase, split, remove stopwords)
 */
export function tokenize(text: string): Set<string> {
  const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were']);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !stopwords.has(t))
  );
}

/**
 * Jaccard similarity between two token sets (0-1)
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Simple Levenshtein distance (edit distance)
 */
export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Normalized Levenshtein similarity (0-1, higher is better)
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - (levenshtein(a, b) / maxLen);
}

/**
 * Combined fuzzy text similarity (weighted average of Jaccard + Levenshtein)
 */
export function fuzzyTextSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  const jaccardScore = jaccardSimilarity(tokensA, tokensB);
  const levenScore = levenshteinSimilarity(a.toLowerCase(), b.toLowerCase());
  
  // Weight Jaccard higher for longer texts, Levenshtein for shorter
  const avgLen = (a.length + b.length) / 2;
  const jaccardWeight = avgLen > 50 ? 0.7 : 0.4;
  const levenWeight = 1 - jaccardWeight;
  
  return jaccardScore * jaccardWeight + levenScore * levenWeight;
}

