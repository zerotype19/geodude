/**
 * Metadata Sanitizer
 * Caps metadata keys/values and detects/drops PII
 */

export interface SanitizedMetadata {
  metadata: Record<string, any>;
  droppedKeys: string[];
  droppedValues: string[];
}

// PII key patterns (case-insensitive)
const PII_KEY_PATTERNS = [
  /(^|_)(email|phone|tel|ssn|address|password|passwd|pwd)(_|$)/i,
  /(^|_)(first|last|given|family|middle|maiden)_?name/i,
  /(^|_)(cc|credit|card|expiry|cvv|cvc)(_|$)/i,
  /(^|_)(dob|birth|age|gender|sex)(_|$)/i,
  /(^|_)(ip|mac|device|fingerprint)(_|$)/i,
  /(^|_)(session|token|jwt|auth)(_|$)/i
];

// PII value patterns
const PII_VALUE_PATTERNS = [
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // email
  /^(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}$/, // phone
  /^\d{3}-\d{2}-\d{4}$/, // SSN
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/ // email (alternative)
];

export function sanitizeMetadata(
  metadata: Record<string, any>,
  maxKeys: number = 20,
  maxValueLength: number = 200
): SanitizedMetadata {
  const sanitized: Record<string, any> = {};
  const droppedKeys: string[] = [];
  const droppedValues: string[] = [];

  // Convert to array of entries and sort by key length (shorter keys first)
  const entries = Object.entries(metadata)
    .sort(([a], [b]) => a.length - b.length);

  let keyCount = 0;

  for (const [key, value] of entries) {
    // Check if we've reached the key limit
    if (keyCount >= maxKeys) {
      droppedKeys.push(key);
      continue;
    }

    // Check for PII keys
    const isPIIKey = PII_KEY_PATTERNS.some(pattern => pattern.test(key));
    if (isPIIKey) {
      droppedKeys.push(key);
      continue;
    }

    // Check for PII values
    const stringValue = String(value);
    const isPIIValue = PII_VALUE_PATTERNS.some(pattern => pattern.test(stringValue));
    if (isPIIValue) {
      droppedKeys.push(key);
      continue;
    }

    // Check value length
    if (stringValue.length > maxValueLength) {
      droppedValues.push(key);
      continue;
    }

    // Key is safe, add it
    sanitized[key] = value;
    keyCount++;
  }

  return {
    metadata: sanitized,
    droppedKeys,
    droppedValues
  };
}

/**
 * Check if a specific key is likely PII
 */
export function isPIIKey(key: string): boolean {
  return PII_KEY_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Check if a specific value is likely PII
 */
export function isPIIValue(value: any): boolean {
  const stringValue = String(value);
  return PII_VALUE_PATTERNS.some(pattern => pattern.test(stringValue));
}

/**
 * Get metadata statistics
 */
export function getMetadataStats(metadata: Record<string, any>): {
  totalKeys: number;
  totalValueLength: number;
  averageValueLength: number;
  piiKeyCount: number;
  piiValueCount: number;
} {
  const keys = Object.keys(metadata);
  const values = Object.values(metadata);
  
  const totalKeys = keys.length;
  const totalValueLength = values.reduce((sum, val) => sum + String(val).length, 0);
  const averageValueLength = totalKeys > 0 ? totalValueLength / totalKeys : 0;
  
  const piiKeyCount = keys.filter(isPIIKey).length;
  const piiValueCount = values.filter(isPIIValue).length;

  return {
    totalKeys,
    totalValueLength,
    averageValueLength,
    piiKeyCount,
    piiValueCount
  };
}
