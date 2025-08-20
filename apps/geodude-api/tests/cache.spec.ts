import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getOrSetJSON, getProjectVersion, bumpProjectVersion } from '../src/lib/cache';

// Mock KV namespace
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
};

// Mock metrics
const mockMetrics = vi.fn();

describe('Cache Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjectVersion', () => {
    it('should return 0 for new projects', async () => {
      mockKV.get.mockResolvedValue(null);
      const version = await getProjectVersion(mockKV as any, 'project_123');
      expect(version).toBe(0);
    });

    it('should return stored version for existing projects', async () => {
      mockKV.get.mockResolvedValue('1234567890');
      const version = await getProjectVersion(mockKV as any, 'project_123');
      expect(version).toBe(1234567890);
    });
  });

  describe('bumpProjectVersion', () => {
    it('should store current timestamp as version', async () => {
      const before = Date.now();
      const version = await bumpProjectVersion(mockKV as any, 'project_123');
      const after = Date.now();

      expect(version).toBeGreaterThanOrEqual(before);
      expect(version).toBeLessThanOrEqual(after);
      expect(mockKV.put).toHaveBeenCalledWith('v:project_123', expect.any(String));
    });
  });

  describe('getOrSetJSON', () => {
    it('should bypass cache when CACHE_OFF is set', async () => {
      const compute = vi.fn().mockResolvedValue({ data: 'test' });
      const result = await getOrSetJSON(
        mockKV as any,
        'test-key',
        30,
        compute,
        { CACHE_OFF: '1', metrics: mockMetrics }
      );

      expect(result).toEqual({ data: 'test' });
      expect(compute).toHaveBeenCalledTimes(1);
      expect(mockKV.get).not.toHaveBeenCalled();
      expect(mockKV.put).not.toHaveBeenCalled();
      expect(mockMetrics).toHaveBeenCalledWith('cache_bypass_5m');
    });

    it('should return cached value when available', async () => {
      const cachedData = JSON.stringify({ data: 'cached' });
      mockKV.get.mockResolvedValue(cachedData);

      const compute = vi.fn().mockResolvedValue({ data: 'new' });
      const result = await getOrSetJSON(
        mockKV as any,
        'test-key',
        30,
        compute,
        { metrics: mockMetrics }
      );

      expect(result).toEqual({ data: 'cached' });
      expect(compute).not.toHaveBeenCalled();
      expect(mockMetrics).toHaveBeenCalledWith('cache_hit_5m');
    });

    it('should compute and cache new value when not cached', async () => {
      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);

      const compute = vi.fn().mockResolvedValue({ data: 'new' });
      const result = await getOrSetJSON(
        mockKV as any,
        'test-key',
        30,
        compute,
        { metrics: mockMetrics, CACHE_PAYLOAD_LIMIT_BYTES: 50_000 }
      );

      expect(result).toEqual({ data: 'new' });
      expect(compute).toHaveBeenCalledTimes(1);
      expect(mockKV.put).toHaveBeenCalledWith('test-key', '{"data":"new"}', { expirationTtl: 30 });
      expect(mockMetrics).toHaveBeenCalledWith('cache_miss_5m');
    });

    it('should skip caching oversized payloads', async () => {
      mockKV.get.mockResolvedValue(null);

      // Create a large payload
      const largeData = { data: 'x'.repeat(100000) }; // > 50KB
      const compute = vi.fn().mockResolvedValue(largeData);

      const result = await getOrSetJSON(
        mockKV as any,
        'test-key',
        30,
        compute,
        { metrics: mockMetrics }
      );

      expect(result).toEqual(largeData);
      expect(compute).toHaveBeenCalledTimes(1);
      expect(mockKV.put).not.toHaveBeenCalled();
      expect(mockMetrics).toHaveBeenCalledWith('cache_skip_oversize_5m');
    });
  });
});
