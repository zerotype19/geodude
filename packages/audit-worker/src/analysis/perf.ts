/**
 * Performance Metrics Collection (CWV via Browser Rendering)
 * 
 * Collects Core Web Vitals:
 * - LCP (Largest Contentful Paint)
 * - CLS (Cumulative Layout Shift)
 * - FID (First Input Delay) - proxy via INP
 * 
 * Sampling:
 * - If total pages ≤ 50: test ALL
 * - If total pages > 50: test top 100 by link centrality
 */

export interface PerfMetrics {
  lcp_ms: number | null;
  cls: number | null;
  fid_ms: number | null;
  ttfb_ms?: number;
  fcp_ms?: number;
}

export interface PerfResult {
  metrics: PerfMetrics;
  success: boolean;
  error?: string;
}

/**
 * Capture performance metrics from browser rendering session
 * 
 * @param page - Puppeteer page instance
 * @param timeout - Timeout in ms (default 10s)
 */
export async function capturePerformanceMetrics(
  page: any,  // Puppeteer Page
  timeout: number = 10000
): Promise<PerfResult> {
  try {
    // Wait for page to be mostly loaded
    await page.waitForLoadState('domcontentloaded', { timeout: timeout / 2 });

    // Inject performance observer script
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const result: any = {
          lcp_ms: null,
          cls: null,
          fid_ms: null,
          ttfb_ms: null,
          fcp_ms: null
        };

        // LCP Observer
        let lcpValue = 0;
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          lcpValue = lastEntry.renderTime || lastEntry.loadTime;
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

        // CLS Observer
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });

        // FID/INP proxy - measure first click delay
        let fidValue: number | null = null;
        const handleFirstInput = (event: PerformanceEventTiming) => {
          if (fidValue === null) {
            fidValue = event.processingStart - event.startTime;
          }
        };
        
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            handleFirstInput(entry as any);
          }
        });
        fidObserver.observe({ type: 'first-input', buffered: true });

        // Navigation Timing for TTFB and FCP
        const navTiming = performance.getEntriesByType('navigation')[0] as any;
        if (navTiming) {
          result.ttfb_ms = navTiming.responseStart - navTiming.requestStart;
        }

        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
        if (fcpEntry) {
          result.fcp_ms = fcpEntry.startTime;
        }

        // Wait a bit for metrics to stabilize
        setTimeout(() => {
          result.lcp_ms = lcpValue > 0 ? Math.round(lcpValue) : null;
          result.cls = clsValue > 0 ? Math.round(clsValue * 1000) / 1000 : null;
          result.fid_ms = fidValue !== null ? Math.round(fidValue) : null;
          
          lcpObserver.disconnect();
          clsObserver.disconnect();
          fidObserver.disconnect();
          
          resolve(result);
        }, 2000);  // Wait 2s for metrics to collect
      });
    });

    return {
      metrics: metrics as PerfMetrics,
      success: true
    };
  } catch (error) {
    console.error('[Perf] Error capturing metrics:', error);
    return {
      metrics: {
        lcp_ms: null,
        cls: null,
        fid_ms: null
      },
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Determine which pages should be sampled for performance testing
 * 
 * @param allPages - All crawled pages
 * @param linkGraph - Optional link graph for centrality calculation
 * @returns Array of page URLs to test
 */
export function selectPagesForPerfTesting(
  allPages: Array<{ url: string; depth?: number; links_in?: number }>,
  linkGraph?: Map<string, { links_in: number }>
): string[] {
  const MAX_PERF_PAGES = 100;
  const SMALL_SITE_THRESHOLD = 50;

  // If site is small, test all pages
  if (allPages.length <= SMALL_SITE_THRESHOLD) {
    return allPages.map(p => p.url);
  }

  // For larger sites, prioritize by:
  // 1. Link centrality (pages with most inbound links)
  // 2. URL depth (prefer shallower pages)
  // 3. Homepage always included

  const scored = allPages.map(page => {
    const centralityScore = linkGraph?.get(page.url)?.links_in || page.links_in || 0;
    const depthScore = page.depth !== undefined ? (10 - Math.min(10, page.depth)) : 5;
    const isHomepage = page.url === '/' || page.url.endsWith('/') && page.url.split('/').length <= 4;
    
    return {
      url: page.url,
      score: (centralityScore * 2) + depthScore + (isHomepage ? 100 : 0)
    };
  });

  // Sort by score descending and take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_PERF_PAGES).map(p => p.url);
}

/**
 * Check if performance metrics are within acceptable thresholds
 */
export function evaluatePerformance(metrics: PerfMetrics): {
  lcp_rating: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  cls_rating: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  fid_rating: 'good' | 'needs-improvement' | 'poor' | 'unknown';
} {
  // Google's CWV thresholds
  const lcp_rating = 
    metrics.lcp_ms === null ? 'unknown' :
    metrics.lcp_ms <= 2500 ? 'good' :
    metrics.lcp_ms <= 4000 ? 'needs-improvement' : 'poor';

  const cls_rating =
    metrics.cls === null ? 'unknown' :
    metrics.cls <= 0.1 ? 'good' :
    metrics.cls <= 0.25 ? 'needs-improvement' : 'poor';

  const fid_rating =
    metrics.fid_ms === null ? 'unknown' :
    metrics.fid_ms <= 100 ? 'good' :
    metrics.fid_ms <= 300 ? 'needs-improvement' : 'poor';

  return { lcp_rating, cls_rating, fid_rating };
}

/**
 * Log performance outliers for monitoring
 */
export function logPerformanceOutliers(url: string, metrics: PerfMetrics): void {
  const ratings = evaluatePerformance(metrics);

  if (ratings.lcp_rating === 'poor' || ratings.cls_rating === 'poor' || ratings.fid_rating === 'poor') {
    console.warn(`[Perf Outlier] ${url}`, {
      lcp: `${metrics.lcp_ms}ms (${ratings.lcp_rating})`,
      cls: `${metrics.cls} (${ratings.cls_rating})`,
      fid: `${metrics.fid_ms}ms (${ratings.fid_rating})`
    });
  }
}

