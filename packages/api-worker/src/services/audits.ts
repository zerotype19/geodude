/**
 * Unified Audit Service
 * Single engine for all audit operations - no versioning, no feature flags
 */

import { getLatestAuditScores, saveAuditScores } from '../audit/db-helpers';
import { getVisibilityForAudit } from '../audit/visibility-adapter';
import { computeScoresV21 } from '../audit/scoring-v21';
import { analyzeHtmlV21 } from '../audit/analyze-v21';
import { generateIssuesFromAnalysis } from '../audit/issues-generator';
import { logAuditMetrics } from '../utils/logging';

export interface UnifiedAuditSummary {
  audit_id: string;
  domain: string;
  status: string;
  scores: {
    crawlability: number;
    structured: number;
    answerability: number;
    trust: number;
    visibility: number;
    overall: number;
  };
  eeat_summary?: {
    hasAuthor: boolean;
    hasDates: boolean;
    httpsOk: boolean;
    hasMetaDescription: boolean;
  };
  visibility_summary?: {
    totalCitations: number;
    bySource: { [key: string]: number };
    topUrls: string[];
  };
  pages_crawled: number;
  pages_total: number;
  issues_count: number;
  created_at?: string;
  completed_at?: string;
}

export async function recomputeUnifiedScores(db: D1Database, auditId: string): Promise<void> {
  // Load analysis data for the audit
  const analysisData = await loadAnalysisForAudit(db, auditId);
  
  // Get visibility data for the domain
  const domain = await domainForAudit(db, auditId);
  const visibility = await getVisibilityForAudit(db, auditId, domain);
  
  // Ensure visibility is always a valid object
  const safeVisibility = visibility || { bySource: [], totalCitations: 0, bravePresence: 0 };
  
  // Build scoring inputs
  const inputs = buildScoringInputs(analysisData, safeVisibility);
  
  // Compute unified scores (always 5 pillars)
  const scores = computeScoresV21(inputs);
  
  // Save to audit_scores table
  await saveAuditScores(db, auditId, scores);
}

export async function getUnifiedAuditSummary(db: D1Database, auditId: string): Promise<UnifiedAuditSummary> {
  // Get basic audit info
  const audit = await db.prepare(
    `SELECT id, property_id, status, pages_crawled, pages_total, issues_count, 
            started_at, completed_at, error
     FROM audits WHERE id = ?`
  ).bind(auditId).first();

  if (!audit) {
    throw new Error('Audit not found');
  }

  // Get latest scores from audit_scores table
  const latestScores = await getLatestAuditScores(db, auditId);
  
  if (!latestScores) {
    // If no scores exist, compute them now
    await recomputeUnifiedScores(db, auditId);
    const newScores = await getLatestAuditScores(db, auditId);
    if (!newScores) {
      throw new Error('Failed to compute scores');
    }
    return await getUnifiedAuditSummary(db, auditId); // Recursive call with scores
  }

  // Get domain
  const domain = await domainForAudit(db, auditId);

  // Get EEAT summary
  const eeatSummary = await selectEEATSummary(db, auditId);

  // Get visibility summary
  const visibilitySummary = await selectVisibilitySummary(db, auditId);

  return {
    audit_id: auditId,
    domain,
    status: audit.status,
    scores: {
      crawlability: latestScores.crawlability_score,
      structured: latestScores.structured_score,
      answerability: latestScores.answerability_score,
      trust: latestScores.trust_score,
      visibility: latestScores.visibility_score,
      overall: latestScores.overall_score
    },
    eeat_summary: eeatSummary,
    visibility_summary: visibilitySummary,
    pages_crawled: audit.pages_crawled || 0,
    pages_total: audit.pages_total || 0,
    issues_count: audit.issues_count || 0,
    created_at: audit.started_at,
    completed_at: audit.completed_at
  };
}

export async function reanalyzeFromStoredHtml(db: D1Database, auditId: string): Promise<void> {
  // Get stored HTML from audit_pages
  const pages = await db.prepare(
    `SELECT url, body_text FROM audit_pages WHERE audit_id = ? AND body_text IS NOT NULL`
  ).bind(auditId).all();

  console.log(`[Reanalyze] Found ${pages.results?.length || 0} pages to re-analyze`);

  // Re-analyze each page with v2.1 analyzer
  for (const page of pages.results as any[]) {
    try {
      const analysis = analyzeHtmlV21(page.url, page.body_text);
      
      console.log(`[Reanalyze] Analysis for ${page.url}:`, {
        has_jsonld: analysis.has_jsonld,
        faq_schema_present: analysis.faq_schema_present,
        headings_h2: analysis.headings_h2,
        headings_h3: analysis.headings_h3,
        outbound_links: analysis.outbound_links,
        outbound_domains: analysis.outbound_domains,
        https_ok: analysis.https_ok,
        load_time_ms: analysis.load_time_ms
      });
      
      // Update audit_page_analysis with new v2.1 fields
      await db.prepare(`
        UPDATE audit_page_analysis SET
          has_jsonld = ?,
          faq_schema_present = ?,
          headings_h2 = ?,
          headings_h3 = ?,
          outbound_links = ?,
          outbound_domains = ?,
          https_ok = ?,
          load_time_ms = ?,
          analyzed_at = CURRENT_TIMESTAMP
        WHERE audit_id = ? AND url = ?
      `).bind(
        analysis.has_jsonld ? 1 : 0,
        analysis.faq_schema_present ? 1 : 0,
        analysis.headings_h2 || 0,
        analysis.headings_h3 || 0,
        analysis.outbound_links || 0,
        analysis.outbound_domains || 0,
        analysis.https_ok ? 1 : 0,
        analysis.load_time_ms || null,
        auditId,
        page.url
      ).run();
    } catch (error) {
      console.error(`[Reanalyze] Error analyzing page ${page.url}:`, error);
    }
  }
}

