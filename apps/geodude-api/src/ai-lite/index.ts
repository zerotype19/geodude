export * from './classifier';
export * from './rollups';
export * from './backfill';
export * from './retention';

export interface AILiteConfig {
  samplePct: number;
  enforceAI: boolean;
  trackingMode: 'ai-lite' | 'full';
}

export interface AILiteContext {
  projectId: string;
  propertyId: number;
  config: AILiteConfig;
}

/**
 * Get AI-Lite configuration for a project
 */
export async function getProjectAILiteConfig(
  db: any,
  projectId: string,
  env: any
): Promise<AILiteConfig> {
  try {
    // Check if ENFORCE_AI_LITE is set
    const enforceAI = env.ENFORCE_AI_LITE === 'true';
    
    if (enforceAI) {
      return {
        samplePct: parseInt(env.AI_LITE_SAMPLE_PCT || '2'),
        enforceAI: true,
        trackingMode: 'ai-lite'
      };
    }
    
    // Get project's tracking mode from database
    const project = await db.prepare(`
      SELECT tracking_mode FROM project WHERE id = ?
    `).bind(projectId).first();
    
    const trackingMode = project?.tracking_mode || 'full';
    
    return {
      samplePct: parseInt(env.AI_LITE_SAMPLE_PCT || '2'),
      enforceAI: false,
      trackingMode: trackingMode as 'ai-lite' | 'full'
    };
    
  } catch (error) {
    console.error('Failed to get AI-Lite config:', error);
    // Default to full mode if we can't determine
    return {
      samplePct: parseInt(env.AI_LITE_SAMPLE_PCT || '2'),
      enforceAI: false,
      trackingMode: 'full'
    };
  }
}

/**
 * Check if a project is in AI-Lite mode
 */
export function isAILiteMode(config: AILiteConfig): boolean {
  return config.enforceAI || config.trackingMode === 'ai-lite';
}

/**
 * Get sampling percentage for a project
 */
export function getSamplingPercentage(config: AILiteConfig): number {
  const pct = config.samplePct;
  // Clamp to 0-5 as specified
  return Math.max(0, Math.min(5, pct));
}
