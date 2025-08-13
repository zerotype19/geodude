import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SlackAlerts } from '../src/alerts';

// Mock fetch globally
global.fetch = vi.fn();

describe('SlackAlerts', () => {
  let alerts: SlackAlerts;
  const mockConfig = {
    webhookUrl: 'https://hooks.slack.com/test',
    environment: 'development' as const,
    cooldownSeconds: 900
  };

  beforeEach(() => {
    // Reset the singleton instance for each test
    (SlackAlerts as any).instance = undefined;
    alerts = SlackAlerts.getInstance(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = SlackAlerts.getInstance(mockConfig);
      const instance2 = SlackAlerts.getInstance(mockConfig);
      expect(instance1).toBe(instance2);
    });
  });

  describe('postAlert', () => {
    it('should post alert successfully', async () => {
      const mockResponse = { ok: true };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await alerts.postAlert({
        dedupeKey: 'test_alert',
        message: 'Test message'
      });

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        mockConfig.webhookUrl,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: '[DEVELOPMENT] Test message',
            username: 'Optiview Alerts',
            icon_emoji: ':warning:'
          })
        })
      );
    });

    it('should respect cooldown period', async () => {
      const mockResponse = { ok: true };
      (fetch as any).mockResolvedValue(mockResponse);

      // First alert should succeed
      const result1 = await alerts.postAlert({
        dedupeKey: 'cooldown_test',
        message: 'First alert'
      });
      expect(result1).toBe(true);

      // Second alert within cooldown should be suppressed
      const result2 = await alerts.postAlert({
        dedupeKey: 'cooldown_test',
        message: 'Second alert'
      });
      expect(result2).toBe(false);

      // Should not have made a second fetch call
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should allow custom cooldown override', async () => {
      const mockResponse = { ok: true };
      (fetch as any).mockResolvedValue(mockResponse);

      // First alert
      await alerts.postAlert({
        dedupeKey: 'custom_cooldown',
        message: 'First alert',
        cooldownSeconds: 1 // 1 second cooldown
      });

      // Wait for cooldown to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second alert should succeed after custom cooldown
      const result2 = await alerts.postAlert({
        dedupeKey: 'custom_cooldown',
        message: 'Second alert',
        cooldownSeconds: 1
      });
      expect(result2).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle fetch errors gracefully', async () => {
      (fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await alerts.postAlert({
        dedupeKey: 'error_test',
        message: 'Test message'
      });

      expect(result).toBe(false);
    });

    it('should handle non-ok responses', async () => {
      const mockResponse = { ok: false, status: 400 };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await alerts.postAlert({
        dedupeKey: 'bad_response',
        message: 'Test message'
      });

      expect(result).toBe(false);
    });

    it('should skip alert when webhook URL is empty', async () => {
      // Reset the singleton to test with empty webhook
      (SlackAlerts as any).instance = undefined;
      const alertsNoWebhook = SlackAlerts.getInstance({
        ...mockConfig,
        webhookUrl: ''
      });

      const result = await alertsNoWebhook.postAlert({
        dedupeKey: 'no_webhook',
        message: 'Test message'
      });

      expect(result).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('checkSLOBreaches', () => {
    it('should alert on high error rate', async () => {
      const mockResponse = { ok: true };
      (fetch as any).mockResolvedValue(mockResponse);

      await alerts.checkSLOBreaches({
        total_5m: 1000,
        error_rate_5m: 0.02, // 2% error rate
        p95_ms_5m: 150
      });

      expect(fetch).toHaveBeenCalledWith(
        mockConfig.webhookUrl,
        expect.objectContaining({
          body: expect.stringContaining('Ingestion error rate 5m = 2.00%')
        })
      );
    });

    it('should alert on high latency', async () => {
      const mockResponse = { ok: true };
      (fetch as any).mockResolvedValue(mockResponse);

      await alerts.checkSLOBreaches({
        total_5m: 1000,
        error_rate_5m: 0.005, // 0.5% error rate
        p95_ms_5m: 250 // 250ms p95
      });

      expect(fetch).toHaveBeenCalledWith(
        mockConfig.webhookUrl,
        expect.objectContaining({
          body: expect.stringContaining('Ingestion p95 5m = 250ms')
        })
      );
    });

    it('should not alert when insufficient data', async () => {
      await alerts.checkSLOBreaches({
        total_5m: 100, // Less than 500
        error_rate_5m: 0.05, // 5% error rate
        p95_ms_5m: 300 // 300ms p95
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should not alert when thresholds not exceeded', async () => {
      await alerts.checkSLOBreaches({
        total_5m: 1000,
        error_rate_5m: 0.005, // 0.5% error rate (below 1%)
        p95_ms_5m: 150 // 150ms p95 (below 200ms)
      });

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('checkCronFailure', () => {
    it('should alert when no cron timestamp exists', async () => {
      const mockResponse = { ok: true };
      (fetch as any).mockResolvedValue(mockResponse);

      await alerts.checkCronFailure(null);

      expect(fetch).toHaveBeenCalledWith(
        mockConfig.webhookUrl,
        expect.objectContaining({
          body: expect.stringContaining('Cron has never run')
        })
      );
    });

    it('should alert when cron is stalled', async () => {
      const mockResponse = { ok: true };
      (fetch as any).mockResolvedValue(mockResponse);

      const stalledTimestamp = Date.now() - (95 * 60 * 1000); // 95 minutes ago
      await alerts.checkCronFailure(stalledTimestamp);

      expect(fetch).toHaveBeenCalledWith(
        mockConfig.webhookUrl,
        expect.objectContaining({
          body: expect.stringContaining('Cron has not run in 95+ minutes')
        })
      );
    });

    it('should not alert when cron is recent', async () => {
      const recentTimestamp = Date.now() - (30 * 60 * 1000); // 30 minutes ago
      await alerts.checkCronFailure(recentTimestamp);

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('deduplication', () => {
    it('should deduplicate alerts with same key', async () => {
      const mockResponse = { ok: true };
      (fetch as any).mockResolvedValue(mockResponse);

      // First alert
      await alerts.postAlert({
        dedupeKey: 'duplicate_test',
        message: 'First message'
      });

      // Second alert with same key
      await alerts.postAlert({
        dedupeKey: 'duplicate_test',
        message: 'Second message'
      });

      // Should only have made one fetch call
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should allow different dedupe keys', async () => {
      const mockResponse = { ok: true };
      (fetch as any).mockResolvedValue(mockResponse);

      await alerts.postAlert({
        dedupeKey: 'key1',
        message: 'Message 1'
      });

      await alerts.postAlert({
        dedupeKey: 'key2',
        message: 'Message 2'
      });

      // Should have made two fetch calls
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStatus', () => {
    it('should return alert status', async () => {
      const mockResponse = { ok: true };
      (fetch as any).mockResolvedValue(mockResponse);

      await alerts.postAlert({
        dedupeKey: 'status_test',
        message: 'Test message'
      });

      const status = alerts.getStatus();
      expect(status.alertCount).toBe(1);
      expect(status.lastAlerts).toHaveLength(1);
      expect(status.lastAlerts[0].key).toBe('status_test');
    });
  });

  describe('reset', () => {
    it('should clear alert history', async () => {
      const mockResponse = { ok: true };
      (fetch as any).mockResolvedValue(mockResponse);

      await alerts.postAlert({
        dedupeKey: 'reset_test',
        message: 'Test message'
      });

      expect(alerts.getStatus().alertCount).toBe(1);

      alerts.reset();
      expect(alerts.getStatus().alertCount).toBe(0);
    });
  });
});
