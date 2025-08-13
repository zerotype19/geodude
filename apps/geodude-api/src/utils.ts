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
