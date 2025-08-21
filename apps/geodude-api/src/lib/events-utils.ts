import type { Classification } from './classifier';
import { ensureAiSource } from './ai-sources';

export interface EventInsertData {
  project_id: string;
  property_id: number;
  content_id: number | null;
  ai_source_id: number | null;
  event_type: string;
  metadata: string;
  occurred_at: string;
  sampled: number;
}

export interface RollupData {
  project_id: string;
  property_id: number;
  timestamp: Date;
  trafficClass: string;
  isSampled: boolean;
}

/**
 * Update rollup data for an event
 */
export async function updateRollup(
  env: any,
  rollupData: RollupData
): Promise<boolean> {
  try {
    const { project_id, property_id, timestamp, trafficClass, isSampled } = rollupData;
    
    // Round timestamp to hour (UTC)
    const tsHour = Math.floor(timestamp.getTime() / 1000 / 3600) * 3600;
    
    // Use INSERT ... ON CONFLICT for proper upsert behavior
    await env.OPTIVIEW_DB.prepare(`
      INSERT INTO traffic_rollup_hourly 
      (project_id, property_id, ts_hour, class, events_count, sampled_count)
      VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(project_id, property_id, ts_hour, class) 
      DO UPDATE SET 
        events_count = events_count + 1,
        sampled_count = sampled_count + ?
    `).bind(
      project_id, 
      property_id, 
      tsHour, 
      trafficClass, 
      isSampled ? 1 : 0,
      isSampled ? 1 : 0
    ).run();

    return true;
  } catch (error) {
    console.error('Rollup update failed:', error);
    return false;
  }
}

/**
 * Insert an event into the database
 */
export async function insertEvent(
  env: any,
  eventData: EventInsertData
): Promise<number | null> {
  try {
    const result = await env.OPTIVIEW_DB.prepare(`
      INSERT INTO interaction_events (
        project_id, property_id, content_id, ai_source_id, 
        event_type, metadata, occurred_at, sampled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      eventData.project_id,
      eventData.property_id,
      eventData.content_id,
      eventData.ai_source_id,
      eventData.event_type,
      eventData.metadata,
      eventData.occurred_at,
      eventData.sampled
    ).run();

    return result.meta?.last_row_id || null;
  } catch (error) {
    console.error('Event insert failed:', error);
    return null;
  }
}

/**
 * Process event classification and ensure AI source exists
 */
export async function processEventClassification(
  env: any,
  classification: Classification
): Promise<{ aiSourceId: number | null; category: string }> {
  if (!classification.aiSourceSlug) {
    return { aiSourceId: null, category: 'unknown' };
  }

  // Determine category based on classification class
  let category: 'crawler' | 'assistant' | 'unknown' = 'unknown';
  if (classification.class === 'ai_agent_crawl') {
    category = 'crawler';
  } else if (classification.class === 'human_via_ai') {
    category = 'assistant';
  }

  // Ensure AI source exists and get ID
  const aiSourceId = await ensureAiSource(
    env, 
    classification.aiSourceSlug, 
    classification.aiSourceName || classification.aiSourceSlug,
    category
  );

  return { aiSourceId, category };
}

/**
 * Determine if an event should be inserted based on AI-Lite mode and classification
 */
export function shouldInsertEvent(
  classification: Classification,
  isAILite: boolean,
  samplePct: number
): { shouldInsert: boolean; isSampled: boolean } {
  // AI traffic is always inserted
  if (classification.class === 'ai_agent_crawl' || classification.class === 'human_via_ai') {
    return { shouldInsert: true, isSampled: false };
  }

  // In AI-Lite mode, apply sampling to baseline traffic
  if (isAILite && (classification.class === 'search' || classification.class === 'direct_human')) {
    const random = Math.random() * 100;
    const isSampled = random < samplePct;
    return { shouldInsert: isSampled, isSampled };
  }

  // Full mode: always insert
  return { shouldInsert: true, isSampled: false };
}

/**
 * Determine if an event should be attached to a session
 */
export function shouldAttachToSession(classification: Classification): boolean {
  // Crawlers never attach to sessions
  return classification.class !== 'ai_agent_crawl';
}
