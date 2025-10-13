/**
 * Scoring Model v3.0 - Phase Next
 * 5-Pillar scoring system with E-E-A-T and Assistant Visibility
 * 
 * Internal Pillars (100 pts total):
 * - Pillar A: Access & Indexability (35 pts)
 * - Pillar B: Entities & Structured Fitness (25 pts)  
 * - Pillar C: Answer Fitness (20 pts)
 * - Pillar D: Authority/Safety/Provenance (12 pts)
 * - Pillar E: Performance & Stability (8 pts)
 * 
 * UI Mapping (preserve existing weights):
 * - Crawlability card = A (35) + 1 pt from E
 * - Structured card = B (25)
 * - Answerability = C (20)
 * - Trust = D (12) + remaining 7 pts from E
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
  // New fields for Phase Next
  render_parity?: number; // 0-100%
  page_type?: string; // 'article' | 'product' | 'faq' | 'howto' | 'about' | 'qapage' | 'other'
  schema_fitness?: number; // 0-100%
  eeat_score?: number; // 0-100
  performance_score?: number; // 0-100
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
  // New fields for Phase Next
  answerEngineAccess?: Record<string, { status: number; bodyHash: string; cfChallenge: boolean }>;
  renderParity?: number; // 0-100%
}

interface StructuredData {
  siteFaqSchemaPresent: boolean;
  siteFaqPagePresent: boolean;
  schemaTypes: string[];
  // New fields for Phase Next
  schemaFitness?: number; // 0-100%
  entityGraph?: {
    hasPerson: boolean;
    hasOrganization: boolean;
    sameAsLinks: string[];
  };
}

interface EEAATData {
  experience: number; // 0-100
  expertise: number; // 0-100
  authority: number; // 0-100
  trust: number; // 0-100
  overall: number; // 0-100
}

export interface ScoresV2 {
  overall: number;              // 0-100% (weighted)
  crawlability: number;         // raw points (0-36) - A + 1 from E
  structured: number;           // raw points (0-25) - B
  answerability: number;        // raw points (0-20) - C
  trust: number;                // raw points (0-19) - D + 7 from E
  crawlabilityPct: number;      // percentage (0-100%)
  structuredPct: number;        // percentage (0-100%)
  answerabilityPct: number;     // percentage (0-100%)
  trustPct: number;             // percentage (0-100%)
  breakdown: {
    pillarA: {
      robotsPresent: number;
      aiBotsAllowed: number;
      sitemapFound: number;
      answerEngineAccess: number;
      renderParity: number;
    };
    pillarB: {
      schemaFitness: number;
      entityGraph: number;
      schemaVariety: number;
    };
    pillarC: {
      titles: number;
      h1s: number;
      contentDepth: number;
      chunkability: number;
      qaScaffolds: number;
    };
    pillarD: {
      eeatScore: number;
      authority: number;
      safety: number;
    };
    pillarE: {
      performance: number;
      stability: number;
    };
  };
  gates: {
    gateA: boolean; // Answer engines blocked
    gateB: boolean; // >50% pages noindex
    gateC: boolean; // Render parity diff >30%
    gateD: boolean; // >50% JSON-LD parse errors
  };
}

export function calculateScoresV2(
  pages: AuditPage[], 
  issues: AuditIssue[],
  crawlability?: CrawlabilityData,
  structured?: StructuredData,
  eeat?: EEAATData
): ScoresV2 {
  // Calculate each pillar
  const pillarA = calculatePillarA(pages, issues, crawlability);
  const pillarB = calculatePillarB(pages, issues, structured);
  const pillarC = calculatePillarC(pages, issues);
  const pillarD = calculatePillarD(pages, issues, eeat);
  const pillarE = calculatePillarE(pages, issues);

  // Apply gates
  const gates = applyGates(pages, issues, crawlability);

  // Calculate UI card scores (preserve existing weights)
  const crawlabilityScore = pillarA.score + 1; // A + 1 from E
  const structuredScore = pillarB.score; // B
  const answerabilityScore = pillarC.score; // C
  const trustScore = pillarD.score + 7; // D + remaining 7 from E

  // Convert to percentages
  const crawlabilityPct = (crawlabilityScore / 36) * 100;
  const structuredPct = (structuredScore / 25) * 100;
  const answerabilityPct = (answerabilityScore / 20) * 100;
  const trustPct = (trustScore / 19) * 100;

  // Weighted overall score (preserve existing weights: 40/30/20/10)
  const overall = 
    crawlabilityPct * 0.4 +
    structuredPct * 0.3 +
    answerabilityPct * 0.2 +
    trustPct * 0.1;

  return {
    overall: Math.round(overall * 100) / 100,
    crawlability: Math.round(crawlabilityScore * 100) / 100,
    structured: Math.round(structuredScore * 100) / 100,
    answerability: Math.round(answerabilityScore * 100) / 100,
    trust: Math.round(trustScore * 100) / 100,
    crawlabilityPct: Math.round(crawlabilityPct * 100) / 100,
    structuredPct: Math.round(structuredPct * 100) / 100,
    answerabilityPct: Math.round(answerabilityPct * 100) / 100,
    trustPct: Math.round(trustPct * 100) / 100,
    breakdown: {
      pillarA: pillarA.breakdown,
      pillarB: pillarB.breakdown,
      pillarC: pillarC.breakdown,
      pillarD: pillarD.breakdown,
      pillarE: pillarE.breakdown,
    },
    gates,
  };
}

/**
 * Pillar A: Access & Indexability (35 pts)
 * - robots.txt present (5 pts)
 * - AI bots allowed (15 pts)
 * - Sitemap found (5 pts)
 * - Answer engine access (5 pts)
 * - Render parity (5 pts)
 */
