import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsManager, ErrorCode } from '../src/metrics';

describe('MetricsManager', () => {
  let metrics: MetricsManager;

  beforeEach(() => {
    // Reset the singleton instance for each test
    (MetricsManager as any).instance = undefined;
    metrics = MetricsManager.getInstance();
  });

  describe('initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = MetricsManager.getInstance();
      const instance2 = MetricsManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with 5 buckets', () => {
      expect(metrics.getBucketCount()).toBe(5);
    });
  });

  describe('record', () => {
    it('should record successful request', () => {
      metrics.record({
        keyId: 'test_key',
        projectId: 123,
        latencyMs: 50,
        ok: true
      });

      const snapshot = metrics.snapshot5m();
      expect(snapshot.total).toBe(1);
      expect(snapshot.errorRate).toBe(0);
      expect(snapshot.p50).toBe(50);
      expect(snapshot.p95).toBe(50);
    });

    it('should record failed request with error code', () => {
      metrics.record({
        keyId: 'test_key',
        projectId: 123,
        latencyMs: 100,
        ok: false,
        error: ErrorCode.HMAC_FAILED
      });

      const snapshot = metrics.snapshot5m();
      expect(snapshot.total).toBe(1);
      expect(snapshot.errorRate).toBe(1);
      expect(snapshot.byError[ErrorCode.HMAC_FAILED]).toBe(1);
      expect(snapshot.topErrorKeys).toHaveLength(1);
      expect(snapshot.topErrorKeys[0]).toEqual({
        key_id: 'test_key',
        count: 1
      });
    });

    it('should track errors by project', () => {
      metrics.record({
        keyId: 'key1',
        projectId: 123,
        ok: false,
        error: ErrorCode.RATE_LIMITED
      });

      metrics.record({
        keyId: 'key2',
        projectId: 123,
        ok: false,
        error: ErrorCode.SCHEMA_INVALID
      });

      const snapshot = metrics.snapshot5m();
      expect(snapshot.topErrorProjects).toHaveLength(1);
      expect(snapshot.topErrorProjects[0]).toEqual({
        project_id: 123,
        count: 2
      });
    });
  });

  describe('latency sampling', () => {
    it('should sample latencies within bucket limit', () => {
      // Add 1000 latency samples (more than the 500 limit)
      for (let i = 0; i < 1000; i++) {
        metrics.record({
          keyId: `key_${i}`,
          ok: true,
          latencyMs: i
        });
      }

      const snapshot = metrics.snapshot5m();
      expect(snapshot.total).toBe(1000);
      // Should have sampled latencies (not necessarily exactly 500 due to reservoir sampling)
      expect(snapshot.p50).toBeGreaterThan(0);
      expect(snapshot.p95).toBeGreaterThan(0);
    });

    it('should calculate percentiles correctly', () => {
      // Add specific latencies for predictable percentiles
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      latencies.forEach(latency => {
        metrics.record({
          keyId: `key_${latency}`,
          ok: true,
          latencyMs: latency
        });
      });

      const snapshot = metrics.snapshot5m();
      expect(snapshot.p50).toBe(50); // Median of 10,20,30,40,50,60,70,80,90,100
      expect(snapshot.p95).toBe(100); // 95th percentile of 10 values (index 9 = 100)
    });
  });

  describe('bucket rotation', () => {
        it('should maintain correct bucket count', () => {
      // Test that we always have exactly 5 buckets
      expect(metrics.getBucketCount()).toBe(5);
      
      // Add some data
      metrics.record({ keyId: 'key1', ok: true });
      metrics.record({ keyId: 'key2', ok: true });
      
      // Should still have 5 buckets
      expect(metrics.getBucketCount()).toBe(5);
      
      // Snapshot should work
      const snapshot = metrics.snapshot5m();
      expect(snapshot.total).toBe(2);
    });
  });

  describe('error tracking', () => {
    it('should track all error types', () => {
      const errorTypes = Object.values(ErrorCode);

      errorTypes.forEach((errorCode, index) => {
        metrics.record({
          keyId: `key_${index}`,
          ok: false,
          error: errorCode
        });
      });

      const snapshot = metrics.snapshot5m();
      expect(snapshot.total).toBe(errorTypes.length);
      expect(snapshot.errorRate).toBe(1);

      errorTypes.forEach(errorCode => {
        expect(snapshot.byError[errorCode]).toBe(1);
      });
    });

    it('should track top error keys', () => {
      // Add multiple errors for same key
      for (let i = 0; i < 5; i++) {
        metrics.record({
          keyId: 'problematic_key',
          ok: false,
          error: ErrorCode.HMAC_FAILED
        });
      }

      // Add single error for another key
      metrics.record({
        keyId: 'other_key',
        ok: false,
        error: ErrorCode.SCHEMA_INVALID
      });

      const snapshot = metrics.snapshot5m();
      expect(snapshot.topErrorKeys).toHaveLength(2);
      expect(snapshot.topErrorKeys[0]).toEqual({
        key_id: 'problematic_key',
        count: 5
      });
      expect(snapshot.topErrorKeys[1]).toEqual({
        key_id: 'other_key',
        count: 1
      });
    });
  });

  describe('memory management', () => {
    it('should maintain constant memory usage', () => {
      const initialBuckets = metrics.getBucketCount();

      // Add many requests
      for (let i = 0; i < 10000; i++) {
        metrics.record({
          keyId: `key_${i}`,
          ok: true,
          latencyMs: Math.random() * 1000
        });
      }

      // Should still have same number of buckets
      expect(metrics.getBucketCount()).toBe(initialBuckets);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      metrics.record({ keyId: 'test', ok: true });
      expect(metrics.snapshot5m().total).toBe(1);

      metrics.reset();
      expect(metrics.snapshot5m().total).toBe(0);
      expect(metrics.getBucketCount()).toBe(5);
    });
  });
});
