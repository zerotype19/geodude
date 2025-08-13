// Slack alerts utility for SLO breaches and system issues
// Implements webhook posting with deduplication and cooldown

export interface AlertConfig {
  webhookUrl: string;
  environment: 'development' | 'production';
  cooldownSeconds: number;
}

export interface AlertCondition {
  dedupeKey: string;
  message: string;
  cooldownSeconds?: number;
}

export class SlackAlerts {
  private static instance: SlackAlerts;
  private lastAlertAt: Map<string, number> = new Map();
  private config: AlertConfig;

  private constructor(config: AlertConfig) {
    this.config = config;
  }

  static getInstance(config?: AlertConfig): SlackAlerts {
    if (!SlackAlerts.instance && config) {
      SlackAlerts.instance = new SlackAlerts(config);
    }
    return SlackAlerts.instance;
  }

  /**
   * Post a Slack alert with deduplication
   */
  async postAlert(condition: AlertCondition): Promise<boolean> {
    const { dedupeKey, message, cooldownSeconds = this.config.cooldownSeconds } = condition;
    const now = Date.now();
    const lastAlert = this.lastAlertAt.get(dedupeKey) || 0;
    const cooldownMs = cooldownSeconds * 1000;

    // Check if we're still in cooldown
    if (now - lastAlert < cooldownMs) {
      console.log(`Slack alert suppressed (cooldown): ${dedupeKey}`);
      return false;
    }

    try {
      // Post to Slack
      const success = await this.sendWebhook(message);
      
      if (success) {
        // Update last alert time
        this.lastAlertAt.set(dedupeKey, now);
        console.log(`Slack alert sent: ${dedupeKey}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Slack alert failed: ${dedupeKey}`, error);
      return false;
    }
  }

  /**
   * Send webhook to Slack
   */
  private async sendWebhook(message: string): Promise<boolean> {
    if (!this.config.webhookUrl) {
      console.log('Slack webhook URL not configured, skipping alert');
      return false;
    }

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: `[${this.config.environment.toUpperCase()}] ${message}`,
          username: 'Optiview Alerts',
          icon_emoji: ':warning:'
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Slack webhook request failed:', error);
      return false;
    }
  }

  /**
   * Check and alert on SLO breaches
   */
  async checkSLOBreaches(metrics: any): Promise<void> {
    const { total_5m, error_rate_5m, p95_ms_5m } = metrics;
    
    // Only alert if we have sufficient data
    if (total_5m < 500) {
      return;
    }

    // Check error rate threshold (>1%)
    if (error_rate_5m > 0.01) {
      await this.postAlert({
        dedupeKey: 'high_error_rate',
        message: `Ingestion error rate 5m = ${(error_rate_5m * 100).toFixed(2)}% (total: ${total_5m})`
      });
    }

    // Check latency threshold (p95 > 200ms)
    if (p95_ms_5m > 200) {
      await this.postAlert({
        dedupeKey: 'high_latency',
        message: `Ingestion p95 5m = ${p95_ms_5m}ms (total: ${total_5m})`
      });
    }
  }

  /**
   * Check and alert on cron failures
   */
  async checkCronFailure(lastCronTs: number | null): Promise<void> {
    if (!lastCronTs) {
      // No cron timestamp, alert immediately
      await this.postAlert({
        dedupeKey: 'cron_no_timestamp',
        message: 'Cron has never run (no timestamp found)'
      });
      return;
    }

    const now = Date.now();
    const timeSinceLastCron = now - lastCronTs;
    const cronStallThreshold = 90 * 60 * 1000; // 90 minutes

    if (timeSinceLastCron > cronStallThreshold) {
      const minutesStalled = Math.floor(timeSinceLastCron / (60 * 1000));
      await this.postAlert({
        dedupeKey: 'cron_stalled',
        message: `Cron has not run in ${minutesStalled}+ minutes`
      });
    }
  }

  /**
   * Get alert configuration from environment
   */
  static getConfig(env?: any): AlertConfig {
    // For Cloudflare Workers, env vars are passed via bindings
    // Default to development for safety
    const environment = 'development';
    const webhookUrl = ''; // Will be set via env binding
    const cooldownSeconds = 900; // 15 minutes default

    return {
      webhookUrl,
      environment,
      cooldownSeconds
    };
  }

  /**
   * Reset alert history (useful for testing)
   */
  reset(): void {
    this.lastAlertAt.clear();
  }

  /**
   * Get current alert status for debugging
   */
  getStatus(): { alertCount: number; lastAlerts: Array<{ key: string; timestamp: number }> } {
    const lastAlerts = Array.from(this.lastAlertAt.entries())
      .map(([key, timestamp]) => ({ key, timestamp }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    return {
      alertCount: this.lastAlertAt.size,
      lastAlerts
    };
  }
}
