import { describe, it, expect } from 'vitest';
import { hostnameAllowed, sanitizeMetadata } from '../src/lib/ingest-guards';

describe('Ingest Guards', () => {
  describe('hostnameAllowed', () => {
    it('should allow exact domain matches', () => {
      expect(hostnameAllowed('awardsradar.com', 'awardsradar.com')).toBe(true);
      expect(hostnameAllowed('example.com', 'example.com')).toBe(true);
    });

    it('should allow subdomain matches', () => {
      expect(hostnameAllowed('www.awardsradar.com', 'awardsradar.com')).toBe(true);
      expect(hostnameAllowed('blog.example.com', 'example.com')).toBe(true);
      expect(hostnameAllowed('api.sub.example.com', 'example.com')).toBe(true);
    });

    it('should reject mismatched domains', () => {
      expect(hostnameAllowed('malicious.com', 'awardsradar.com')).toBe(false);
      expect(hostnameAllowed('awardsradar.evil.com', 'awardsradar.com')).toBe(false);
    });

    it('should reject IP addresses', () => {
      expect(hostnameAllowed('192.168.1.1', 'awardsradar.com')).toBe(false);
      expect(hostnameAllowed('127.0.0.1', 'awardsradar.com')).toBe(false);
      expect(hostnameAllowed('::1', 'awardsradar.com')).toBe(false);
    });

    it('should reject localhost', () => {
      expect(hostnameAllowed('localhost', 'awardsradar.com')).toBe(false);
    });

    it('should handle empty or null values', () => {
      expect(hostnameAllowed('', 'awardsradar.com')).toBe(false);
      expect(hostnameAllowed('awardsradar.com', '')).toBe(false);
    });
  });

  describe('sanitizeMetadata', () => {
    it('should return empty object for null/undefined input', () => {
      expect(sanitizeMetadata(null)).toEqual({});
      expect(sanitizeMetadata(undefined)).toEqual({});
    });

    it('should drop specified keys', () => {
      const input = {
        title: 'Test Title',
        user_agent: 'Mozilla/5.0...',
        text: 'Some text content',
        css_classes: 'btn btn-primary',
        valid_key: 'valid value'
      };

      const result = sanitizeMetadata(input);
      expect(result.user_agent).toBeUndefined();
      expect(result.text).toBeUndefined();
      expect(result.css_classes).toBeUndefined();
      expect(result.title).toBe('Test Title');
      expect(result.valid_key).toBe('valid value');
    });

    it('should truncate long string values', () => {
      const longString = 'x'.repeat(300);
      const input = {
        title: longString,
        description: 'Short description'
      };

      const result = sanitizeMetadata(input);
      expect(result.title).toBe('x'.repeat(256));
      expect(result.description).toBe('Short description');
    });

    it('should preserve non-string values', () => {
      const input = {
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { key: 'value' },
        null_value: null
      };

      const result = sanitizeMetadata(input);
      expect(result.number).toBe(42);
      expect(result.boolean).toBe(true);
      expect(result.array).toEqual([1, 2, 3]);
      expect(result.object).toEqual({ key: 'value' });
      expect(result.null_value).toBeNull();
    });

        it('should handle oversized metadata by dropping priority fields', () => {
      // Create metadata that's just over 2KB after truncation
      const input = {
        title: 'x'.repeat(300), // Will be truncated to 256
        query: 'x'.repeat(300), // Will be truncated to 256
        fragment: 'x'.repeat(300), // Will be truncated to 256
        search: 'x'.repeat(300), // Will be truncated to 256
        hash: 'x'.repeat(300), // Will be truncated to 256
        field1: 'x'.repeat(300), // Will be truncated to 256
        field2: 'x'.repeat(300), // Will be truncated to 256
        field3: 'x'.repeat(300), // Will be truncated to 256
        field4: 'x'.repeat(300), // Will be truncated to 256
        field5: 'x'.repeat(300), // Will be truncated to 256
        important_field: 'This should remain'
      };

      const result = sanitizeMetadata(input);
      
      // Should drop low-priority fields to get under 2KB
      expect(result.title).toBeUndefined();
      expect(result.query).toBeUndefined();
      expect(result.fragment).toBeUndefined();
      expect(result.search).toBeUndefined();
      expect(result.hash).toBeUndefined();
      expect(result.important_field).toBe('This should remain');
    });

    it('should return null for metadata that cannot be reduced under 2KB', () => {
      // Create metadata that's way over 2KB even after truncation
      const input = {
        field1: 'x'.repeat(300), // Will be truncated to 256
        field2: 'x'.repeat(300), // Will be truncated to 256
        field3: 'x'.repeat(300), // Will be truncated to 256
        field4: 'x'.repeat(300), // Will be truncated to 256
        field5: 'x'.repeat(300), // Will be truncated to 256
        field6: 'x'.repeat(300), // Will be truncated to 256
        field7: 'x'.repeat(300), // Will be truncated to 256
        field8: 'x'.repeat(300), // Will be truncated to 256
        field9: 'x'.repeat(300), // Will be truncated to 256
        field10: 'x'.repeat(300) // Will be truncated to 256
      };

      const result = sanitizeMetadata(input);
      expect(result).toBeNull();
    });

    it('should handle edge case of exactly 2KB', () => {
      const input = {
        field: 'x'.repeat(2048 - 20) // Leave room for JSON structure
      };

      const result = sanitizeMetadata(input);
      expect(result).not.toBeNull();
      expect(JSON.stringify(result).length).toBeLessThanOrEqual(2048);
    });
  });
});