function calculatePillarA(
  pages: AuditPage[], 
  issues: AuditIssue[],
  data?: CrawlabilityData
): { score: number; breakdown: any } {
  let score = 0;
  const breakdown = {
    robotsPresent: 0,
    aiBotsAllowed: 0,
    sitemapFound: 0,
    answerEngineAccess: 0,
    renderParity: 0,
  };

  // robots.txt present (5 pts)
  if (data?.robotsFound) {
    score += 5;
    breakdown.robotsPresent = 5;
  }

  // AI bots allowed (15 pts)
  if (data?.aiBotsAllowed) {
    const bots = ['GPTBot', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'CCBot', 'Google-Extended'];
    const allowedCount = bots.filter(bot => data.aiBotsAllowed[bot] !== false).length;
    const botScore = (allowedCount / bots.length) * 15;
    score += botScore;
    breakdown.aiBotsAllowed = Math.round(botScore * 100) / 100;
  } else {
    score += 15;
    breakdown.aiBotsAllowed = 15;
  }

  // Sitemap found (5 pts)
  if (data?.sitemapFound) {
    score += 5;
    breakdown.sitemapFound = 5;
  }

  // Answer engine access (5 pts)
  if (data?.answerEngineAccess) {
    const engines = Object.keys(data.answerEngineAccess);
    const accessibleEngines = engines.filter(engine => 
      data.answerEngineAccess![engine].status >= 200 && 
      data.answerEngineAccess![engine].status < 400
    );
    const accessScore = (accessibleEngines.length / engines.length) * 5;
    score += accessScore;
    breakdown.answerEngineAccess = Math.round(accessScore * 100) / 100;
  } else {
    score += 5;
    breakdown.answerEngineAccess = 5;
  }

  // Render parity (5 pts)
  if (data?.renderParity !== undefined) {
    const parityScore = (data.renderParity / 100) * 5;
    score += parityScore;
    breakdown.renderParity = Math.round(parityScore * 100) / 100;
  } else {
    score += 5;
    breakdown.renderParity = 5;
  }

  return { 
    score: Math.max(0, Math.min(35, score)), 
    breakdown 
  };
}

/**
 * Pillar B: Entities & Structured Fitness (25 pts)
 * - Schema fitness (15 pts)
 * - Entity graph (5 pts)
 * - Schema variety (5 pts)
 */
