/**
 * Scoring Model v2.0
 * Calculates AI optimization scores based on audit results
 * 
 * Weights (v2 spec-aligned):
 * - Crawlability: 40% (robots.txt, sitemap, AI bot access)
 * - Structured Data: 30% (JSON-LD coverage, FAQ site-level, schema types)
 * - Answerability: 20% (titles, H1s, content depth)
 * - Trust: 10% (HTTP status, render performance)
 */

interface AuditPage {
  url: string;
  status_code: number;
  title: string | null;
  h1: string | null;
  has_h1?: boolean;
  jsonld_count?: number;
  faq_present?: boolean;
  word_count: number;
  rendered_words?: number;
  load_time_ms: number;
  error: string | null;
}

interface AuditIssue {
  page_url: string | null;
  issue_type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string;
}

interface CrawlabilityData {
  robotsFound: boolean;
  sitemapFound: boolean;
  aiBotsAllowed: Record<string, boolean>;
}

interface StructuredData {
  siteFaqSchemaPresent: boolean;
  siteFaqPagePresent: boolean;
  schemaTypes: string[];
}

export interface Scores {
  overall: number;              // 0-100% (weighted)
  crawlability: number;         // raw points (0-42)
  structured: number;           // raw points (0-30)
  answerability: number;        // raw points (0-20)
  trust: number;                // raw points (0-10)
  crawlabilityPct: number;      // percentage (0-100%)
  structuredPct: number;        // percentage (0-100%)
  answerabilityPct: number;     // percentage (0-100%)
  trustPct: number;             // percentage (0-100%)
  breakdown: {
    crawlability: {
      robotsPresent: number;
      aiBotsAllowed: number;
      sitemapFound: number;
      successRate: number;
    };
    structured: {
      jsonLdCoverage: number;
      siteFaq: number;
      schemaVariety: number;
    };
    answerability: {
      titles: number;
      h1s: number;
      contentDepth: number;
    };
    trust: {
      httpStatus: number;
      renderPerformance: number;
    };
  };
}

export function calculateScores(
  pages: AuditPage[], 
  issues: AuditIssue[],
  crawlability?: CrawlabilityData,
  structured?: StructuredData,
  crawlersTotal30d?: number  // Phase G: real AI crawler hits
): Scores {
  // Calculate each pillar (returns points out of their max)
  const crawlabilityResult = calculateCrawlability(pages, issues, crawlability, crawlersTotal30d);
  const structuredResult = calculateStructured(pages, issues, structured);
  const answerabilityResult = calculateAnswerability(pages, issues);
  const trustResult = calculateTrust(pages, issues);

  // Convert points to percentages (0-100%)
  const crawlabilityPct = (crawlabilityResult.score / 42) * 100; // max 42 points
  const structuredPct = (structuredResult.score / 30) * 100;     // max 30 points
  const answerabilityPct = (answerabilityResult.score / 20) * 100; // max 20 points
  const trustPct = (trustResult.score / 10) * 100;               // max 10 points

  // Weighted overall score (40/30/20/10) - now using percentages
  const overall = 
    crawlabilityPct * 0.4 +
    structuredPct * 0.3 +
    answerabilityPct * 0.2 +
    trustPct * 0.1;

  return {
    overall: Math.round(overall * 100) / 100,
    crawlability: Math.round(crawlabilityResult.score * 100) / 100,
    structured: Math.round(structuredResult.score * 100) / 100,
    answerability: Math.round(answerabilityResult.score * 100) / 100,
    trust: Math.round(trustResult.score * 100) / 100,
    crawlabilityPct: Math.round(crawlabilityPct * 100) / 100,
    structuredPct: Math.round(structuredPct * 100) / 100,
    answerabilityPct: Math.round(answerabilityPct * 100) / 100,
    trustPct: Math.round(trustPct * 100) / 100,
    breakdown: {
      crawlability: crawlabilityResult.breakdown,
      structured: structuredResult.breakdown,
      answerability: answerabilityResult.breakdown,
      trust: trustResult.breakdown,
    },
  };
}

/**
 * Crawlability: 40% total
 * - robots.txt present & parseable (10%)
 * - AI bots allowed (20% total → ~3.3% each for 6 bots)
 * - Sitemap referenced in robots.txt and reachable (10%)
 * - Phase G: +2 bonus if real AI crawler hits detected (30d)
 */
