/**
 * Report Data Aggregator
 * Fetches and structures all data needed for the executive summary report
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface ReportData {
  audit: AuditInfo;
  scores: ScoreBreakdown;
  categories: CategoryDetail[];
  priorityFixes: PriorityFix[];
  citations: CitationAnalysis;
  siteDiagnostics: SiteDiagnostic[];
  topPages: PagePerformance[];
  quickWins: PagePerformance[];
}

export interface SiteDiagnostic {
  id: string;
  name: string;
  score: number;
  status: 'ok' | 'warn' | 'fail';
  impact_level: string;
  description: string;
}

export interface AuditInfo {
  id: string;
  root_url: string;
  domain: string;
  started_at: string;
  finished_at: string;
  status: string;
  pages_analyzed: number;
  composite_score: number;
}

export interface ScoreBreakdown {
  overall: number;
  page_score: number;
  site_score: number;
  percentile?: number; // Optional: vs other sites
}

export interface CategoryDetail {
  category: string;
  display_name: string;
  score: number;
  max_score: number;
  percentage: number;
  checks_passing: number;
  checks_total: number;
  impact_level: 'high' | 'medium' | 'low';
  strengths: string[];
  opportunities: string[];
  affected_pages: number;
}

export interface PriorityFix {
  id: string;
  name: string;
  category: string;
  severity: 'high' | 'medium' | 'low';
  score: number;
  weight: number;
  impact_description: string;
  why_it_matters: string;
  how_to_fix: string;
  affected_pages: Array<{
    url: string;
    title?: string;
    current_score?: number;
  }>;
  expected_impact: string;
  effort_estimate: string;
}

export interface CitationAnalysis {
  overall_rate: number;
  total_queries: number;
  cited_queries: number;
  by_source: Array<{
    source: string;
    rate: number;
    total: number;
    cited: number;
  }>;
  top_cited_pages: Array<{
    url: string;
    title?: string;
    citation_count: number;
    top_queries: string[];
  }>;
  successful_citations: Array<{
    query: string;
    source: string;
    cited_url: string;
    answer_excerpt?: string;
  }>;
  missed_opportunities: Array<{
    query: string;
    source: string;
    competitor_cited?: string;
    reason: string;
  }>;
}

export interface PagePerformance {
  url: string;
  title?: string;
  score: number;
  citation_count: number;
  strengths: string[];
  issues: string[];
  quick_win?: {
    fix: string;
    impact: string;
    effort: string;
  };
}

/**
 * Main aggregation function - gathers all data for the report
 */
export async function aggregateReportData(
  db: D1Database,
  auditId: string
): Promise<ReportData> {
  // Fetch all data in parallel
  const [
    audit,
    scores,
    categories,
    priorityFixes,
    citations,
    siteDiagnostics,
    topPages,
    quickWins
  ] = await Promise.all([
    getAuditInfo(db, auditId),
    getScoreBreakdown(db, auditId),
    getCategoryDetails(db, auditId),
    getPriorityFixes(db, auditId),
    getCitationAnalysis(db, auditId),
    getSiteDiagnostics(db, auditId),
    getTopPages(db, auditId),
    getQuickWins(db, auditId),
  ]);

  return {
    audit,
    scores,
    categories,
    priorityFixes,
    citations,
    siteDiagnostics,
    topPages,
    quickWins,
  };
}

/**
 * Get basic audit information
 */
async function getAuditInfo(db: D1Database, auditId: string): Promise<AuditInfo> {
  const audit = await db.prepare(`
    SELECT 
      id,
      root_url,
      started_at,
      finished_at,
      status,
      composite_score
    FROM audits
    WHERE id = ?
  `).bind(auditId).first() as any;

  if (!audit) {
    throw new Error('Audit not found');
  }

  // Get pages analyzed count
  const pageCount = await db.prepare(`
    SELECT COUNT(*) as count
    FROM audit_pages
    WHERE audit_id = ? AND status_code < 400
  `).bind(auditId).first() as any;

  // Extract domain from root_url
  const domain = new URL(audit.root_url).hostname;

  return {
    id: audit.id,
    root_url: audit.root_url,
    domain,
    started_at: audit.started_at,
    finished_at: audit.finished_at || new Date().toISOString(),
    status: audit.status,
    pages_analyzed: pageCount?.count || 0,
    composite_score: audit.composite_score || 0,
  };
}

