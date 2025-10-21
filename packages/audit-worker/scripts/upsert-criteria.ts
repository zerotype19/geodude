/**
 * One-time script to upsert audit_criteria from CRITERIA registry
 * 
 * Usage:
 *   npx tsx scripts/upsert-criteria.ts
 * 
 * This populates the audit_criteria table with category, eeat_pillar, and impact_level
 * for all checks defined in the CRITERIA registry.
 */

import { CRITERIA } from '../src/scoring/criteria';

export interface Env {
  DB: D1Database;
}

export async function upsertCriteria(db: D1Database) {
  console.log(`[Upsert Criteria] Starting upsert for ${CRITERIA.length} criteria...`);

  let inserted = 0;
  let updated = 0;

  for (const criterion of CRITERIA) {
    try {
      // Check if criterion exists
      const existing = await db.prepare(
        'SELECT id FROM audit_criteria WHERE id = ?'
      ).bind(criterion.id).first();

      if (existing) {
        // Update existing
        await db.prepare(`
          UPDATE audit_criteria 
          SET 
            title = ?,
            description = ?,
            category = ?,
            eeat_pillar = ?,
            impact_level = ?,
            weight = ?
          WHERE id = ?
        `).bind(
          criterion.title,
          criterion.description,
          criterion.category,
          criterion.eeat,
          criterion.impact,
          criterion.weight,
          criterion.id
        ).run();
        updated++;
      } else {
        // Insert new
        await db.prepare(`
          INSERT INTO audit_criteria (id, title, description, category, eeat_pillar, impact_level, weight)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          criterion.id,
          criterion.title,
          criterion.description,
          criterion.category,
          criterion.eeat,
          criterion.impact,
          criterion.weight
        ).run();
        inserted++;
      }

      console.log(`[Upsert Criteria] ${criterion.id}: ${criterion.title} - ${existing ? 'Updated' : 'Inserted'}`);
    } catch (error) {
      console.error(`[Upsert Criteria] Error processing ${criterion.id}:`, error);
    }
  }

  console.log(`[Upsert Criteria] Complete! Inserted: ${inserted}, Updated: ${updated}`);
  return { inserted, updated };
}

// If run directly (not imported as module)
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Run this script via wrangler or as part of a worker deployment.');
  console.log('For local testing, use: wrangler dev --local --persist');
}

