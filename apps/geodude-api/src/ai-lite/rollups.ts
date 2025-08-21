export interface RollupEntry {
  project_id: string;
  property_id: number;
  ts_hour: number;
  class: string;
  events_count: number;
  sampled_count: number;
}

/**
 * Round timestamp to start of hour (UTC)
 */
export function roundToHour(timestamp: Date): number {
  const hour = new Date(timestamp);
  hour.setMinutes(0, 0, 0);
  return Math.floor(hour.getTime() / 1000);
}

/**
 * Upsert rollup entry for a traffic class
 */
export async function upsertRollup(
  db: any,
  projectId: string,
  propertyId: number,
  timestamp: Date,
  trafficClass: string,
  isSampled: boolean = false
): Promise<void> {
  const tsHour = roundToHour(timestamp);

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
    console.error('Rollup upsert failed:', error);
    throw error;
  }
}

/**
 * Get rollup data for a project in a time window
 */
export async function getRollupsInWindow(
  db: any,
  projectId: string,
  startTime: Date,
  endTime: Date
): Promise<RollupEntry[]> {
  const startHour = roundToHour(startTime);
  const endHour = roundToHour(endTime);

  try {
    const result = await db.prepare(`
      SELECT project_id, property_id, ts_hour, class, events_count, sampled_count
      FROM traffic_rollup_hourly
      WHERE project_id = ?
        AND ts_hour >= ?
        AND ts_hour <= ?
      ORDER BY ts_hour, class
    `).bind(projectId, startHour, endHour).all();

    return result.results || [];
  } catch (error) {
    console.error('Failed to get rollups in window:', error);
    return [];
  }
}

/**
 * Get rollup totals for a project in a time window
 */
export async function getRollupTotals(
  db: any,
  projectId: string,
  startTime: Date,
  endTime: Date
): Promise<Record<string, { total: number; sampled: number }>> {
  const rollups = await getRollupsInWindow(db, projectId, startTime, endTime);

  const totals: Record<string, { total: number; sampled: number }> = {};

  for (const rollup of rollups) {
    if (!totals[rollup.class]) {
      totals[rollup.class] = { total: 0, sampled: 0 };
    }

    totals[rollup.class].total += rollup.events_count;
    totals[rollup.class].sampled += rollup.sampled_count;
  }

  return totals;
}

/**
 * Get last 5-minute rollup data for health dashboard
 */
export async function getLast5MinuteRollups(
  db: any,
  projectId: string
): Promise<Record<string, number>> {
  const now = new Date();
  const currentHour = roundToHour(now);

  try {
    const result = await db.prepare(`
      SELECT class, SUM(events_count) as total
      FROM traffic_rollup_hourly
      WHERE project_id = ?
        AND ts_hour = ?
      GROUP BY class
    `).bind(projectId, currentHour).all();

    const rollups: Record<string, number> = {};

    for (const row of result.results || []) {
      rollups[row.class] = row.total;
    }

    return rollups;
  } catch (error) {
    console.error('Failed to get last 5-minute rollups:', error);
    return {};
  }
}
