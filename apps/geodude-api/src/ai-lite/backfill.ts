import { roundToHour } from './rollups';

export interface BackfillStats {
  processed: number;
  rollupsCreated: number;
  errors: number;
}

/**
 * Backfill traffic_rollup_hourly from existing interaction_events
 * Window: 14 days (as specified)
 */
export async function backfillRollups(
  db: any,
  projectId: string,
  daysBack: number = 14
): Promise<BackfillStats> {
  const now = new Date();
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  
  console.log(`Starting rollup backfill for project ${projectId}, ${daysBack} days back`);
  
  const stats: BackfillStats = {
    processed: 0,
    rollupsCreated: 0,
    errors: 0
  };

  try {
    // Get all events in the backfill window
    const events = await db.prepare(`
      SELECT id, project_id, property_id, occurred_at, ai_source_id, event_type
      FROM interaction_events
      WHERE project_id = ?
        AND occurred_at >= ?
      ORDER BY occurred_at
    `).bind(projectId, startDate.toISOString()).all();

    if (!events.results || events.results.length === 0) {
      console.log('No events found for backfill');
      return stats;
    }

    console.log(`Found ${events.results.length} events to backfill`);

    // Process events in batches to avoid memory issues
    const batchSize = 1000;
    for (let i = 0; i < events.results.length; i += batchSize) {
      const batch = events.results.slice(i, i + batchSize);
      
      for (const event of batch) {
        try {
          // Determine traffic class based on existing data
          const trafficClass = determineTrafficClassFromEvent(event);
          
          // Round to hour
          const tsHour = roundToHour(new Date(event.occurred_at));
          
          // Upsert rollup (events_count += 1, sampled_count += 0 for historical data)
          await upsertRollupEntry(db, projectId, event.property_id, tsHour, trafficClass, false);
          
          stats.processed++;
          stats.rollupsCreated++;
        } catch (error) {
          console.error(`Error processing event ${event.id}:`, error);
          stats.errors++;
        }
      }
      
      // Log progress
      if (i % (batchSize * 10) === 0) {
        console.log(`Processed ${i + batch.results.length}/${events.results.length} events`);
      }
    }

    console.log(`Backfill completed: ${stats.processed} processed, ${stats.rollupsCreated} rollups created, ${stats.errors} errors`);
    return stats;

  } catch (error) {
    console.error('Backfill failed:', error);
    throw error;
  }
}

/**
 * Determine traffic class from existing event data
 * This is a simplified classification for historical data
 */
function determineTrafficClassFromEvent(event: any): string {
  // If AI source is present, classify as AI traffic
  if (event.ai_source_id) {
    return 'human_via_ai';
  }
  
  // For historical data without detailed classification, default to direct_human
  // This is conservative and ensures we don't lose data
  return 'direct_human';
}

/**
 * Upsert a single rollup entry (optimized for backfill)
 */
async function upsertRollupEntry(
  db: any,
  projectId: string,
  propertyId: number,
  tsHour: number,
  trafficClass: string,
  isSampled: boolean
): Promise<void> {
  try {
    // Try to update existing rollup
    const updateResult = await db.prepare(`
      UPDATE traffic_rollup_hourly 
      SET events_count = events_count + 1,
          sampled_count = sampled_count + ?
      WHERE project_id = ? 
        AND property_id = ? 
        AND ts_hour = ? 
        AND class = ?
    `).bind(isSampled ? 1 : 0, projectId, propertyId, tsHour, trafficClass).run();

    // If no rows were updated, insert new rollup
    if (updateResult.changes === 0) {
      await db.prepare(`
        INSERT INTO traffic_rollup_hourly 
        (project_id, property_id, ts_hour, class, events_count, sampled_count)
        VALUES (?, ?, ?, ?, 1, ?)
      `).bind(projectId, propertyId, tsHour, trafficClass, isSampled ? 1 : 0).run();
    }
  } catch (error) {
    console.error('Rollup upsert failed during backfill:', error);
    throw error;
  }
}

/**
 * Check if backfill is needed for a project
 */
export async function needsBackfill(
  db: any,
  projectId: string
): Promise<boolean> {
  try {
    const result = await db.prepare(`
      SELECT COUNT(*) as count
      FROM traffic_rollup_hourly
      WHERE project_id = ?
    `).bind(projectId).first();

    return (result?.count || 0) === 0;
  } catch (error) {
    console.error('Failed to check if backfill is needed:', error);
    return true; // Assume backfill is needed if we can't check
  }
}