/**
 * Get score breakdown (overall, page, site)
 */
async function getScoreBreakdown(db: D1Database, auditId: string): Promise<ScoreBreakdown> {
  // Get site checks
  const audit = await db.prepare(`
    SELECT site_checks_json, composite_score
    FROM audits
    WHERE id = ?
  `).bind(auditId).first() as any;

  const siteChecks = audit?.site_checks_json ? JSON.parse(audit.site_checks_json) : [];
  
  // Calculate site score
  let siteScore = 0;
  let siteMaxScore = 0;
  for (const check of siteChecks) {
    siteScore += check.score * check.weight;
    siteMaxScore += 100 * check.weight;
  }
  const siteScoreNormalized = siteMaxScore > 0 ? Math.round((siteScore / siteMaxScore) * 100) : 0;

  // Get page checks - calculate properly weighted average
  const pageChecks = await db.prepare(`
    SELECT apa.checks_json
    FROM audit_page_analysis apa
    JOIN audit_pages ap ON apa.page_id = ap.id
    WHERE ap.audit_id = ? AND apa.checks_json IS NOT NULL
  `).bind(auditId).all() as any;

  let totalWeightedScore = 0;
  let totalMaxScore = 0;
  
  for (const row of pageChecks.results) {
    const checks = JSON.parse(row.checks_json);
    for (const check of checks) {
      totalWeightedScore += check.score * (check.weight || 1);
      totalMaxScore += 100 * (check.weight || 1);
    }
  }
  
  const pageScore = totalMaxScore > 0 ? Math.round((totalWeightedScore / totalMaxScore) * 100) : 0;

  return {
    overall: audit?.composite_score || 0,
    page_score: pageScore,
    site_score: siteScoreNormalized,
  };
}

/**
 * Get detailed category breakdown
 */
async function getCategoryDetails(db: D1Database, auditId: string): Promise<CategoryDetail[]> {
  // Get criteria from scoring_criteria table
  const criteria = await db.prepare(`
    SELECT 
      id,
      label,
      category,
      weight,
      impact_level,
      why_it_matters
    FROM scoring_criteria
    WHERE enabled = 1
    ORDER BY category, display_order, id
  `).all() as any;

  // Get page checks for this audit
  const pageChecks = await db.prepare(`
    SELECT apa.checks_json
    FROM audit_page_analysis apa
    JOIN audit_pages ap ON apa.page_id = ap.id
    WHERE ap.audit_id = ?
  `).bind(auditId).all() as any;

  // Get site checks
  const audit = await db.prepare(`
    SELECT site_checks_json
    FROM audits
    WHERE id = ?
  `).bind(auditId).first() as any;

  const siteChecks = audit?.site_checks_json ? JSON.parse(audit.site_checks_json) : [];

  // Aggregate by category
  const categoryMap = new Map<string, any>();

  // Process criteria to initialize categories
  for (const criterion of criteria.results) {
    if (!categoryMap.has(criterion.category)) {
      categoryMap.set(criterion.category, {
        category: criterion.category,
        display_name: formatCategoryName(criterion.category),
        checks_in_category: 0,
        weighted_score_sum: 0,
        max_possible_score: 0,
        checks_passing: 0,
        checks_total: 0,
        unique_pages: new Set(),
      });
    }

    const cat = categoryMap.get(criterion.category);
    cat.checks_in_category++;
  }

  // Process page checks
  for (const row of pageChecks.results) {
    if (!row.checks_json) continue;
    const checks = JSON.parse(row.checks_json);
    
    for (const check of checks) {
      const criterion = criteria.results.find((c: any) => c.id === check.id);
      if (!criterion) continue;

      const cat = categoryMap.get(criterion.category);
      if (!cat) continue;

      // Accumulate weighted score
      cat.weighted_score_sum += check.score * criterion.weight;
      cat.max_possible_score += 100 * criterion.weight;
      cat.checks_total++;
      
      // Count passing checks
      if (check.score >= 70) {
        cat.checks_passing++;
      }
    }
  }

  // Process site checks
  for (const check of siteChecks) {
    const criterion = criteria.results.find((c: any) => c.id === check.id);
    if (!criterion) continue;

    const cat = categoryMap.get(criterion.category);
    if (!cat) continue;

    // Accumulate weighted score
    cat.weighted_score_sum += check.score * criterion.weight;
    cat.max_possible_score += 100 * criterion.weight;
    cat.checks_total++;
    
    // Count passing checks
    if (check.score >= 70) {
      cat.checks_passing++;
    }
  }

  // Convert to array and calculate percentages
  const categories: CategoryDetail[] = [];
  for (const [_, cat] of categoryMap) {
    // Calculate percentage: (actual weighted score / max possible weighted score) * 100
    const percentage = cat.max_possible_score > 0 
      ? Math.round((cat.weighted_score_sum / cat.max_possible_score) * 100)
      : 0;

    categories.push({
      category: cat.category,
      display_name: cat.display_name,
      score: percentage, // Use the percentage as the score
      max_score: 100,
      percentage,
      checks_passing: cat.checks_passing,
      checks_total: cat.checks_in_category, // Unique checks in this category
      impact_level: percentage < 60 ? 'high' : percentage < 80 ? 'medium' : 'low',
      strengths: [], // TODO: Populate from passing checks
      opportunities: [], // TODO: Populate from failing checks
      affected_pages: Math.floor(cat.checks_total / (cat.checks_in_category || 1)), // Estimate pages from total check instances
    });
  }

  return categories.sort((a, b) => a.percentage - b.percentage); // Lowest first (needs most attention)
}

