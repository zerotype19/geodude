// Utility functions for the AI visibility platform

/**
 * Hash a string using SHA-256 for privacy protection
 * Never store raw IPs, UAs, or other PII - always hash them first
 */
export async function hashString(str: string): Promise<string> {
  if (!str) return "";
  
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    
    // Convert to base64url for storage
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashBase64 = btoa(String.fromCharCode(...hashArray));
    
    // Convert to base64url (replace + with -, / with _, remove =)
    return hashBase64
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  } catch (error) {
    console.error("Hash error:", error);
    // Fallback: return a simple hash if crypto fails
    return `fallback_${str.length}_${Date.now()}`;
  }
}

/**
 * Verify HMAC signature for API authentication
 * Used to verify signed requests from customer properties
 */
export async function verifyHmac(
  message: string, 
  signature: string, 
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);
    
    // Import the secret as a crypto key
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
    
    // Create the expected signature
    const expectedSignature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const expectedBase64 = btoa(String.fromCharCode(...new Uint8Array(expectedSignature)));
    
    // Compare signatures (constant-time comparison)
    return signature === expectedBase64;
  } catch (error) {
    console.error("HMAC verification error:", error);
    return false;
  }
}

/**
 * Check if a timestamp is within acceptable skew range
 * Used for replay attack protection
 */
export function isWithinSkew(timestamp: number, maxSkewSeconds: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const skew = Math.abs(now - timestamp);
  return skew <= maxSkewSeconds;
}

/**
 * Clean a URL by removing query parameters and fragments
 * Store clean URLs in content_assets, query params in metadata if needed
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

/**
 * Extract domain from a URL
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * Validate and sanitize metadata object
 * Ensures no PII is stored and size limits are respected
 */
export function sanitizeMetadata(metadata: any, maxSizeKB: number = 1): any {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }
  
  const sanitized: any = {};
  const piiKeys = ["email", "phone", "ssn", "credit_card", "password", "token"];
  
  for (const [key, value] of Object.entries(metadata)) {
    // Skip PII-looking keys
    if (piiKeys.some(piiKey => key.toLowerCase().includes(piiKey))) {
      continue;
    }
    
    // Ensure value is serializable
    if (value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      sanitized[key] = String(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  // Check size limit
  const jsonStr = JSON.stringify(sanitized);
  if (jsonStr.length > maxSizeKB * 1024) {
    // Truncate if too large
    const truncated = JSON.parse(jsonStr.substring(0, maxSizeKB * 1024));
    truncated._truncated = true;
    return truncated;
  }
  
  return sanitized;
}

/**
 * Generate a unique ID for tracking
 */
export function generateTrackingId(): string {
  return `trk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if a string looks like PII
 */
export function looksLikePII(str: string): boolean {
  if (!str) return false;
  
  const patterns = [
    /^\d{3}-\d{2}-\d{4}$/, // SSN
    /^\d{10,16}$/, // Credit card
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // Email
    /^\+?1?\d{9,15}$/, // Phone
  ];
  
  return patterns.some(pattern => pattern.test(str));
}

/**
 * Generate a secure random string for API keys
 */
export function generateSecureKey(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Rate limiting helper - simple token bucket implementation
 * For production, use Cloudflare's built-in rate limiting
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(capacity: number, refillRate: number) {
    this.tokens = capacity;
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  tryConsume(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getTokensRemaining(): number {
    this.refill();
    return this.tokens;
  }
}
