/**
 * Auth service layer for magic link authentication
 */

import { sha256, createMagicToken, generateId } from './crypto';

export interface MagicLinkIntent {
  email: string;
  intent: 'start_audit' | 'open_audit' | 'general';
  auditId?: string;
  payload?: any;
  redirectPath?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface MagicLinkResult {
  verifyUrl: string;
  expiresAt: string;
  token: string; // raw token for email
}

export interface VerifyResult {
  ok: boolean;
  user?: {
    id: string;
    email: string;
  };
  sessionId?: string;
  intent?: string;
  auditId?: string | null;
  payload?: any;
  redirectPath?: string | null;
}

/**
 * Issue a magic link token
 */
export async function issueMagicToken(
  db: D1Database,
  input: MagicLinkIntent,
  config: { baseUrl: string; ttlMinutes: number }
): Promise<MagicLinkResult> {
  const email = input.email.trim().toLowerCase();
  const id = generateId();
  const rawToken = createMagicToken(email);
  const tokenHash = await sha256(rawToken);
  
  const now = new Date();
  const expires = new Date(now.getTime() + config.ttlMinutes * 60 * 1000);

  await db.prepare(`
    INSERT INTO magic_tokens (
      id, token_hash, email, intent, audit_id, payload_json, 
      redirect_path, issued_at, expires_at, ip_address, user_agent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    tokenHash,
    email,
    input.intent,
    input.auditId ?? null,
    input.payload ? JSON.stringify(input.payload) : null,
    input.redirectPath ?? null,
    now.toISOString(),
    expires.toISOString(),
    input.ipAddress ?? null,
    input.userAgent ?? null
  ).run();

  const verifyUrl = `${config.baseUrl}/auth/callback?token=${encodeURIComponent(rawToken)}`;
  
  return {
    verifyUrl,
    expiresAt: expires.toISOString(),
    token: rawToken
  };
}

/**
 * Verify a magic link token and create/update session
 */
export async function verifyMagicToken(
  db: D1Database,
  rawToken: string,
  config: { sessionTtlDays: number }
): Promise<VerifyResult> {
  const tokenHash = await sha256(rawToken);
  
  // Find unused, unexpired token
  const row = await db.prepare(`
    SELECT * FROM magic_tokens
    WHERE token_hash = ? 
      AND used_at IS NULL 
      AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')
    LIMIT 1
  `).bind(tokenHash).first();

  if (!row) {
    return { ok: false };
  }

  // Mark token as used
  await db.prepare(`
    UPDATE magic_tokens 
    SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') 
    WHERE id = ?
  `).bind(row.id).run();

  const email = row.email as string;
  const intent = row.intent as string;
  const auditId = row.audit_id as string | null;
  const payloadJson = row.payload_json as string | null;
  const redirectPath = row.redirect_path as string | null;

  // Upsert user
  let user = await db.prepare(`
    SELECT * FROM users WHERE email = ?
  `).bind(email).first();

  if (!user) {
    const userId = generateId();
    await db.prepare(`
      INSERT INTO users (id, email, created_at, last_login_at)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).bind(userId, email).run();
    user = { id: userId, email };
  } else {
    // Update last login
    await db.prepare(`
      UPDATE users 
      SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).bind(user.id).run();
  }

  // Create session
  const sessionId = generateId();
  const now = new Date();
  const sessionExpires = new Date(now.getTime() + config.sessionTtlDays * 24 * 60 * 60 * 1000);

  await db.prepare(`
    INSERT INTO sessions (
      id, user_id, created_at, last_seen_at, auth_age_at, 
      user_agent, ip_address, expires_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    sessionId,
    user.id,
    now.toISOString(),
    now.toISOString(),
    now.toISOString(),
    row.user_agent ?? null,
    row.ip_address ?? null,
    sessionExpires.toISOString()
  ).run();

  return {
    ok: true,
    user: {
      id: user.id as string,
      email: user.email as string
    },
    sessionId,
    intent,
    auditId,
    payload: payloadJson ? JSON.parse(payloadJson) : null,
    redirectPath
  };
}

/**
 * Get session by ID
 */
export async function getSession(db: D1Database, sessionId: string) {
  const session = await db.prepare(`
    SELECT s.*, u.email, u.is_admin
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? 
      AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')
    LIMIT 1
  `).bind(sessionId).first();

  return session;
}

/**
 * Touch session (update last_seen_at)
 */
export async function touchSession(db: D1Database, sessionId: string) {
  await db.prepare(`
    UPDATE sessions 
    SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?
  `).bind(sessionId).run();
}

/**
 * Delete session (logout)
 */
export async function deleteSession(db: D1Database, sessionId: string) {
  await db.prepare(`
    DELETE FROM sessions WHERE id = ?
  `).bind(sessionId).run();
}

/**
 * Check rate limit for magic link requests
 */
export async function checkRateLimit(
  db: D1Database,
  key: string, // email or IP
  maxRequestsPerHour: number
): Promise<{ allowed: boolean; remainingRequests: number }> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // Get or create rate limit entry
  const row = await db.prepare(`
    SELECT * FROM auth_rate_limits WHERE key = ?
  `).bind(key).first();

  if (!row) {
    // First request
    await db.prepare(`
      INSERT INTO auth_rate_limits (key, count, window_start, last_request_at)
      VALUES (?, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).bind(key).run();
    return { allowed: true, remainingRequests: maxRequestsPerHour - 1 };
  }

  const windowStart = new Date(row.window_start as string);
  const count = row.count as number;

  // Check if window has expired
  if (windowStart < oneHourAgo) {
    // Reset window
    await db.prepare(`
      UPDATE auth_rate_limits 
      SET count = 1, 
          window_start = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
          last_request_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE key = ?
    `).bind(key).run();
    return { allowed: true, remainingRequests: maxRequestsPerHour - 1 };
  }

  // Window still active
  if (count >= maxRequestsPerHour) {
    return { allowed: false, remainingRequests: 0 };
  }

  // Increment count
  await db.prepare(`
    UPDATE auth_rate_limits 
    SET count = count + 1,
        last_request_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE key = ?
  `).bind(key).run();

  return { allowed: true, remainingRequests: maxRequestsPerHour - count - 1 };
}

/**
 * Verify audit ownership
 */
export async function verifyAuditOwnership(
  db: D1Database,
  auditId: string,
  userId: string
): Promise<boolean> {
  const audit = await db.prepare(`
    SELECT user_id FROM audits WHERE id = ?
  `).bind(auditId).first();

  if (!audit) {
    return false;
  }

  return audit.user_id === userId;
}

