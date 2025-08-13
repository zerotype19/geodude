/**
 * Authentication middleware for protecting routes
 */

import { log } from "./logging";
import { parseSessionCookie, getClientIP, getUserAgent, hashSensitiveData } from "./auth";
import type { User, Session } from "./auth";

export interface AuthenticatedRequest extends Request {
  user: User;
  session: Session;
}

export interface Env {
  OPTIVIEW_DB: D1Database;
}

/**
 * Require authentication - loads user and session from cookie
 */
export async function requireAuth(req: Request, env: Env): Promise<{ user: User; session: Session }> {
  const sessionId = parseSessionCookie(req.headers.get('cookie'));
  
  if (!sessionId) {
    throw new Error('No session cookie found');
  }

  // Load session from database
  const session = await env.OPTIVIEW_DB.prepare(`
    SELECT s.*, u.id, u.email, u.is_admin, u.created_at
    FROM session s
    JOIN user u ON s.user_id = u.id
    WHERE s.session_id = ?
  `).bind(sessionId).first<Session & User>();

  if (!session) {
    throw new Error('Invalid session');
  }

  // Check if session is expired
  if (new Date(session.expires_at) < new Date()) {
    // Clean up expired session
    await env.OPTIVIEW_DB.prepare(`
      DELETE FROM session WHERE session_id = ?
    `).bind(sessionId).run();
    
    throw new Error('Session expired');
  }

  // Opportunistically clean up expired sessions (up to 200)
  try {
    await env.OPTIVIEW_DB.prepare(`
      DELETE FROM session 
      WHERE expires_at < datetime('now')
      LIMIT 200
    `).run();
  } catch (error) {
    // Log but don't fail the request
    log("session_cleanup_error", { error: String(error) });
  }

  return { user, session };
}

/**
 * Require admin privileges
 */
export async function requireAdmin(req: Request, env: Env): Promise<{ user: User; session: Session }> {
  const { user, session } = await requireAuth(req, env);
  
  if (!user.is_admin) {
    throw new Error('Admin privileges required');
  }

  return { user, session };
}

/**
 * Optional authentication - returns user/session if available, null if not
 */
export async function optionalAuth(req: Request, env: Env): Promise<{ user: User; session: Session } | null> {
  try {
    return await requireAuth(req, env);
  } catch (error) {
    return null;
  }
}

/**
 * Create a new session for a user
 */
export async function createSession(
  env: Env, 
  userId: string, 
  req: Request, 
  sessionTTLHours: number = 720
): Promise<string> {
  const sessionId = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + sessionTTLHours * 60 * 60 * 1000);
  const clientIP = getClientIP(req);
  const userAgent = getUserAgent(req);
  
  const ipHash = await hashSensitiveData(clientIP);
  const uaHash = await hashSensitiveData(userAgent);

  await env.OPTIVIEW_DB.prepare(`
    INSERT INTO session (user_id, session_id, created_at, expires_at, ip_hash, ua_hash)
    VALUES (?, ?, datetime('now'), ?, ?, ?)
  `).bind(userId, sessionId, expiresAt.toISOString(), ipHash, uaHash).run();

  return sessionId;
}

/**
 * Delete a session by ID
 */
export async function deleteSession(env: Env, sessionId: string): Promise<void> {
  await env.OPTIVIEW_DB.prepare(`
    DELETE FROM session WHERE session_id = ?
  `).bind(sessionId).run();
}

/**
 * Delete all sessions for a user
 */
export async function deleteUserSessions(env: Env, userId: string): Promise<void> {
  await env.OPTIVIEW_DB.prepare(`
    DELETE FROM session WHERE user_id = ?
  `).bind(userId).run();
}

/**
 * Get user by email (create if doesn't exist)
 */
export async function getOrCreateUser(env: Env, email: string): Promise<User> {
  // Try to get existing user
  let user = await env.OPTIVIEW_DB.prepare(`
    SELECT id, email, is_admin, created_at FROM user WHERE email = ?
  `).bind(email).first<User>();

  if (!user) {
    // Create new user
    const userId = `usr_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
    const now = new Date().toISOString();
    
    await env.OPTIVIEW_DB.prepare(`
      INSERT INTO user (id, email, is_admin, created_at)
      VALUES (?, ?, 0, ?)
    `).bind(userId, email, now).run();

    user = {
      id: userId,
      email,
      is_admin: 0,
      created_at: now
    };

    log("user_created", { user_id: userId, email });
  }

  return user;
}

/**
 * Check if user is admin
 */
export async function isUserAdmin(env: Env, userId: string): Promise<boolean> {
  const user = await env.OPTIVIEW_DB.prepare(`
    SELECT is_admin FROM user WHERE id = ?
  `).bind(userId).first<{ is_admin: number }>();

  return user?.is_admin === 1;
}

/**
 * Bootstrap admin user (only when no admin exists)
 */
export async function bootstrapAdmin(env: Env, email: string): Promise<User | null> {
  // Check if any admin exists
  const adminExists = await env.OPTIVIEW_DB.prepare(`
    SELECT COUNT(*) as count FROM user WHERE is_admin = 1
  `).first<{ count: number }>();

  if (adminExists && adminExists.count > 0) {
    return null; // Admin already exists
  }

  // Get or create user
  const user = await getOrCreateUser(env, email);
  
  // Make them admin
  await env.OPTIVIEW_DB.prepare(`
    UPDATE user SET is_admin = 1 WHERE id = ?
  `).bind(user.id).run();

  user.is_admin = 1;
  
  log("admin_bootstrapped", { user_id: user.id, email });
  return user;
}
