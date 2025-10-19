/**
 * Auth Telemetry & Observability
 * 
 * Lightweight event logging for auth events to KV namespace
 * Enables debugging, support, and analytics
 */

export interface AuthEvent {
  event: 
    | 'magic_request_sent'
    | 'magic_verify_success'
    | 'magic_verify_fail'
    | 'session_refresh'
    | 'session_created'
    | 'session_deleted'
    | 'rate_limit_hit';
  email?: string;
  userId?: string;
  sessionId?: string;
  intent?: string;
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Log an auth event to KV for observability
 * Events are stored with a 7-day TTL for debugging/analytics
 */
export async function logAuthEvent(
  kv: KVNamespace,
  event: Omit<AuthEvent, 'timestamp'>,
  request?: Request
): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const ip = request?.headers.get('CF-Connecting-IP') || undefined;
    const userAgent = request?.headers.get('User-Agent') || undefined;

    const fullEvent: AuthEvent = {
      ...event,
      timestamp,
      ip,
      userAgent,
    };

    // Store event in KV with 7-day TTL
    const eventKey = `auth_event:${timestamp}:${crypto.randomUUID()}`;
    await kv.put(eventKey, JSON.stringify(fullEvent), {
      expirationTtl: 7 * 24 * 60 * 60, // 7 days
    });

    // Also increment counters for quick stats
    const counterKey = `auth_counter:${event.event}:${new Date().toISOString().split('T')[0]}`;
    const currentCount = parseInt(await kv.get(counterKey) || '0', 10);
    await kv.put(counterKey, String(currentCount + 1), {
      expirationTtl: 30 * 24 * 60 * 60, // 30 days
    });

    console.log(`[AUTH_EVENT] ${event.event}:`, {
      email: event.email,
      userId: event.userId,
      intent: event.intent,
      reason: event.reason,
    });
  } catch (error) {
    // Never fail the main flow due to logging errors
    console.error('[AUTH_EVENT] Failed to log event:', error);
  }
}

/**
 * Get auth event statistics for admin dashboard
 */
export async function getAuthStats(kv: KVNamespace): Promise<{
  today: Record<string, number>;
  last7Days: Record<string, number>;
}> {
  const today = new Date().toISOString().split('T')[0];
  const eventTypes: AuthEvent['event'][] = [
    'magic_request_sent',
    'magic_verify_success',
    'magic_verify_fail',
    'session_refresh',
    'session_created',
    'session_deleted',
    'rate_limit_hit',
  ];

  const todayStats: Record<string, number> = {};
  const last7DaysStats: Record<string, number> = {};

  // Get today's counts
  for (const eventType of eventTypes) {
    const key = `auth_counter:${eventType}:${today}`;
    const count = parseInt(await kv.get(key) || '0', 10);
    todayStats[eventType] = count;
  }

  // Get last 7 days counts
  for (const eventType of eventTypes) {
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const key = `auth_counter:${eventType}:${dateStr}`;
      const count = parseInt(await kv.get(key) || '0', 10);
      total += count;
    }
    last7DaysStats[eventType] = total;
  }

  return { today: todayStats, last7Days: last7DaysStats };
}

/**
 * Get recent auth events for debugging
 */
export async function getRecentAuthEvents(
  kv: KVNamespace,
  limit: number = 50
): Promise<AuthEvent[]> {
  try {
    const list = await kv.list({ prefix: 'auth_event:', limit });
    const events: AuthEvent[] = [];

    for (const key of list.keys) {
      const value = await kv.get(key.name);
      if (value) {
        events.push(JSON.parse(value));
      }
    }

    // Sort by timestamp descending
    return events.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    console.error('[AUTH_EVENT] Failed to get recent events:', error);
    return [];
  }
}

