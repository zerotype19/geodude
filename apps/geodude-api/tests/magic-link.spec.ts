import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateMagicLinkToken, generateMagicLinkExpiry, validateContinuePath } from '../src/auth';

describe('Magic Link Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateMagicLinkToken', () => {
    it('should generate a 24-byte base64url token', () => {
      const token = generateMagicLinkToken();
      
      // Should be base64url encoded (no padding, no + or /)
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      
      // Decode and check length (24 bytes = 32 base64 chars, but base64url removes padding)
      const decoded = Buffer.from(token, 'base64');
      expect(decoded.length).toBe(24);
    });

    it('should generate unique tokens', () => {
      const token1 = generateMagicLinkToken();
      const token2 = generateMagicLinkToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateMagicLinkExpiry', () => {
    it('should generate expiry 15 minutes from now by default', () => {
      const now = new Date();
      const expiry = generateMagicLinkExpiry();
      
      const diffMs = expiry.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);
      
      expect(diffMinutes).toBeCloseTo(15, 0);
    });

    it('should generate expiry with custom minutes', () => {
      const now = new Date();
      const expiry = generateMagicLinkExpiry(30);
      
      const diffMs = expiry.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);
      
      expect(diffMinutes).toBeCloseTo(30, 0);
    });
  });

  describe('validateContinuePath', () => {
    it('should allow valid internal paths', () => {
      expect(validateContinuePath('/dashboard')).toBe('/dashboard');
      expect(validateContinuePath('/settings/profile')).toBe('/settings/profile');
      expect(validateContinuePath('/')).toBe('/');
    });

    it('should fallback to /onboarding for invalid paths', () => {
      expect(validateContinuePath('')).toBe('/onboarding');
      expect(validateContinuePath('dashboard')).toBe('/onboarding');
      expect(validateContinuePath('https://example.com')).toBe('/onboarding');
      expect(validateContinuePath('//example.com')).toBe('/onboarding');
    });

    it('should prevent scheme injection', () => {
      expect(validateContinuePath('javascript:alert(1)')).toBe('/onboarding');
      expect(validateContinuePath('data:text/html,<script>alert(1)</script>')).toBe('/onboarding');
    });
  });
});