/**
 * Get priority fixes (top issues by weighted impact)
 */
async function getPriorityFixes(db: D1Database, auditId: string): Promise<PriorityFix[]> {
  // Get criteria with metadata
  const criteria = await db.prepare(`
    SELECT 
      id,
      label,
      category,
      weight,
      impact_level,
      why_it_matters,
      how_to_fix,
      common_issues
    FROM scoring_criteria
    WHERE enabled = 1
    ORDER BY weight DESC, display_order
  `).all() as any;

  // Get all failing checks across pages
  const pageChecks = await db.prepare(`
    SELECT 
      ap.url,
      apa.checks_json
    FROM audit_page_analysis apa
    JOIN audit_pages ap ON apa.page_id = ap.id
    WHERE ap.audit_id = ?
  `).bind(auditId).all() as any;

  // Aggregate failures by criterion
  const issueMap = new Map<string, any>();

  for (const row of pageChecks.results) {
    if (!row.checks_json) continue;
    const checks = JSON.parse(row.checks_json);

    for (const check of checks) {
      if (check.score >= 70) continue; // Only include failures

      if (!issueMap.has(check.id)) {
        const criterion = criteria.results.find((c: any) => c.id === check.id);
        if (!criterion) continue;

        issueMap.set(check.id, {
          id: check.id,
          name: criterion.label,
          category: criterion.category,
          severity: criterion.impact_level === 'critical' || criterion.impact_level === 'High' ? 'high' 
                  : criterion.impact_level === 'high' || criterion.impact_level === 'Medium' ? 'medium' 
                  : 'low',
          weight: criterion.weight,
          why_it_matters: criterion.why_it_matters || '',
          how_to_fix: criterion.how_to_fix || '',
          affected_pages: [],
          total_score_impact: 0,
        });
      }

      const issue = issueMap.get(check.id);
      issue.affected_pages.push({
        url: row.url,
        current_score: check.score,
      });
      issue.total_score_impact += (100 - check.score) * issue.weight;
    }
  }

  // Convert to array and sort by impact
  const fixes: PriorityFix[] = [];
  for (const [_, issue] of issueMap) {
    fixes.push({
      id: issue.id,
      name: issue.name,
      category: issue.category,
      severity: issue.severity,
      score: Math.round(issue.total_score_impact / issue.affected_pages.length),
      weight: issue.weight,
      impact_description: `${issue.affected_pages.length} pages affected`,
      why_it_matters: issue.why_it_matters,
      how_to_fix: issue.how_to_fix,
      affected_pages: issue.affected_pages.slice(0, 5), // Top 5 pages
      expected_impact: estimateImpact(issue.weight, issue.affected_pages.length),
      effort_estimate: estimateEffort(issue.affected_pages.length),
    });
  }

  return fixes
    .sort((a, b) => b.weight * b.affected_pages.length - a.weight * a.affected_pages.length)
    .slice(0, 15); // Top 15 issues
}

