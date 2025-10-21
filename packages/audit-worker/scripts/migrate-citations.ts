/**
 * Migration script for existing citations data
 * 
 * Migrates from:
 * - ai_citations
 * - ai_referrals  
 * - citations_runs
 * 
 * To unified:
 * - citations table
 * 
 * Usage:
 *   Called via worker endpoint: POST /api/admin/migrate-citations
 */

export interface Env {
  DB: D1Database;
}

/**
 * Normalize URL for consistent matching
 * Same logic as crawler uses
 */
function normalizeURL(url: string): string {
  try {
    const parsed = new URL(url);
    // Lowercase host
    parsed.hostname = parsed.hostname.toLowerCase();
    // Strip fragment
    parsed.hash = '';
    // Sort query params (optional, for deduplication)
    const params = Array.from(parsed.searchParams.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    parsed.search = '';
    for (const [key, value] of params) {
      parsed.searchParams.append(key, value);
    }
    return parsed.toString();
  } catch (e) {
    return url;
  }
}

export async function migrateCitations(db: D1Database) {
  console.log('[Migrate Citations] Starting migration...');

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Check if old tables exist
    const aiCitationsExists = await db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='ai_citations'
    `).first();

    if (!aiCitationsExists) {
      console.log('[Migrate Citations] ai_citations table does not exist. Skipping migration.');
      return { migrated, skipped, errors };
    }

    // Fetch all existing citations
    const oldCitations = await db.prepare(`
      SELECT 
        id,
        project_id,
        domain,
        source as assistant,
        url as cited_url,
        snippet,
        query as question,
        created_at as cited_at
      FROM ai_citations
      ORDER BY created_at DESC
      LIMIT 10000
    `).all();

    console.log(`[Migrate Citations] Found ${oldCitations.results?.length || 0} citations to migrate.`);

    if (!oldCitations.results || oldCitations.results.length === 0) {
      return { migrated, skipped, errors };
    }

    // For each citation, try to find matching audit_id
    for (const citation of oldCitations.results as any[]) {
      try {
        const normalizedUrl = normalizeURL(citation.cited_url);

        // Try to find audit_id from audit_pages
        const audit = await db.prepare(`
          SELECT DISTINCT ap.audit_id, a.project_id
          FROM audit_pages ap
          JOIN audits a ON ap.audit_id = a.id
          WHERE ap.url = ? OR ap.url LIKE ?
          ORDER BY a.finished_at DESC
          LIMIT 1
        `).bind(normalizedUrl, `%${citation.domain}%`).first() as any;

        const audit_id = audit?.audit_id || null;
        const project_id = citation.project_id || audit?.project_id || 'unknown';

        // Check if already migrated
        const existing = await db.prepare(`
          SELECT id FROM citations
          WHERE cited_url = ? AND assistant = ? AND cited_at = ?
        `).bind(normalizedUrl, citation.assistant, citation.cited_at).first();

        if (existing) {
          skipped++;
          continue;
        }

        // Insert into new citations table
        await db.prepare(`
          INSERT INTO citations (
            project_id,
            audit_id,
            assistant,
            cited_url,
            cited_at,
            snippet,
            question,
            evidence_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          project_id,
          audit_id,
          citation.assistant,
          normalizedUrl,
          citation.cited_at,
          citation.snippet || null,
          citation.question || null,
          null  // evidence_url not in old schema
        ).run();

        migrated++;

        if (migrated % 100 === 0) {
          console.log(`[Migrate Citations] Migrated ${migrated} citations...`);
        }
      } catch (error) {
        console.error(`[Migrate Citations] Error migrating citation ${citation.id}:`, error);
        errors++;
      }
    }

    console.log(`[Migrate Citations] Complete! Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`);
  } catch (error) {
    console.error('[Migrate Citations] Fatal error:', error);
    throw error;
  }

  return { migrated, skipped, errors };
}

/**
 * Update audit_pages with citation aggregates
 * Should be run after migration
 */
export async function updateCitationAggregates(db: D1Database) {
  console.log('[Update Citation Aggregates] Starting...');

  // Get all audit pages
  const pages = await db.prepare(`
    SELECT id, url, audit_id
    FROM audit_pages
    LIMIT 10000
  `).all();

  if (!pages.results || pages.results.length === 0) {
    console.log('[Update Citation Aggregates] No pages found.');
    return { updated: 0 };
  }

  let updated = 0;

  for (const page of pages.results as any[]) {
    try {
      // Count citations for this URL
      const stats = await db.prepare(`
        SELECT 
          COUNT(*) as citation_count,
          GROUP_CONCAT(DISTINCT assistant) as assistants
        FROM citations
        WHERE cited_url = ? OR cited_url LIKE ?
      `).bind(page.url, `${page.url}%`).first() as any;

      const citation_count = stats?.citation_count || 0;
      const is_cited = citation_count > 0 ? 1 : 0;
      const assistants_citing = stats?.assistants ? JSON.stringify(stats.assistants.split(',')) : '[]';

      // Update audit_pages
      await db.prepare(`
        UPDATE audit_pages
        SET 
          is_cited = ?,
          citation_count = ?,
          assistants_citing = ?
        WHERE id = ?
      `).bind(is_cited, citation_count, assistants_citing, page.id).run();

      updated++;

      if (updated % 100 === 0) {
        console.log(`[Update Citation Aggregates] Updated ${updated}/${pages.results.length} pages...`);
      }
    } catch (error) {
      console.error(`[Update Citation Aggregates] Error updating page ${page.id}:`, error);
    }
  }

  console.log(`[Update Citation Aggregates] Complete! Updated: ${updated}`);
  return { updated };
}