function calculatePillarB(
  pages: AuditPage[], 
  issues: AuditIssue[],
  data?: StructuredData
): { score: number; breakdown: any } {
  let score = 0;
  const breakdown = {
    schemaFitness: 0,
    entityGraph: 0,
    schemaVariety: 0,
  };

  // Schema fitness (15 pts)
  if (data?.schemaFitness !== undefined) {
    const fitnessScore = (data.schemaFitness / 100) * 15;
    score += fitnessScore;
    breakdown.schemaFitness = Math.round(fitnessScore * 100) / 100;
  } else {
    // Fallback to JSON-LD coverage
    const totalPages = pages.length;
    if (totalPages > 0) {
      const pagesWithJsonLd = pages.filter(p => (p.jsonld_count ?? 0) > 0).length;
      const jsonLdRate = pagesWithJsonLd / totalPages;
      const fitnessScore = jsonLdRate * 15;
      score += fitnessScore;
      breakdown.schemaFitness = Math.round(fitnessScore * 100) / 100;
    }
  }

  // Entity graph (5 pts)
  if (data?.entityGraph) {
    let entityScore = 0;
    if (data.entityGraph.hasPerson) entityScore += 2;
    if (data.entityGraph.hasOrganization) entityScore += 2;
    if (data.entityGraph.sameAsLinks.length > 0) entityScore += 1;
    score += entityScore;
    breakdown.entityGraph = entityScore;
  }

  // Schema variety (5 pts)
  if (data?.schemaTypes && data.schemaTypes.length > 0) {
    const importantSchemas = ['Organization', 'Article', 'Product', 'BreadcrumbList', 'WebSite'];
    const hasImportant = data.schemaTypes.some(type => 
      importantSchemas.some(important => type.includes(important))
    );
    if (hasImportant) {
      score += 5;
      breakdown.schemaVariety = 5;
    }
  }

  return { 
    score: Math.max(0, Math.min(25, score)), 
    breakdown 
  };
}

/**
 * Pillar C: Answer Fitness (20 pts)
 * - Titles (5 pts)
 * - H1s (5 pts)
 * - Content depth (5 pts)
 * - Chunkability (3 pts)
 * - Q&A scaffolds (2 pts)
 */
function calculatePillarC(
  pages: AuditPage[], 
  issues: AuditIssue[]
): { score: number; breakdown: any } {
  let score = 0;
  const breakdown = {
    titles: 0,
    h1s: 0,
    contentDepth: 0,
    chunkability: 0,
    qaScaffolds: 0,
  };

  const totalPages = pages.length;
  if (totalPages === 0) return { score: 0, breakdown };

  // Titles (5 pts)
  const pagesWithTitles = pages.filter(p => p.title && p.title.length > 0).length;
  const titleRate = pagesWithTitles / totalPages;
  const titleScore = titleRate * 5;
  score += titleScore;
  breakdown.titles = Math.round(titleScore * 100) / 100;

  // H1s (5 pts)
  const pagesWithH1 = pages.filter(p => p.has_h1 || (p.h1 && p.h1.length > 0)).length;
  const h1Rate = pagesWithH1 / totalPages;
  const h1Score = h1Rate * 5;
  score += h1Score;
  breakdown.h1s = Math.round(h1Score * 100) / 100;

  // Content depth (5 pts)
  const pagesWithContent = pages.filter(p => (p.rendered_words ?? p.word_count ?? 0) >= 120).length;
  const contentRate = pagesWithContent / totalPages;
  const contentScore = contentRate * 5;
  score += contentScore;
  breakdown.contentDepth = Math.round(contentScore * 100) / 100;

  // Chunkability (3 pts) - based on heading hierarchy and paragraph length
  const chunkablePages = pages.filter(p => {
    const wordCount = p.rendered_words ?? p.word_count ?? 0;
    return wordCount >= 120 && wordCount <= 2000; // Good chunk size
  }).length;
  const chunkRate = chunkablePages / totalPages;
  const chunkScore = chunkRate * 3;
  score += chunkScore;
  breakdown.chunkability = Math.round(chunkScore * 100) / 100;

  // Q&A scaffolds (2 pts) - detect FAQ-like content
  const qaPages = pages.filter(p => {
    const url = p.url.toLowerCase();
    const title = (p.title || '').toLowerCase();
    return url.includes('/faq') || title.includes('faq') || p.faq_present;
  }).length;
  const qaRate = qaPages / totalPages;
  const qaScore = qaRate * 2;
  score += qaScore;
  breakdown.qaScaffolds = Math.round(qaScore * 100) / 100;

  return { 
    score: Math.max(0, Math.min(20, score)), 
    breakdown 
  };
}

/**
 * Pillar D: Authority/Safety/Provenance (12 pts)
 * - E-E-A-T score (8 pts)
 * - Authority (2 pts)
 * - Safety (2 pts)
 */