function calculateCrawlability(
  pages: AuditPage[], 
  issues: AuditIssue[],
  data?: CrawlabilityData,
  crawlersTotal30d?: number  // Phase G
): { score: number; breakdown: any } {
  let score = 0;
  const breakdown = {
    robotsPresent: 0,
    aiBotsAllowed: 0,
    sitemapFound: 0,
    successRate: 0,
    realCrawlerBonus: 0,  // Phase G
  };

  // robots.txt present & parseable (10 points)
  if (data?.robotsFound) {
    score += 10;
    breakdown.robotsPresent = 10;
  }

  // AI bots allowed (20 points total)
  if (data?.aiBotsAllowed) {
    const bots = ['GPTBot', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'CCBot', 'Google-Extended'];
    const allowedCount = bots.filter(bot => data.aiBotsAllowed[bot] !== false).length;
    const botScore = (allowedCount / bots.length) * 20;
    score += botScore;
    breakdown.aiBotsAllowed = Math.round(botScore * 100) / 100;
  } else {
    // If no robots data, assume open (benefit of doubt)
    score += 20;
    breakdown.aiBotsAllowed = 20;
  }

  // Sitemap found (10 points)
  if (data?.sitemapFound) {
    score += 10;
    breakdown.sitemapFound = 10;
  }

  // Phase G: Real AI crawler bonus (+2 if any hits in last 30d)
  if ((crawlersTotal30d ?? 0) > 0) {
    score += 2;
    breakdown.realCrawlerBonus = 2;
  }

  // Success rate penalty (no additional points, but can reduce score)
  // If pages fail, reduce crawlability proportionally
  const totalPages = pages.length;
  if (totalPages > 0) {
    const successfulPages = pages.filter(p => p.status_code >= 200 && p.status_code < 400).length;
    const successRate = successfulPages / totalPages;
    breakdown.successRate = Math.round(successRate * 100);
    
    // If success rate < 80%, penalize
    if (successRate < 0.8) {
      const penalty = (0.8 - successRate) * 40; // Max 32 point penalty for 0% success
      score -= penalty;
    }
  }

  return { 
    score: Math.max(0, Math.min(42, score)), // Crawlability max is 42 points
    breakdown 
  };
}

/**
 * Structured Data: 30% total
 * - JSON-LD present on ≥X% of pages (15 points, X=50%)
 * - FAQ present somewhere on site (10 points)
 * - Schema variety: at least one of Organization/Article/Product/Breadcrumb/WebSite (5 points)
 */
function calculateStructured(
  pages: AuditPage[], 
  issues: AuditIssue[],
  data?: StructuredData
): { score: number; breakdown: any } {
  let score = 0;
  const breakdown = {
    jsonLdCoverage: 0,
    siteFaq: 0,
    schemaVariety: 0,
  };

  const totalPages = pages.length;
  if (totalPages === 0) return { score: 0, breakdown };

  // JSON-LD coverage (15 points)
  const pagesWithJsonLd = pages.filter(p => (p.jsonld_count ?? 0) > 0).length;
  const jsonLdRate = pagesWithJsonLd / totalPages;
  
  // Target is 50% minimum, scale up to 100%
  if (jsonLdRate >= 0.5) {
    const coverageScore = 15 * ((jsonLdRate - 0.5) / 0.5); // 50% = 0 points, 100% = 15 points
    score += coverageScore;
    breakdown.jsonLdCoverage = Math.round(coverageScore * 100) / 100;
  }

  // Site FAQ (10 points total)
  // Award points if EITHER page exists OR schema present
  // Full points only if both are present
  let faqScore = 0;
  if (data?.siteFaqSchemaPresent && data?.siteFaqPagePresent) {
    faqScore = 10; // Full points: both page and schema
  } else if (data?.siteFaqSchemaPresent || data?.siteFaqPagePresent) {
    faqScore = 5; // Partial points: only one present
  }
  score += faqScore;
  breakdown.siteFaq = faqScore;

  // Schema variety (5 points)
  const importantSchemas = ['Organization', 'Article', 'Product', 'BreadcrumbList', 'WebSite'];
  if (data?.schemaTypes) {
    const hasImportant = data.schemaTypes.some(type => 
      importantSchemas.some(important => type.includes(important))
    );
    if (hasImportant) {
      score += 5;
      breakdown.schemaVariety = 5;
    }
  }

  return { 
    score: Math.max(0, Math.min(30, score)), // Structured Data max is 30 points
    breakdown 
  };
}

/**
 * Answerability: 20% total
 * - Title present on ≥X% pages (7 points, X=80%)
 * - H1 present on ≥X% pages (7 points, X=80%)
 * - Content depth: words ≥120 on ≥X% pages (6 points, X=80%)
 */
