/**
 * Cloudflare signal extraction and normalization
 * Handles all known variants of CF fields and normalizes them to a consistent internal format
 */

export interface CloudflareSignals {
  cfVerified: boolean;
  cfSource: 'bot_management' | 'client.bot' | 'absent';
  cfCategoryRaw: string | null;
  cfASN: number | null;
  cfOrg: string | null;
}

/**
 * Extract and normalize Cloudflare signals from a request
 * Reads all known variants of CF fields and normalizes them to a consistent format
 */
export function extractCfSignals(request: Request): CloudflareSignals {
  const cf = (request as any).cf || {};
  
  // Read all known variants of CF fields
  const cfVerifiedBM = cf.bot_management?.verified_bot ?? null;  // authoritative when present
  const cfClientBot = cf.client?.bot ?? null;                    // weaker signal
  const cfCategoryRaw = cf.verifiedBotCategory ?? cf.verified_bot_category ?? null;
  const cfASN = cf.asn ?? null;
  const cfOrg = cf.asOrganization ?? null;

  // Determine verification status and source
  let cfVerified = false;
  let cfSource: 'bot_management' | 'client.bot' | 'absent' = 'absent';

  if (cfVerifiedBM !== null) {
    cfVerified = !!cfVerifiedBM;
    cfSource = 'bot_management';
  } else if (cfClientBot !== null) {
    cfVerified = !!cfClientBot;
    cfSource = 'client.bot';
  }

  return {
    cfVerified,
    cfSource,
    cfCategoryRaw,
    cfASN,
    cfOrg
  };
}

/**
 * Map Cloudflare category strings to our internal bot category enums
 * Maps CF strings to existing enums without adding new ones
 */
export function mapCfCategory(category?: string | null): 'ai_training' | 'search_crawler' | 'preview_bot' | 'unknown' {
  if (!category) return 'unknown';
  
  const t = category.toLowerCase();
  
  if (t.includes('search')) return 'search_crawler';
  if (t.includes('training') || t.includes('model')) return 'ai_training';
  if (t.includes('preview') || t.includes('unfurl')) return 'preview_bot';
  
  return 'unknown';
}

/**
 * Generate debug signals for Cloudflare data
 * Returns an array of strings in the exact format specified
 */
export function generateCfDebugSignals(cfSignals: CloudflareSignals): string[] {
  const signals: string[] = [];
  
  // Always include verification status and source
  signals.push(`cf.verified=${cfSignals.cfVerified}`);
  signals.push(`cf.source=${cfSignals.cfSource}`);
  
  // Include category if present
  if (cfSignals.cfCategoryRaw) {
    signals.push(`cf.cat=${cfSignals.cfCategoryRaw}`);
    signals.push(`cf.cat_mapped=${mapCfCategory(cfSignals.cfCategoryRaw)}`);
  } else {
    signals.push(`cf.cat_mapped=unknown`);
  }
  
  // Include ASN and org if present
  if (cfSignals.cfASN) {
    signals.push(`cf.asn=${cfSignals.cfASN}`);
  }
  
  if (cfSignals.cfOrg) {
    signals.push(`cf.org=${cfSignals.cfOrg}`);
  }
  
  return signals;
}
