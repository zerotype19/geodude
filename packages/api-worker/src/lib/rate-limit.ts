/**
 * Rate Limiting Utilities
 * Clean, reversible way to disable daily audit limit while keeping other safety rails
 */

export interface Env {
  RATE_LIMIT_KV?: KVNamespace;
  AUDIT_DAILY_LIMIT?: string;
  RATE_LIMIT_DAILY_ENABLED?: string;
  INTERNAL_ADMIN_TOKEN?: string;
}

/**
 * Check if daily rate limiting is enabled
 * Default: enabled unless explicitly "0"
 */
export function dailyLimitEnabled(env: Env): boolean {
  return String(env.RATE_LIMIT_DAILY_ENABLED ?? '1') !== '0';
}

/**
 * Check if request is from admin (bypass rate limits)
 */
export function isAdminBypass(req: Request, env: Env, orgRole?: string): boolean {
  const hdr = req.headers.get('x-optiview-admin') || '';
  return hdr === env.INTERNAL_ADMIN_TOKEN || orgRole === 'owner';
}

/**
 * Enforce daily audit limit with feature flag support
 * Returns { allowed: boolean, count: number, limit: number }
 */
export async function enforceDailyAuditLimit(env: Env, projectId: string): Promise<{ allowed: boolean; count: number; limit: number }> {
  // Bypass completely if daily limit is disabled
  if (!dailyLimitEnabled(env)) {
    return { allowed: true, count: 0, limit: 0 };
  }

  // Original daily limit logic
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `rl:${projectId}:${today}`;
  
  const currentCount = await env.RATE_LIMIT_KV?.get(key);
  const count = currentCount ? parseInt(currentCount) : 0;
  const limit = parseInt(env.AUDIT_DAILY_LIMIT || '10');

  if (count >= limit) {
    return { allowed: false, count, limit };
  }

  // Increment counter
  await env.RATE_LIMIT_KV?.put(key, (count + 1).toString(), {
    expirationTtl: 86400 * 2, // 2 days
  });

  return { allowed: true, count: count + 1, limit };
}

/**
 * Clear daily counters for testing (optional maintenance function)
 */
export async function clearDailyCounters(env: Env, projectId?: string): Promise<{ deleted: number }> {
  const today = new Date().toISOString().slice(0,10).replace(/-/g,''); // YYYYMMDD
  const prefix = projectId ? `rl:${projectId}:${today}` : `rl:`;
  
  const list = await env.RATE_LIMIT_KV?.list({ prefix }) || { keys: [] };
  let deleted = 0;
  
  for (const key of list.keys) {
    if (key.name.endsWith(today)) {
      await env.RATE_LIMIT_KV?.delete(key.name);
      deleted++;
    }
  }
  
  return { deleted };
}
