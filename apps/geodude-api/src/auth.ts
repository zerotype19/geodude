/**
 * Authentication utilities for OTP-based login
 */

import { hashString } from "./utils";

export interface User {
  id: string;
  email: string;
  is_admin: number;
  created_at: string;
}

export interface Session {
  id: number;
  user_id: string;
  session_id: string;
  created_at: string;
  expires_at: string;
  ip_hash: string;
  ua_hash: string;
}

export interface LoginCode {
  id: number;
  email: string;
  code_hash: string;
  created_at: string;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
  requester_ip_hash: string;
}

/**
 * Generate a random 6-digit OTP code
 */
export function generateOTPCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a random 128-bit session ID (base64url encoded)
 */
export function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  
  // Convert to base64url (no padding, no + or /)
  let base64 = btoa(String.fromCharCode(...bytes));
  base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  return base64;
}

/**
 * Normalize and validate email address
 */
export function normalizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  
  // Basic email validation (RFC-like, allows plus tags)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(trimmed) || trimmed.length > 254) {
    return null;
  }
  
  return trimmed;
}

/**
 * Hash sensitive data for storage
 */
export async function hashSensitiveData(data: string): Promise<string> {
  return await hashString(data);
}

/**
 * Check if a session is expired
 */
export function isSessionExpired(session: Session): boolean {
  return new Date(session.expires_at) < new Date();
}

/**
 * Check if a login code is expired
 */
export function isLoginCodeExpired(code: LoginCode): boolean {
  return new Date(code.expires_at) < new Date();
}

/**
 * Check if a login code is locked (too many attempts)
 */
export function isLoginCodeLocked(code: LoginCode): boolean {
  return code.attempts >= 5;
}

/**
 * Check if a login code is consumed
 */
export function isLoginCodeConsumed(code: LoginCode): boolean {
  return code.consumed_at !== null;
}

/**
 * Generate session expiration time
 */
export function generateSessionExpiry(hours: number = 720): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Generate OTP expiration time
 */
export function generateOTPExpiry(minutes: number = 10): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Parse session cookie value
 */
export function parseSessionCookie(cookieHeader: string | null, cookieName: string = 'ov_sess'): string | null {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${cookieName}=`)) {
      return cookie.substring(cookieName.length + 1);
    }
  }
  
  return null;
}

/**
 * Set session cookie in response
 */
export function setSessionCookie(response: Response, sessionId: string, maxAge: number): void {
  const cookieValue = `ov_sess=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
  response.headers.set('Set-Cookie', cookieValue);
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(response: Response): void {
  const cookieValue = 'ov_sess=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  response.headers.set('Set-Cookie', cookieValue);
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(req: Request): string {
  return req.headers.get('cf-connecting-ip') || 
         req.headers.get('x-forwarded-for')?.split(',')[0] || 
         req.headers.get('x-real-ip') || 
         'unknown';
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(req: Request): string {
  return req.headers.get('user-agent') || 'unknown';
}

/**
 * Generate magic link token (24 bytes, base64url encoded)
 */
export function generateMagicLinkToken(): string {
  // Generate 24-byte random token, base64url encoded (no padding)
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  
  // Convert to base64url (no padding)
  const base64 = btoa(String.fromCharCode(...randomBytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate magic link expiration time
 */
export function generateMagicLinkExpiry(expiryMinutes: number = 15): Date {
  return new Date(Date.now() + expiryMinutes * 60 * 1000);
}

/**
 * Validate continue path for magic links
 */
export function validateContinuePath(path: string): string {
  // Must be internal path starting with /
  if (!path || !path.startsWith('/')) {
    return '/onboarding';
  }
  
  // Prevent any scheme/host injection
  if (path.includes('://') || path.includes('//')) {
    return '/onboarding';
  }
  
  return path;
}