/**
 * Get citation analysis
 */
async function getCitationAnalysis(db: D1Database, auditId: string): Promise<CitationAnalysis> {
  // Get citation summary
  const citationStats = await db.prepare(`
    SELECT 
      ai_source,
      COUNT(*) as total_queries,
      SUM(CASE WHEN cited_match_count > 0 THEN 1 ELSE 0 END) as cited_queries
    FROM ai_citations
    WHERE audit_id = ?
    GROUP BY ai_source
  `).bind(auditId).all() as any;

  const bySource = citationStats.results.map((row: any) => ({
    source: row.ai_source,
    rate: Math.round((row.cited_queries / row.total_queries) * 100),
    total: row.total_queries,
    cited: row.cited_queries,
  }));

  const totalQueries = bySource.reduce((sum, s) => sum + s.total, 0);
  const citedQueries = bySource.reduce((sum, s) => sum + s.cited, 0);
  const overallRate = totalQueries > 0 ? Math.round((citedQueries / totalQueries) * 100) : 0;

  // Get top cited pages with their queries
  const topCited = await db.prepare(`
    SELECT 
      first_match_url,
      COUNT(*) as citation_count
    FROM ai_citations
    WHERE audit_id = ? AND cited_match_count > 0 AND first_match_url IS NOT NULL
    GROUP BY first_match_url
    ORDER BY citation_count DESC
    LIMIT 10
  `).bind(auditId).all() as any;

  const topCitedPages = await Promise.all(topCited.results.map(async (row: any) => {
    const queries = await db.prepare(`
      SELECT query
      FROM ai_citations
      WHERE audit_id = ? AND first_match_url = ? AND cited_match_count > 0
      LIMIT 3
    `).bind(auditId, row.first_match_url).all() as any;
    
    return {
      url: row.first_match_url,
      citation_count: row.citation_count,
      top_queries: queries.results.map((q: any) => q.query),
    };
  }));

  // Get successful citation examples (queries where domain was cited)
  const successfulCitations = await db.prepare(`
    SELECT query, ai_source, first_match_url, answer_excerpt
    FROM ai_citations
    WHERE audit_id = ? AND cited_match_count > 0 AND answer_excerpt IS NOT NULL
    ORDER BY occurred_at DESC
    LIMIT 10
  `).bind(auditId).all() as any;

  // Get missed opportunities (queries with 0 citations)
  const missedOpportunities = await db.prepare(`
    SELECT query, ai_source
    FROM ai_citations
    WHERE audit_id = ? AND cited_match_count = 0
    ORDER BY occurred_at DESC
    LIMIT 10
  `).bind(auditId).all() as any;

  return {
    overall_rate: overallRate,
    total_queries: totalQueries,
    cited_queries: citedQueries,
    by_source: bySource,
    top_cited_pages: topCitedPages,
    successful_citations: successfulCitations.results.map((row: any) => ({
      query: row.query,
      source: row.ai_source,
      cited_url: row.first_match_url,
      answer_excerpt: row.answer_excerpt,
    })),
    missed_opportunities: missedOpportunities.results.map((row: any) => ({
      query: row.query,
      source: row.ai_source,
      reason: 'Domain not cited in AI response',
    })),
  };
}

/**
 * Get site-level diagnostics
 */
