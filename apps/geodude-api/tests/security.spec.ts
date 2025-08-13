import { describe, it, expect } from 'vitest';
import { sanitizeMetadata, isPIIKey, isPIIValue } from '../src/metadata-sanitizer';

describe('Metadata Sanitizer', () => {
    describe('PII Key Detection', () => {
        it('should detect email keys', () => {
            expect(isPIIKey('email')).toBe(true);
            expect(isPIIKey('user_email')).toBe(true);
            expect(isPIIKey('EMAIL')).toBe(true);
            expect(isPIIKey('safe_key')).toBe(false);
        });

        it('should detect phone keys', () => {
            expect(isPIIKey('phone')).toBe(true);
            expect(isPIIKey('phone_number')).toBe(true);
            expect(isPIIKey('tel')).toBe(true);
            expect(isPIIKey('safe_key')).toBe(false);
        });

        it('should detect password keys', () => {
            expect(isPIIKey('password')).toBe(true);
            expect(isPIIKey('user_password')).toBe(true);
            expect(isPIIKey('pwd')).toBe(true);
            expect(isPIIKey('safe_key')).toBe(false);
        });
    });

    describe('PII Value Detection', () => {
        it('should detect email values', () => {
            expect(isPIIValue('user@example.com')).toBe(true);
            expect(isPIIValue('test.email+tag@domain.co.uk')).toBe(true);
            expect(isPIIValue('safe_value')).toBe(false);
        });

        it('should detect phone values', () => {
            expect(isPIIValue('+1-555-123-4567')).toBe(true);
            expect(isPIIValue('(555) 123-4567')).toBe(true);
            expect(isPIIValue('555-123-4567')).toBe(true);
            expect(isPIIValue('safe_value')).toBe(false);
        });

        it('should detect SSN values', () => {
            expect(isPIIValue('123-45-6789')).toBe(true);
            expect(isPIIValue('safe_value')).toBe(false);
        });
    });

    describe('Metadata Sanitization', () => {
        it('should cap metadata keys', () => {
            const metadata: Record<string, any> = {};
            for (let i = 0; i < 25; i++) {
                metadata[`key_${i}`] = `value_${i}`;
            }

            const result = sanitizeMetadata(metadata, 20, 200);
            expect(Object.keys(result.metadata)).toHaveLength(20);
            expect(result.droppedKeys).toHaveLength(5);
        });

        it('should cap metadata values', () => {
            const metadata = {
                short: 'short value',
                long: 'a'.repeat(250)
            };

            const result = sanitizeMetadata(metadata, 20, 200);
            expect(result.metadata.short).toBe('short value');
            expect(result.metadata.long).toBeUndefined();
            expect(result.droppedValues).toContain('long');
        });

        it('should drop PII keys', () => {
            const metadata = {
                safe_key: 'safe_value',
                email: 'user@example.com',
                phone: '555-123-4567'
            };

            const result = sanitizeMetadata(metadata);
            expect(result.metadata.safe_key).toBe('safe_value');
            expect(result.metadata.email).toBeUndefined();
            expect(result.metadata.phone).toBeUndefined();
            expect(result.droppedKeys).toContain('email');
            expect(result.droppedKeys).toContain('phone');
        });

        it('should drop PII values', () => {
            const metadata = {
                safe_key: 'safe_value',
                user_info: 'user@example.com',
                contact: '555-123-4567'
            };

            const result = sanitizeMetadata(metadata);
            expect(result.metadata.safe_key).toBe('safe_value');
            expect(result.metadata.user_info).toBeUndefined();
            expect(result.metadata.contact).toBeUndefined();
            expect(result.droppedKeys).toContain('user_info');
            expect(result.droppedKeys).toContain('contact');
        });

        it('should prioritize shorter keys when capping', () => {
            const metadata = {
                very_long_key_name_that_should_be_dropped: 'value1',
                short: 'value2',
                medium_length_key: 'value3'
            };

            const result = sanitizeMetadata(metadata, 2, 200);
            expect(Object.keys(result.metadata)).toHaveLength(2);
            expect(result.metadata.short).toBe('value2');
            expect(result.metadata.medium_length_key).toBe('value3');
            expect(result.droppedKeys).toContain('very_long_key_name_that_should_be_dropped');
        });
    });
});
