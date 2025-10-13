/**
 * Performance Detector - Phase Next
 * Analyzes Core Web Vitals and performance metrics
 */

export interface PerformanceResult {
  score: number; // 0-100
  lcp: number; // Largest Contentful Paint (ms)
  inp: number; // Interaction to Next Paint (ms)
  cls: number; // Cumulative Layout Shift
  breakdown: {
    lcp: { score: number; value: number; threshold: number };
    inp: { score: number; value: number; threshold: number };
    cls: { score: number; value: number; threshold: number };
  };
}

export interface PerformanceMetrics {
  lcp?: number;
  inp?: number;
  cls?: number;
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
  loadTime?: number;
}

export function analyzePerformance(
  metrics: PerformanceMetrics,
  loadTime?: number
): PerformanceResult {
  // Use provided metrics or estimate from load time
  const lcp = metrics.lcp || estimateLCP(loadTime);
  const inp = metrics.inp || estimateINP(loadTime);
  const cls = metrics.cls || 0.1; // Default assumption
  
  // Calculate scores based on Core Web Vitals thresholds
  const lcpScore = calculateLCPScore(lcp);
  const inpScore = calculateINPScore(inp);
  const clsScore = calculateCLSScore(cls);
  
  // Overall score (weighted average)
  const overallScore = (lcpScore + inpScore + clsScore) / 3;
  
  return {
    score: Math.round(overallScore * 100) / 100,
    lcp,
    inp,
    cls,
    breakdown: {
      lcp: { score: lcpScore, value: lcp, threshold: 2500 },
      inp: { score: inpScore, value: inp, threshold: 200 },
      cls: { score: clsScore, value: cls, threshold: 0.1 }
    }
  };
}

function calculateLCPScore(lcp: number): number {
  // LCP thresholds: Good ≤ 2.5s, Needs Improvement ≤ 4.0s, Poor > 4.0s
  if (lcp <= 2500) return 100;
  if (lcp <= 4000) return 100 - ((lcp - 2500) / 1500) * 50; // Linear decay
  return Math.max(0, 50 - ((lcp - 4000) / 1000) * 50); // Further decay
}

function calculateINPScore(inp: number): number {
  // INP thresholds: Good ≤ 200ms, Needs Improvement ≤ 500ms, Poor > 500ms
  if (inp <= 200) return 100;
  if (inp <= 500) return 100 - ((inp - 200) / 300) * 50; // Linear decay
  return Math.max(0, 50 - ((inp - 500) / 500) * 50); // Further decay
}

function calculateCLSScore(cls: number): number {
  // CLS thresholds: Good ≤ 0.1, Needs Improvement ≤ 0.25, Poor > 0.25
  if (cls <= 0.1) return 100;
  if (cls <= 0.25) return 100 - ((cls - 0.1) / 0.15) * 50; // Linear decay
  return Math.max(0, 50 - ((cls - 0.25) / 0.25) * 50); // Further decay
}

function estimateLCP(loadTime?: number): number {
  if (!loadTime) return 3000; // Default assumption
  
  // Rough estimation: LCP is typically 60-80% of total load time
  return loadTime * 0.7;
}

function estimateINP(loadTime?: number): number {
  if (!loadTime) return 300; // Default assumption
  
  // Rough estimation: INP is typically 20-40% of total load time
  return loadTime * 0.3;
}

// Helper function to simulate Lighthouse-lite performance testing
export async function simulatePerformanceTest(
  url: string,
  options?: {
    timeout?: number;
    throttling?: 'slow' | 'normal' | 'fast';
  }
): Promise<PerformanceMetrics> {
  const startTime = Date.now();
  
  try {
    // Simulate page load with different throttling profiles
    const throttling = options?.throttling || 'normal';
    const multiplier = getThrottlingMultiplier(throttling);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 * multiplier));
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(options?.timeout || 10000)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const loadTime = Date.now() - startTime;
    
    // Estimate metrics based on load time and content
    return {
      lcp: estimateLCP(loadTime),
      inp: estimateINP(loadTime),
      cls: estimateCLS(html),
      fcp: loadTime * 0.3,
      ttfb: loadTime * 0.1,
      loadTime
    };
  } catch (error) {
    // Return poor metrics on error
    return {
      lcp: 5000,
      inp: 1000,
      cls: 0.5,
      fcp: 3000,
      ttfb: 2000,
      loadTime: Date.now() - startTime
    };
  }
}

function getThrottlingMultiplier(throttling: string): number {
  switch (throttling) {
    case 'slow': return 3;
    case 'normal': return 1;
    case 'fast': return 0.5;
    default: return 1;
  }
}

function estimateCLS(html: string): number {
  // Simple heuristic: count potential layout shift causes
  const shiftCauses = [
    /<img[^>]*(?:width|height)=["']\d+["'][^>]*>/gi,
    /<iframe[^>]*>/gi,
    /<video[^>]*>/gi,
    /<canvas[^>]*>/gi
  ];
  
  let shiftScore = 0;
  for (const pattern of shiftCauses) {
    const matches = html.match(pattern) || [];
    shiftScore += matches.length * 0.02; // Each element adds 0.02 to CLS
  }
  
  // Check for missing dimensions on images
  const imagesWithoutDimensions = (html.match(/<img(?![^>]*(?:width|height)=["']\d+["'])[^>]*>/gi) || []).length;
  shiftScore += imagesWithoutDimensions * 0.05;
  
  return Math.min(1.0, shiftScore);
}
