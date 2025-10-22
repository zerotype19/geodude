/**
 * Site-Level Check Aggregation (Phase 2)
 * 
 * Computes site-wide metrics by aggregating page-level check results.
 * These are "scope: site" checks that look at patterns across all pages.
 * 
 * Examples:
 * - FAQ coverage % (how many pages have FAQ sections?)
 * - Schema adoption % (what % of pages use proper structured data?)
 * - Canonical correctness across the site
 * - Mobile readiness %
 */

type Row = { page_id: number; checks_json: string | null };
type CheckRow = { id: string; score: number; status: string; details?: any };

export interface SiteLevelMetrics {
  // FAQ & Structured Data
  faq_coverage_pct: number | null;          // % of pages with FAQ section
  faq_schema_adoption_pct: number | null;   // % of pages with valid FAQPage
  
  // Technical Foundations
  canonical_correct_pct: number | null;     // % of pages with correct canonical
  mobile_ready_pct: number | null;          // % of pages with viewport meta
  lang_correct_pct: number | null;          // % of pages with correct lang attr
  no_blocking_directives_pct: number | null; // % of pages without noindex
  
  // Authority & Trust
  entity_graph_adoption_pct: number | null; // % of pages with org schema
  
  // Structure & Organization
  avg_internal_links: number | null;        // Average internal link count
  semantic_headings_pct: number | null;     // % of pages with good H1→H2→H3
  
  // Content Quality
  title_quality_avg: number | null;         // Average title score
  meta_description_pct: number | null;      // % of pages with meta desc
  single_h1_pct: number | null;             // % of pages with exactly one H1
  
  // Summary
  total_pages: number;
  pages_with_checks: number;
}

/**
 * Compute site-level metrics from page-level checks
 */
export async function computeSiteLevel(
  db: D1Database, 
  auditId: string
): Promise<SiteLevelMetrics> {
  // Fetch all page checks for this audit
  const rs = (await db.prepare(`
    SELECT p.id as page_id, apa.checks_json
    FROM audit_pages p 
    LEFT JOIN audit_page_analysis apa ON apa.page_id = p.id
    WHERE p.audit_id = ?1
  `).bind(auditId).all()).results as Row[] || [];

  const checks = rs.flatMap(r => {
    if (!r.checks_json) return [];
    try { 
      return JSON.parse(r.checks_json) as CheckRow[]; 
    } catch { 
      return []; 
    }
  });

  // Group checks by ID
  const byId = new Map<string, number[]>();
  for (const c of checks) {
    const arr = byId.get(c.id) || [];
    arr.push(c.score);
    byId.set(c.id, arr);
  }

  // Helper: percentage of pages passing a threshold
  const pct = (id: string, passCut = 60): number | null => {
    const arr = byId.get(id) || [];
    if (!arr.length) return null;
    const passes = arr.filter(s => s >= passCut).length;
    return Math.round((passes / arr.length) * 100);
  };

  // Helper: average score across pages
  const avg = (arr?: number[]): number | null => {
    if (!arr?.length) return null;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  };

  const pagesWithChecks = rs.filter(r => r.checks_json).length;

  return {
    // FAQ & Structured Data
    faq_coverage_pct: pct("A3_faq_presence"),
    faq_schema_adoption_pct: pct("A4_schema_faqpage"),
    
    // Technical Foundations
    canonical_correct_pct: pct("G10_canonical", 85),
    mobile_ready_pct: pct("T1_mobile_viewport", 85),
    lang_correct_pct: pct("T2_lang_region", 85),
    no_blocking_directives_pct: pct("T3_noindex_robots", 85),
    
    // Authority & Trust
    entity_graph_adoption_pct: pct("A12_entity_graph", 70),
    
    // Structure & Organization
    avg_internal_links: avg(byId.get("A9_internal_linking")),
    semantic_headings_pct: pct("A2_headings_semantic", 70),
    
    // Content Quality
    title_quality_avg: avg(byId.get("C1_title_quality")),
    meta_description_pct: pct("C2_meta_description", 60),
    single_h1_pct: pct("C3_h1_presence", 85),
    
    // Summary
    total_pages: rs.length,
    pages_with_checks: pagesWithChecks
  };
}

/**
 * Persist site-level metrics to database
 * (Optional - can store in audits.site_checks_json or separate table)
 */
export async function persistSiteLevel(
  db: D1Database,
  auditId: string,
  metrics: SiteLevelMetrics
): Promise<void> {
  // Option 1: Store in audits table metadata
  await db.prepare(`
    UPDATE audits 
    SET config_json = json_set(
      COALESCE(config_json, '{}'),
      '$.site_checks',
      ?1
    )
    WHERE id = ?2
  `).bind(JSON.stringify(metrics), auditId).run();
  
  // Option 2: If you add a site_checks_json column
  // await db.prepare(`
  //   UPDATE audits SET site_checks_json = ?1 WHERE id = ?2
  // `).bind(JSON.stringify(metrics), auditId).run();
}

/**
 * Get site-level metrics for an audit
 */
export async function getSiteLevel(
  db: D1Database,
  auditId: string
): Promise<SiteLevelMetrics | null> {
  const audit = await db.prepare(
    "SELECT config_json FROM audits WHERE id = ?"
  ).bind(auditId).first();
  
  if (!audit || !audit.config_json) return null;
  
  try {
    const config = JSON.parse(audit.config_json as string);
    return config.site_checks || null;
  } catch {
    return null;
  }
}