export async function rebuildIssuesUnified(db: D1Database, auditId: string): Promise<void> {
  // Get analysis data
  const analysisData = await loadAnalysisForAudit(db, auditId);
  const domain = await domainForAudit(db, auditId);

  // Generate issues with unified generator (no versioning)
  const issues = generateIssuesFromAnalysis(analysisData, domain);

  // Clear existing issues for this audit
  await db.prepare(`DELETE FROM audit_issues WHERE audit_id = ?`).bind(auditId).run();

  // Insert new issues
  for (const issue of issues) {
    await db.prepare(`
      INSERT INTO audit_issues (audit_id, severity, category, message, issue_id, page_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      auditId,
      issue.severity || 'medium',
      issue.category || 'general',
      issue.message || 'Issue detected',
      issue.issue_id || null,
      issue.page_url || null
    ).run();
  }
}

// Helper functions
async function loadAnalysisForAudit(db: D1Database, auditId: string): Promise<any[]> {
  const result = await db.prepare(`
    SELECT url, title, h1, h1_count, meta_description, canonical, robots_meta,
           schema_types, author, date_published, date_modified, word_count,
           has_jsonld, faq_schema_present, headings_h2, headings_h3, 
           outbound_links, outbound_domains, https_ok, load_time_ms
    FROM audit_page_analysis 
    WHERE audit_id = ?
  `).bind(auditId).all();

  return result.results as any[];
}

async function domainForAudit(db: D1Database, auditId: string): Promise<string> {
  const result = await db.prepare(`
    SELECT p.domain FROM audits a
    JOIN properties p ON a.property_id = p.id
    WHERE a.id = ?
  `).bind(auditId).first();

  return (result as any)?.domain || '';
}

function buildScoringInputs(analysisData: any[], visibility: any): any {
  // Convert analysis data to the format expected by computeScoresV21
  const pages = analysisData.map(page => ({
    url: page.url,
    canonical_url: page.canonical,
    status: 200, // Assume 200 for now
    title: page.title,
    h1: page.h1,
    meta_description: page.meta_description,
    word_count: page.word_count || 0,
    robots_meta: page.robots_meta,
    has_jsonld: !!page.has_jsonld,
    schema_types: page.schema_types ? page.schema_types.split(',').map((s: string) => s.trim()) : [],
    faq_schema_present: !!page.faq_schema_present,
    author: page.author,
    date_published: page.date_published,
    date_modified: page.date_modified,
    headings_h2: page.headings_h2 || 0,
    headings_h3: page.headings_h3 || 0,
    outbound_links: page.outbound_links || 0,
    outbound_domains: page.outbound_domains || 0,
    https_ok: !!page.https_ok,
    load_time_ms: page.load_time_ms || null
  }));

  return {
    pages,
    robots: { gptbot: true, claude: true, perplexity: true, ccbot: true }, // Assume all allowed for now
    sitemapPresent: true, // Assume present for now
    visibility: {
      bySource: visibility?.bySource || [],
      totalCitations: visibility?.totalCitations || 0,
      bravePresence: visibility?.bravePresence || 0
    }
  };
}

async function selectEEATSummary(db: D1Database, auditId: string): Promise<any> {
  const result = await db.prepare(`
    SELECT 
      COUNT(*) as total_pages,
      SUM(CASE WHEN author IS NOT NULL AND author != '' THEN 1 ELSE 0 END) as pages_with_author,
      SUM(CASE WHEN date_published IS NOT NULL OR date_modified IS NOT NULL THEN 1 ELSE 0 END) as pages_with_dates,
      SUM(CASE WHEN https_ok = 1 THEN 1 ELSE 0 END) as pages_https_ok,
      SUM(CASE WHEN meta_description IS NOT NULL AND meta_description != '' THEN 1 ELSE 0 END) as pages_with_meta
    FROM audit_page_analysis 
    WHERE audit_id = ?
  `).bind(auditId).first();

  const total = (result as any)?.total_pages || 1;
  
  return {
    hasAuthor: ((result as any)?.pages_with_author || 0) / total > 0.5,
    hasDates: ((result as any)?.pages_with_dates || 0) / total > 0.5,
    httpsOk: ((result as any)?.pages_https_ok || 0) / total > 0.8,
    hasMetaDescription: ((result as any)?.pages_with_meta || 0) / total > 0.8
  };
}

async function selectVisibilitySummary(db: D1Database, auditId: string): Promise<any> {
  const domain = await domainForAudit(db, auditId);
  
  // Get citations for this domain
  const citations = await db.prepare(`
    SELECT source_type, source_url, COUNT(*) as count
    FROM ai_citations 
    WHERE source_domain = ?
    GROUP BY source_type, source_url
  `).bind(domain).all();

  const bySource: { [key: string]: number } = {};
  const topUrls: string[] = [];
  let totalCitations = 0;

  for (const citation of citations.results as any[]) {
    const source = citation.source_type || 'unknown';
    bySource[source] = (bySource[source] || 0) + citation.count;
    totalCitations += citation.count;
    
    if (topUrls.length < 10) {
      topUrls.push(citation.source_url);
    }
  }

  return {
    totalCitations,
    bySource,
    topUrls
  };
}
