/**
 * Visibility data adapter for v2.1 scoring
 */

import { VisibilityData } from "../types/audit";

export async function getVisibilityForDomain(db: D1Database, domain: string): Promise<VisibilityData> {
  try {
    // Query existing ai_citations table
    const { results } = await db.prepare(
      `SELECT source_type, COUNT(*) as count FROM ai_citations WHERE source_domain = ? GROUP BY source_type`
    ).bind(domain).all<{source_type: string; count: number}>();

    const bySource = (results || []).map(r => ({ source: r.source_type, count: r.count }));
    const totalCitations = bySource.reduce((sum, r) => sum + (r.count || 0), 0);
    const bravePresence = (bySource.find(r => r.source === "brave")?.count ?? 0) > 0 ? 1 : 0;

    return { bySource, totalCitations, bravePresence };
  } catch (error) {
    console.warn(`[VisibilityAdapter] Failed to get visibility for ${domain}:`, error);
    return { bySource: [], totalCitations: 0, bravePresence: 0 };
  }
}

export async function getVisibilityForAudit(db: D1Database, auditId: string, domain: string): Promise<VisibilityData> {
  try {
    // First try to get visibility data specific to this audit
    const auditResult = await db.prepare(
      `SELECT source_type, COUNT(*) as count FROM ai_citations 
       WHERE source_domain = ? AND source_url IN (
         SELECT url FROM audit_pages WHERE audit_id = ?
       ) GROUP BY source_type`
    ).bind(domain, auditId).all<{source_type: string; count: number}>();

    if (auditResult.results && auditResult.results.length > 0) {
      const bySource = auditResult.results.map(r => ({ source: r.source_type, count: r.count }));
      const totalCitations = bySource.reduce((sum, r) => sum + (r.count || 0), 0);
      const bravePresence = (bySource.find(r => r.source === "brave")?.count ?? 0) > 0 ? 1 : 0;
      return { bySource, totalCitations, bravePresence };
    }

    // Fall back to domain-wide visibility
    return getVisibilityForDomain(db, domain);
  } catch (error) {
    console.warn(`[VisibilityAdapter] Failed to get visibility for audit ${auditId}:`, error);
    return { bySource: [], totalCitations: 0, bravePresence: 0 };
  }
}
