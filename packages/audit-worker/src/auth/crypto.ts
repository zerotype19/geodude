/**
 * Crypto utilities for auth
 */

/**
 * Generate a secure random token
 */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a token using SHA-256
 */
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a cryptographically secure random ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Base64 URL-safe encoding
 */
export function encodeBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Create a magic link token (not hashed, for email link)
 */
export function createMagicToken(email: string): string {
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const id = generateId();
  return `${email}.${id}.${encodeBase64Url(nonce)}`;
}