function calculateAnswerability(
  pages: AuditPage[], 
  issues: AuditIssue[]
): { score: number; breakdown: any } {
  let score = 0;
  const breakdown = {
    titles: 0,
    h1s: 0,
    contentDepth: 0,
  };

  const totalPages = pages.length;
  if (totalPages === 0) return { score: 0, breakdown };

  const TARGET_COVERAGE = 0.8; // 80%

  // Title coverage (7 points)
  const pagesWithTitles = pages.filter(p => p.title && p.title.length > 0).length;
  const titleRate = pagesWithTitles / totalPages;
  if (titleRate >= TARGET_COVERAGE) {
    const titleScore = 7 * (titleRate / 1.0); // Scale to 7 points at 100%
    score += titleScore;
    breakdown.titles = Math.round(titleScore * 100) / 100;
  }

  // H1 coverage (7 points)
  const pagesWithH1 = pages.filter(p => p.has_h1 || (p.h1 && p.h1.length > 0)).length;
  const h1Rate = pagesWithH1 / totalPages;
  if (h1Rate >= TARGET_COVERAGE) {
    const h1Score = 7 * (h1Rate / 1.0);
    score += h1Score;
    breakdown.h1s = Math.round(h1Score * 100) / 100;
  }

  // Content depth (6 points)
  const pagesWithContent = pages.filter(p => (p.rendered_words ?? p.word_count ?? 0) >= 120).length;
  const contentRate = pagesWithContent / totalPages;
  if (contentRate >= TARGET_COVERAGE) {
    const contentScore = 6 * (contentRate / 1.0);
    score += contentScore;
    breakdown.contentDepth = Math.round(contentScore * 100) / 100;
  }

  return { 
    score: Math.max(0, Math.min(20, score)), // Answerability max is 20 points
    breakdown 
  };
}

/**
 * Trust: 10% total
 * - 2xx status on ≥X% pages (7 points, X=80%)
 * - Median render time under N seconds (3 points, N=3.0s)
 */
function calculateTrust(
  pages: AuditPage[], 
  issues: AuditIssue[]
): { score: number; breakdown: any } {
  let score = 0;
  const breakdown = {
    httpStatus: 0,
    renderPerformance: 0,
  };

  const totalPages = pages.length;
  if (totalPages === 0) return { score: 0, breakdown };

  const TARGET_COVERAGE = 0.8; // 80%
  const TARGET_RENDER_TIME = 3000; // 3 seconds

  // HTTP 2xx status coverage (7 points)
  const pages2xx = pages.filter(p => p.status_code >= 200 && p.status_code < 300).length;
  const statusRate = pages2xx / totalPages;
  if (statusRate >= TARGET_COVERAGE) {
    const statusScore = 7 * (statusRate / 1.0);
    score += statusScore;
    breakdown.httpStatus = Math.round(statusScore * 100) / 100;
  }

  // Render performance (3 points)
  // Calculate median render time
  const sortedTimes = pages
    .map(p => p.load_time_ms)
    .filter(t => t > 0)
    .sort((a, b) => a - b);
  
  if (sortedTimes.length > 0) {
    const medianIdx = Math.floor(sortedTimes.length / 2);
    const medianTime = sortedTimes[medianIdx];
    
    if (medianTime <= TARGET_RENDER_TIME) {
      score += 3;
      breakdown.renderPerformance = 3;
    } else if (medianTime <= TARGET_RENDER_TIME * 2) {
      // Partial credit for up to 6s
      const perfScore = 3 * (1 - (medianTime - TARGET_RENDER_TIME) / TARGET_RENDER_TIME);
      score += perfScore;
      breakdown.renderPerformance = Math.round(perfScore * 100) / 100;
    }
  }

  return { 
    score: Math.max(0, Math.min(10, score)), // Trust max is 10 points
    breakdown 
  };
}

/**
 * Calculate scores from analysis data instead of raw page data
 */
export function calculateScoresFromAnalysis(
  analysisData: any[],
  issues: AuditIssue[],
  crawlability?: CrawlabilityData,
  structured?: StructuredData,
  crawlersTotal30d?: number
): Scores {
  // Convert analysis data to page-like format for existing calculation functions
  const pages: AuditPage[] = analysisData.map((analysis: any) => ({
    url: analysis.url,
    status_code: 200, // Assume 200 for analyzed pages
    title: analysis.title,
    h1: analysis.h1,
    has_h1: (analysis.h1_count || 0) > 0,
    jsonld_count: analysis.schema_types ? analysis.schema_types.split(',').length : 0,
    faq_present: analysis.schema_types?.includes('FAQPage') || false,
    word_count: analysis.word_count || 0,
    rendered_words: analysis.word_count || 0,
    load_time_ms: 0, // Not available in analysis data
    error: null
  }));

  // Use existing calculation functions
  return calculateScores(pages, issues, crawlability, structured, crawlersTotal30d);
}
