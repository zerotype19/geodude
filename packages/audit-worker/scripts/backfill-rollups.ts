/**
 * Backfill script to compute category & E-E-A-T rollups for existing audits
 * 
 * Usage:
 *   Called via worker endpoint: POST /api/admin/backfill-rollups
 * 
 * This script:
 * 1. Fetches all existing audit pages with checks_json
 * 2. Computes category & E-E-A-T rollups
 * 3. Updates audit_page_analysis.metadata with rollups
 */

import { computeCategoryRollups, computeEEATRollups, formatRollupsForStorage } from '../src/scoring/rollups';

export interface Env {
  DB: D1Database;
}

export async function backfillRollups(db: D1Database, limit: number = 1000) {
  console.log(`[Backfill Rollups] Starting backfill for up to ${limit} pages...`);

  // Fetch pages with checks_json
  const pages = await db.prepare(`
    SELECT 
      ap.id as page_id,
      ap.audit_id,
      ap.url,
      apa.id as analysis_id,
      apa.checks_json,
      apa.metadata
    FROM audit_pages ap
    LEFT JOIN audit_page_analysis apa ON ap.id = apa.page_id
    WHERE apa.checks_json IS NOT NULL
    LIMIT ?
  `).bind(limit).all();

  if (!pages.results || pages.results.length === 0) {
    console.log('[Backfill Rollups] No pages found to process.');
    return { processed: 0, errors: 0 };
  }

  console.log(`[Backfill Rollups] Found ${pages.results.length} pages to process.`);

  let processed = 0;
  let errors = 0;

  for (const page of pages.results as any[]) {
    try {
      // Parse existing checks
      const checks = JSON.parse(page.checks_json || '[]');
      
      // Build check scores map
      const checkScores: Record<string, number> = {};
      for (const check of checks) {
        checkScores[check.id] = check.score;
      }

      // Compute rollups
      const rollups = formatRollupsForStorage(checkScores);

      // Parse existing metadata or start fresh
      const metadata = page.metadata ? JSON.parse(page.metadata) : {};
      
      // Merge rollups into metadata
      metadata.category_scores = rollups.category_scores;
      metadata.eeat_scores = rollups.eeat_scores;

      // Update database
      await db.prepare(`
        UPDATE audit_page_analysis
        SET metadata = ?
        WHERE id = ?
      `).bind(JSON.stringify(metadata), page.analysis_id).run();

      processed++;

      if (processed % 100 === 0) {
        console.log(`[Backfill Rollups] Processed ${processed}/${pages.results.length} pages...`);
      }
    } catch (error) {
      console.error(`[Backfill Rollups] Error processing page ${page.page_id}:`, error);
      errors++;
    }
  }

  console.log(`[Backfill Rollups] Complete! Processed: ${processed}, Errors: ${errors}`);
  return { processed, errors };
}

