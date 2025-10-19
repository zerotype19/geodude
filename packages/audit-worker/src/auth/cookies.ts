/**
 * Cookie utilities for session management
 */

/**
 * Create a session cookie header value
 */
export function makeSessionCookie(
  cookieName: string,
  sessionId: string,
  ttlDays: number
): string {
  const expires = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toUTCString();
  return `${cookieName}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`;
}

/**
 * Create a cookie deletion header value
 */
export function clearSessionCookie(cookieName: string): string {
  return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/**
 * Read a cookie value from request headers
 */
export function readCookie(request: Request, cookieName: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith(`${cookieName}=`));
  
  if (!sessionCookie) return null;
  
  return sessionCookie.split('=')[1] || null;
}

/**
 * Get client IP from request
 */
export function getClientIp(request: Request): string | null {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
         null;
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: Request): string | null {
  return request.headers.get('User-Agent') || null;
}