function calculatePillarD(
  pages: AuditPage[], 
  issues: AuditIssue[],
  eeat?: EEAATData
): { score: number; breakdown: any } {
  let score = 0;
  const breakdown = {
    eeatScore: 0,
    authority: 0,
    safety: 0,
  };

  // E-E-A-T score (8 pts)
  if (eeat?.overall !== undefined) {
    const eeatScore = (eeat.overall / 100) * 8;
    score += eeatScore;
    breakdown.eeatScore = Math.round(eeatScore * 100) / 100;
  } else {
    // Fallback: basic trust indicators
    const totalPages = pages.length;
    if (totalPages > 0) {
      const pages2xx = pages.filter(p => p.status_code >= 200 && p.status_code < 300).length;
      const statusRate = pages2xx / totalPages;
      const basicScore = statusRate * 8;
      score += basicScore;
      breakdown.eeatScore = Math.round(basicScore * 100) / 100;
    }
  }

  // Authority (2 pts) - based on content quality and structure
  const totalPages = pages.length;
  if (totalPages > 0) {
    const qualityPages = pages.filter(p => {
      const wordCount = p.rendered_words ?? p.word_count ?? 0;
      return wordCount >= 300 && p.title && p.h1;
    }).length;
    const qualityRate = qualityPages / totalPages;
    const authorityScore = qualityRate * 2;
    score += authorityScore;
    breakdown.authority = Math.round(authorityScore * 100) / 100;
  }

  // Safety (2 pts) - based on error rate and security
  const errorPages = pages.filter(p => p.error || p.status_code >= 400).length;
  const errorRate = totalPages > 0 ? errorPages / totalPages : 0;
  const safetyScore = (1 - errorRate) * 2;
  score += safetyScore;
  breakdown.safety = Math.round(safetyScore * 100) / 100;

  return { 
    score: Math.max(0, Math.min(12, score)), 
    breakdown 
  };
}

/**
 * Pillar E: Performance & Stability (8 pts)
 * - Performance (5 pts)
 * - Stability (3 pts)
 */
function calculatePillarE(
  pages: AuditPage[], 
  issues: AuditIssue[]
): { score: number; breakdown: any } {
  let score = 0;
  const breakdown = {
    performance: 0,
    stability: 0,
  };

  const totalPages = pages.length;
  if (totalPages === 0) return { score: 0, breakdown };

  // Performance (5 pts) - based on load times
  const validTimes = pages
    .map(p => p.load_time_ms)
    .filter(t => t > 0);
  
  if (validTimes.length > 0) {
    const sortedTimes = validTimes.sort((a, b) => a - b);
    const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
    
    if (medianTime <= 3000) {
      score += 5;
      breakdown.performance = 5;
    } else if (medianTime <= 6000) {
      const perfScore = 5 * (1 - (medianTime - 3000) / 3000);
      score += perfScore;
      breakdown.performance = Math.round(perfScore * 100) / 100;
    }
  }

  // Stability (3 pts) - based on success rate
  const successfulPages = pages.filter(p => p.status_code >= 200 && p.status_code < 400).length;
  const successRate = successfulPages / totalPages;
  const stabilityScore = successRate * 3;
  score += stabilityScore;
  breakdown.stability = Math.round(stabilityScore * 100) / 100;

  return { 
    score: Math.max(0, Math.min(8, score)), 
    breakdown 
  };
}

/**
 * Apply gates that can cap the overall score
 */
function applyGates(
  pages: AuditPage[], 
  issues: AuditIssue[],
  crawlability?: CrawlabilityData
): { gateA: boolean; gateB: boolean; gateC: boolean; gateD: boolean } {
  const gates = {
    gateA: false, // Answer engines blocked
    gateB: false, // >50% pages noindex
    gateC: false, // Render parity diff >30%
    gateD: false, // >50% JSON-LD parse errors
  };

  // Gate A: Answer engines blocked
  if (crawlability?.answerEngineAccess) {
    const engines = Object.keys(crawlability.answerEngineAccess);
    const blockedEngines = engines.filter(engine => 
      crawlability.answerEngineAccess![engine].status < 200 || 
      crawlability.answerEngineAccess![engine].status >= 400
    );
    gates.gateA = blockedEngines.length > engines.length * 0.5;
  }

  // Gate B: >50% pages noindex (would need to check robots meta tags)
  // For now, we'll skip this as we don't have that data yet
  gates.gateB = false;

  // Gate C: Render parity diff >30%
  if (crawlability?.renderParity !== undefined) {
    gates.gateC = crawlability.renderParity < 70; // <70% parity
  }

  // Gate D: >50% JSON-LD parse errors (would need to track parse errors)
  // For now, we'll skip this as we don't have that data yet
  gates.gateD = false;

  return gates;
}
