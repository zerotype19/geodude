/**
 * Citations Join ETL
 * 
 * After citations are ingested, join them to audit_pages and set:
 * - is_cited (boolean)
 * - citation_count (int)
 * - assistants_citing (JSON array)
 */

import { normalizeURL } from '../lib/urlNormalizer';

export interface Env {
  DB: D1Database;
}

export interface CitationJoinResult {
  pages_updated: number;
  citations_processed: number;
  unmatched_citations: number;
}

/**
 * Join citations to audit pages for a specific audit
 */
export async function joinCitationsToPages(
  db: D1Database,
  auditId: string
): Promise<CitationJoinResult> {
  console.log(`[Citations Join] Starting join for audit ${auditId}...`);

  let pages_updated = 0;
  let citations_processed = 0;
  let unmatched_citations = 0;

  try {
    // Get all citations for this audit
    const citations = await db.prepare(`
      SELECT 
        id,
        cited_url,
        assistant,
        snippet,
        cited_at
      FROM citations
      WHERE audit_id = ?
      ORDER BY cited_at DESC
    `).bind(auditId).all();

    if (!citations.results || citations.results.length === 0) {
      console.log(`[Citations Join] No citations found for audit ${auditId}`);
      return { pages_updated: 0, citations_processed: 0, unmatched_citations: 0 };
    }

    console.log(`[Citations Join] Found ${citations.results.length} citations to process`);

    // Get all pages for this audit with their URLs
    const pages = await db.prepare(`
      SELECT id, url
      FROM audit_pages
      WHERE audit_id = ?
    `).bind(auditId).all();

    if (!pages.results || pages.results.length === 0) {
      console.log(`[Citations Join] No pages found for audit ${auditId}`);
      return { 
        pages_updated: 0, 
        citations_processed: citations.results.length, 
        unmatched_citations: citations.results.length 
      };
    }

    // Build normalized URL → page ID map
    const urlToPageMap = new Map<string, number>();
    for (const page of pages.results as any[]) {
      const normalized = normalizeURL(page.url);
      urlToPageMap.set(normalized, page.id);
    }

    // Aggregate citations per page
    const pageAggregates = new Map<number, {
      citation_count: number;
      assistants: Set<string>;
    }>();

    for (const citation of citations.results as any[]) {
      const normalizedUrl = normalizeURL(citation.cited_url);
      const pageId = urlToPageMap.get(normalizedUrl);

      if (!pageId) {
        unmatched_citations++;
        console.log(`[Citations Join] No matching page for URL: ${citation.cited_url}`);
        continue;
      }

      if (!pageAggregates.has(pageId)) {
        pageAggregates.set(pageId, {
          citation_count: 0,
          assistants: new Set()
        });
      }

      const aggregate = pageAggregates.get(pageId)!;
      aggregate.citation_count++;
      aggregate.assistants.add(citation.assistant);
      citations_processed++;
    }

    // Update audit_pages
    for (const [pageId, aggregate] of pageAggregates.entries()) {
      const assistants_citing = JSON.stringify(
        Array.from(aggregate.assistants).sort()
      );

      await db.prepare(`
        UPDATE audit_pages
        SET 
          is_cited = 1,
          citation_count = ?,
          assistants_citing = ?
        WHERE id = ?
      `).bind(
        aggregate.citation_count,
        assistants_citing,
        pageId
      ).run();

      pages_updated++;
    }

    console.log(`[Citations Join] Complete! Updated ${pages_updated} pages, processed ${citations_processed} citations, ${unmatched_citations} unmatched`);

    return {
      pages_updated,
      citations_processed,
      unmatched_citations
    };
  } catch (error) {
    console.error('[Citations Join] Error:', error);
    throw error;
  }
}

/**
 * Reset citation flags for an audit (useful for reprocessing)
 */
export async function resetCitationFlags(
  db: D1Database,
  auditId: string
): Promise<void> {
  await db.prepare(`
    UPDATE audit_pages
    SET 
      is_cited = 0,
      citation_count = 0,
      assistants_citing = NULL
    WHERE audit_id = ?
  `).bind(auditId).run();

  console.log(`[Citations Join] Reset citation flags for audit ${auditId}`);
}

