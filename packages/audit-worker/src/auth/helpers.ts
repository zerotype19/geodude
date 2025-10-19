/**
 * Auth helper functions
 */

import { readCookie } from './cookies';
import { getSession } from './service';

export interface Env {
  DB: D1Database;
  COOKIE_NAME?: string;
}

/**
 * Get user ID from session cookie in request
 * Returns null if not authenticated or session invalid
 */
export async function getUserIdFromRequest(request: Request, env: Env): Promise<string | null> {
  try {
    const cookieName = env.COOKIE_NAME || 'ov_sess';
    const sessionId = readCookie(request, cookieName);

    if (!sessionId) {
      return null;
    }

    const session = await getSession(env.DB, sessionId);

    if (!session) {
      return null;
    }

    return session.user_id;
  } catch (error) {
    console.error('[AUTH] Error getting user ID from request:', error);
    return null;
  }
}