async function getSiteDiagnostics(db: D1Database, auditId: string): Promise<SiteDiagnostic[]> {
  // Get site checks from audits table
  const audit = await db.prepare(`
    SELECT site_checks_json
    FROM audits
    WHERE id = ?
  `).bind(auditId).first() as any;

  if (!audit?.site_checks_json) {
    return [];
  }

  const siteChecks = JSON.parse(audit.site_checks_json);

  // Get criteria metadata for site checks
  const criteria = await db.prepare(`
    SELECT id, label, impact_level, description
    FROM scoring_criteria
    WHERE scope = 'site' AND enabled = 1
  `).all() as any;

  const criteriaMap = new Map(criteria.results.map((c: any) => [c.id, c]));

  return siteChecks.map((check: any) => {
    const criterion = criteriaMap.get(check.id);
    const status = check.score >= 85 ? 'ok' : check.score >= 60 ? 'warn' : 'fail';

    return {
      id: check.id,
      name: criterion?.label || check.id,
      score: check.score,
      status,
      impact_level: criterion?.impact_level || 'Medium',
      description: criterion?.description || '',
    };
  }).sort((a: any, b: any) => a.score - b.score); // Lowest scores first
}

/**
 * Get top performing pages
 */
async function getTopPages(db: D1Database, auditId: string): Promise<PagePerformance[]> {
  const pages = await db.prepare(`
    SELECT 
      ap.url,
      apa.checks_json,
      (
        SELECT COUNT(*)
        FROM ai_citations
        WHERE audit_id = ? AND first_match_url = ap.url AND cited_match_count > 0
      ) as citation_count
    FROM audit_pages ap
    JOIN audit_page_analysis apa ON apa.page_id = ap.id
    WHERE ap.audit_id = ?
    ORDER BY citation_count DESC
    LIMIT 10
  `).bind(auditId, auditId).all() as any;

  return pages.results.map((row: any) => {
    const checks = row.checks_json ? JSON.parse(row.checks_json) : [];
    const avgScore = checks.length > 0
      ? Math.round(checks.reduce((sum: number, c: any) => sum + c.score, 0) / checks.length)
      : 0;

    return {
      url: row.url,
      score: avgScore,
      citation_count: row.citation_count,
      strengths: [], // TODO: Extract from passing checks
      issues: [], // TODO: Extract from failing checks
    };
  });
}

/**
 * Get quick win opportunities (pages close to passing thresholds)
 */
async function getQuickWins(db: D1Database, auditId: string): Promise<PagePerformance[]> {
  const pages = await db.prepare(`
    SELECT 
      ap.url,
      apa.checks_json
    FROM audit_pages ap
    JOIN audit_page_analysis apa ON apa.page_id = ap.id
    WHERE ap.audit_id = ?
  `).bind(auditId).all() as any;

  const quickWins: PagePerformance[] = [];

  for (const row of pages.results) {
    if (!row.checks_json) continue;
    const checks = JSON.parse(row.checks_json);
    
    // Find checks scoring 60-69 (close to 70 pass threshold)
    const nearMisses = checks.filter((c: any) => c.score >= 60 && c.score < 70);
    
    if (nearMisses.length > 0) {
      const avgScore = Math.round(checks.reduce((sum: number, c: any) => sum + c.score, 0) / checks.length);
      
      quickWins.push({
        url: row.url,
        score: avgScore,
        citation_count: 0,
        strengths: [],
        issues: nearMisses.map((c: any) => c.id),
        quick_win: {
          fix: `Fix ${nearMisses.length} checks close to passing`,
          impact: `+${nearMisses.length * 3} points`,
          effort: '< 1 hour',
        },
      });
    }
  }

  return quickWins.slice(0, 10);
}

// Helper functions
function formatCategoryName(category: string): string {
  const map: Record<string, string> = {
    'content': 'Content & Messaging',
    'technical': 'Technical Foundation',
    'semantic': 'Semantic Structure',
    'discovery': 'Discovery & Navigation',
    'authority': 'Authority & Trust',
    'citations': 'AI Citation Performance',
  };
  return map[category] || category;
}

function estimateImpact(weight: number, affectedPages: number): string {
  const totalImpact = weight * affectedPages;
  if (totalImpact > 50) return `+15-20% citation rate improvement`;
  if (totalImpact > 30) return `+10-15% citation rate improvement`;
  if (totalImpact > 15) return `+5-10% citation rate improvement`;
  return `+2-5% citation rate improvement`;
}

function estimateEffort(affectedPages: number): string {
  if (affectedPages > 20) return '4-8 hours';
  if (affectedPages > 10) return '2-4 hours';
  if (affectedPages > 5) return '1-2 hours';
  return '< 1 hour';
}

