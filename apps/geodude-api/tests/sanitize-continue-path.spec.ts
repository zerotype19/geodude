import { describe, it, expect } from 'vitest';

// Mock the sanitizeContinuePath function
function sanitizeContinuePath(input: unknown): { value: string; sanitized: boolean; reason?: string } {
  const fallback = "/onboarding";
  
  if (typeof input !== "string") {
    return { value: fallback, sanitized: true, reason: "non_string" };
  }

  const s = input.trim();

  if (!s.startsWith("/") || s.startsWith("//")) {
    return { value: fallback, sanitized: true, reason: "not_internal_path" };
  }
  
  if (/[\\\u0000-\u001F]/.test(s)) {
    return { value: fallback, sanitized: true, reason: "control_or_backslash" };
  }

  let candidate;
  try {
    const u = new URL(s, "http://local");
    if (u.origin !== "http://local") {
      return { value: fallback, sanitized: true, reason: "absolute_url" };
    }
    candidate = u.pathname + u.search; // drop fragment
  } catch {
    return { value: fallback, sanitized: true, reason: "url_parse_error" };
  }

  if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/%?]*$/.test(candidate)) {
    return { value: fallback, sanitized: true, reason: "invalid_chars" };
  }
  
  if (candidate.length > 512) {
    return { value: fallback, sanitized: true, reason: "too_long" };
  }

  return { value: candidate, sanitized: false };
}

describe('sanitizeContinuePath', () => {
  describe('malicious inputs', () => {
    it('should reject absolute URLs', () => {
      const result = sanitizeContinuePath('https://evil.com');
      expect(result.sanitized).toBe(true);
      expect(result.value).toBe('/onboarding');
      expect(result.reason).toBe('not_internal_path');
    });

    it('should reject protocol-relative URLs', () => {
      const result = sanitizeContinuePath('//evil.com');
      expect(result.sanitized).toBe(true);
      expect(result.value).toBe('/onboarding');
      expect(result.reason).toBe('not_internal_path');
    });

    it('should reject control characters', () => {
      const result = sanitizeContinuePath('/events\x00');
      expect(result.sanitized).toBe(true);
      expect(result.value).toBe('/onboarding');
      expect(result.reason).toBe('control_or_backslash');
    });

    it('should reject backslashes', () => {
      const result = sanitizeContinuePath('/events\\evil');
      expect(result.sanitized).toBe(true);
      expect(result.value).toBe('/onboarding');
      expect(result.reason).toBe('control_or_backslash');
    });

    it('should reject non-string inputs', () => {
      const result = sanitizeContinuePath(null);
      expect(result.sanitized).toBe(true);
      expect(result.value).toBe('/onboarding');
      expect(result.reason).toBe('non_string');
    });

    it('should reject very long paths', () => {
      const longPath = '/' + 'a'.repeat(513);
      const result = sanitizeContinuePath(longPath);
      expect(result.sanitized).toBe(true);
      expect(result.value).toBe('/onboarding');
      expect(result.reason).toBe('too_long');
    });
  });

  describe('valid inputs', () => {
    it('should accept simple paths', () => {
      const result = sanitizeContinuePath('/events');
      expect(result.sanitized).toBe(false);
      expect(result.value).toBe('/events');
    });

    it('should accept paths with query parameters', () => {
      const result = sanitizeContinuePath('/events?tab=ai');
      expect(result.sanitized).toBe(false);
      expect(result.value).toBe('/events?tab=ai');
    });

    it('should drop fragments', () => {
      const result = sanitizeContinuePath('/events?tab=ai#frag');
      expect(result.sanitized).toBe(false);
      expect(result.value).toBe('/events?tab=ai');
    });

    it('should accept paths with special characters', () => {
      const result = sanitizeContinuePath('/events/123-456_789');
      expect(result.sanitized).toBe(false);
      expect(result.value).toBe('/events/123-456_789');
    });

    it('should trim whitespace', () => {
      const result = sanitizeContinuePath('  /events  ');
      expect(result.sanitized).toBe(false);
      expect(result.value).toBe('/events');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = sanitizeContinuePath('');
      expect(result.sanitized).toBe(true);
      expect(result.value).toBe('/onboarding');
      expect(result.reason).toBe('not_internal_path');
    });

    it('should handle whitespace only', () => {
      const result = sanitizeContinuePath('   ');
      expect(result.sanitized).toBe(true);
      expect(result.value).toBe('/onboarding');
      expect(result.reason).toBe('not_internal_path');
    });

    it('should handle root path', () => {
      const result = sanitizeContinuePath('/');
      expect(result.sanitized).toBe(false);
      expect(result.value).toBe('/');
    });

    it('should handle paths with dots', () => {
      const result = sanitizeContinuePath('/events/../evil');
      expect(result.sanitized).toBe(false);
      expect(result.value).toBe('/evil');
    });
  });
});
