/**
 * Scoring Model
 * Calculates AI optimization scores based on audit results
 * 
 * Weights:
 * - Crawlability: 0.4 (robots.txt, sitemap, accessibility)
 * - Structured Data: 0.3 (JSON-LD, schema markup)
 * - Answerability: 0.2 (FAQ, clear content, word count)
 * - Trust: 0.1 (HTTPS, valid metadata, canonical)
 */

interface AuditPage {
  url: string;
  status_code: number;
  title: string | null;
  h1: string | null;
  has_json_ld: boolean;
  has_faq: boolean;
  word_count: number;
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

interface Scores {
  overall: number;
  crawlability: number;
  structured: number;
  answerability: number;
  trust: number;
}

export function calculateScores(pages: AuditPage[], issues: AuditIssue[]): Scores {
  const crawlability = calculateCrawlability(pages, issues);
  const structured = calculateStructured(pages, issues);
  const answerability = calculateAnswerability(pages, issues);
  const trust = calculateTrust(pages, issues);

  // Weighted overall score
  const overall = 
    crawlability * 0.4 +
    structured * 0.3 +
    answerability * 0.2 +
    trust * 0.1;

  return {
    overall: Math.round(overall * 100) / 100,
    crawlability: Math.round(crawlability * 100) / 100,
    structured: Math.round(structured * 100) / 100,
    answerability: Math.round(answerability * 100) / 100,
    trust: Math.round(trust * 100) / 100,
  };
}

function calculateCrawlability(pages: AuditPage[], issues: AuditIssue[]): number {
  let score = 1.0;

  // Check for robots.txt issues
  const robotsIssues = issues.filter((i) => 
    i.issue_type.startsWith('robots_')
  );
  
  if (robotsIssues.some((i) => i.severity === 'critical')) {
    score -= 0.3; // Blocking AI bots is critical
  }
  if (robotsIssues.some((i) => i.severity === 'warning')) {
    score -= 0.1;
  }

  // Check for sitemap issues
  const sitemapIssues = issues.filter((i) => 
    i.issue_type.startsWith('sitemap_')
  );
  
  if (sitemapIssues.some((i) => i.severity === 'critical')) {
    score -= 0.2;
  }
  if (sitemapIssues.some((i) => i.severity === 'warning')) {
    score -= 0.1;
  }

  // Page accessibility
  const totalPages = pages.length;
  const successfulPages = pages.filter((p) => p.status_code === 200).length;
  
  if (totalPages > 0) {
    const successRate = successfulPages / totalPages;
    score *= successRate; // Penalize based on failure rate
  }

  // Slow pages
  const avgLoadTime = pages.reduce((sum, p) => sum + p.load_time_ms, 0) / totalPages;
  if (avgLoadTime > 3000) {
    score -= 0.1; // Pages slower than 3s
  }

  return Math.max(0, Math.min(1, score));
}

function calculateStructured(pages: AuditPage[], issues: AuditIssue[]): number {
  let score = 1.0;

  const totalPages = pages.length;
  if (totalPages === 0) return 0;

  // Pages with JSON-LD
  const pagesWithJsonLd = pages.filter((p) => p.has_json_ld).length;
  const jsonLdRate = pagesWithJsonLd / totalPages;

  score = jsonLdRate * 0.7; // JSON-LD is 70% of structured score

  // Pages with FAQ
  const pagesWithFaq = pages.filter((p) => p.has_faq).length;
  const faqRate = pagesWithFaq / totalPages;

  score += faqRate * 0.3; // FAQ is 30% of structured score

  return Math.max(0, Math.min(1, score));
}

function calculateAnswerability(pages: AuditPage[], issues: AuditIssue[]): number {
  let score = 1.0;

  const totalPages = pages.length;
  if (totalPages === 0) return 0;

  // Missing titles
  const missingTitles = issues.filter((i) => i.issue_type === 'missing_title').length;
  score -= (missingTitles / totalPages) * 0.3;

  // Missing H1s
  const missingH1s = issues.filter((i) => i.issue_type === 'missing_h1').length;
  score -= (missingH1s / totalPages) * 0.2;

  // Thin content
  const thinContent = issues.filter((i) => i.issue_type === 'thin_content').length;
  score -= (thinContent / totalPages) * 0.3;

  // Bonus for good word count
  const avgWordCount = pages.reduce((sum, p) => sum + p.word_count, 0) / totalPages;
  if (avgWordCount >= 500) {
    score += 0.2; // Bonus for substantial content
  }

  return Math.max(0, Math.min(1, score));
}

function calculateTrust(pages: AuditPage[], issues: AuditIssue[]): number {
  let score = 1.0;

  const totalPages = pages.length;
  if (totalPages === 0) return 0;

  // HTTPS check (all pages should be HTTPS)
  const httpPages = pages.filter((p) => p.url.startsWith('http://')).length;
  score -= (httpPages / totalPages) * 0.4;

  // Pages with titles (basic metadata)
  const pagesWithTitles = pages.filter((p) => p.title !== null).length;
  score *= pagesWithTitles / totalPages;

  // Page errors reduce trust
  const errorPages = issues.filter((i) => 
    i.issue_type === 'page_error' || i.issue_type === 'page_unreachable'
  ).length;
  score -= (errorPages / totalPages) * 0.3;

  return Math.max(0, Math.min(1, score));
}

