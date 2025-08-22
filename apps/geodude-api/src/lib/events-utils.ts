import type { TrafficClassification } from '../ai-lite/classifier';
import { ensureAiSource } from './ai-sources';
import { upsertRollup } from '../ai-lite/rollups';

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
  botCategory?: string | null;
}

/**
 * Update rollup data for an event using the new AI-Lite rollup system
 */
export async function updateRollup(
  env: any,
  rollupData: RollupData
): Promise<boolean> {
  try {
    const { project_id, property_id, timestamp, trafficClass, isSampled, botCategory } = rollupData;
    
    // Use the new AI-Lite rollup system
    await upsertRollup(
      env.OPTIVIEW_DB,
      project_id,
      property_id,
      timestamp,
      trafficClass as any, // Cast to TrafficClass for now
      isSampled,
      botCategory
    );

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
  classification: TrafficClassification
): Promise<{ aiSourceId: number | null; category: string }> {
  if (!classification.aiSourceSlug) {
    return { aiSourceId: null, category: 'unknown' };
  }

  // Determine category based on classification class
  let category: 'crawler' | 'assistant' | 'unknown' = 'unknown';
  if (classification.class === 'crawler') {
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
  classification: TrafficClassification,
  isAILite: boolean,
  samplePct: number
): { shouldInsert: boolean; isSampled: boolean } {
  // AI traffic is always inserted
  if (classification.class === 'human_via_ai' || classification.class === 'crawler') {
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
export function shouldAttachToSession(classification: TrafficClassification): boolean {
  // Crawlers never attach to sessions
  return classification.class !== 'crawler';
}
