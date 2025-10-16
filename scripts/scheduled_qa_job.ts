#!/usr/bin/env tsx

/**
 * Scheduled QA Job for v2.1 Monitoring
 * 
 * Runs daily to monitor v2.1 adoption and performance
 * Can be integrated with cron, GitHub Actions, or other schedulers
 * 
 * Usage: tsx scripts/scheduled_qa_job.ts [--slack-webhook=URL] [--email=address]
 */

const API_BASE = 'https://geodude-api.kevin-mcgovern.workers.dev';

interface QAMetrics {
  timestamp: string;
  v21_audits_24h: number;
  v21_audits_7d: number;
  avg_v21_overall: number;
  avg_v21_visibility: number;
  audits_with_visibility: number;
  error_rate: number;
  system_health: 'healthy' | 'warning' | 'critical';
  alerts: string[];
}

async function fetchSystemMetrics(): Promise<QAMetrics> {
  const alerts: string[] = [];
  
  try {
    // Get system status
    const statusResponse = await fetch(`${API_BASE}/status`);
    if (!statusResponse.ok) {
      alerts.push(`Status endpoint failed: ${statusResponse.status}`);
      throw new Error(`Status endpoint failed: ${statusResponse.status}`);
    }
    
    const status = await statusResponse.json();
    const v21Metrics = status.v21_scoring || {};
    
    // Get detailed v2.1 metrics (this would be a custom endpoint in production)
    const metricsResponse = await fetch(`${API_BASE}/v1/metrics/v21`);
    let detailedMetrics = null;
    
    if (metricsResponse.ok) {
      detailedMetrics = await metricsResponse.json();
    } else {
      // Fallback to basic metrics
      detailedMetrics = {
        avg_overall: 0,
        avg_visibility: 0,
        audits_with_visibility: 0,
        error_rate: 0
      };
    }
    
    // Determine system health
    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (v21Metrics.audits_24h === 0) {
      alerts.push('No v2.1 audits in last 24h');
      systemHealth = 'warning';
    }
    
    if (detailedMetrics.error_rate > 10) {
      alerts.push(`High error rate: ${detailedMetrics.error_rate}%`);
      systemHealth = 'critical';
    }
    
    if (detailedMetrics.avg_overall < 30) {
      alerts.push(`Low average score: ${detailedMetrics.avg_overall}%`);
      systemHealth = 'warning';
    }
    
    return {
      timestamp: new Date().toISOString(),
      v21_audits_24h: v21Metrics.audits_24h || 0,
      v21_audits_7d: v21Metrics.audits_7d || 0,
      avg_v21_overall: detailedMetrics.avg_overall || 0,
      avg_v21_visibility: detailedMetrics.avg_visibility || 0,
      audits_with_visibility: detailedMetrics.audits_with_visibility || 0,
      error_rate: detailedMetrics.error_rate || 0,
      system_health: systemHealth,
      alerts: alerts
    };
    
  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      v21_audits_24h: 0,
      v21_audits_7d: 0,
      avg_v21_overall: 0,
      avg_v21_visibility: 0,
      audits_with_visibility: 0,
      error_rate: 100,
      system_health: 'critical',
      alerts: [`System error: ${error}`]
    };
  }
}

async function sendSlackNotification(metrics: QAMetrics, webhookUrl: string) {
  const color = metrics.system_health === 'healthy' ? 'good' : 
                metrics.system_health === 'warning' ? 'warning' : 'danger';
  
  const emoji = metrics.system_health === 'healthy' ? '✅' : 
                metrics.system_health === 'warning' ? '⚠️' : '🚨';
  
  const payload = {
    text: `${emoji} Optiview v2.1 Daily QA Report`,
    attachments: [
      {
        color: color,
        fields: [
          {
            title: 'v2.1 Audits (24h)',
            value: metrics.v21_audits_24h.toString(),
            short: true
          },
          {
            title: 'v2.1 Audits (7d)',
            value: metrics.v21_audits_7d.toString(),
            short: true
          },
          {
            title: 'Average Overall Score',
            value: `${metrics.avg_v21_overall.toFixed(1)}%`,
            short: true
          },
          {
            title: 'Average Visibility Score',
            value: `${metrics.avg_v21_visibility.toFixed(1)}%`,
            short: true
          },
          {
            title: 'Audits with Visibility Data',
            value: metrics.audits_with_visibility.toString(),
            short: true
          },
          {
            title: 'Error Rate',
            value: `${metrics.error_rate.toFixed(1)}%`,
            short: true
          }
        ],
        footer: 'Optiview v2.1 QA Monitor',
        ts: Math.floor(Date.now() / 1000)
      }
    ]
  };
  
  if (metrics.alerts.length > 0) {
    payload.attachments.push({
      color: 'danger',
      title: 'Alerts',
      text: metrics.alerts.join('\n'),
      footer: 'Action Required'
    });
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log('✅ Slack notification sent');
    } else {
      console.error('❌ Slack notification failed:', response.status);
    }
  } catch (error) {
    console.error('❌ Slack notification error:', error);
  }
}

async function sendEmailNotification(metrics: QAMetrics, email: string) {
  const subject = `Optiview v2.1 QA Report - ${metrics.system_health.toUpperCase()}`;
  
  const body = `
Optiview v2.1 Daily QA Report
=============================

Timestamp: ${metrics.timestamp}
System Health: ${metrics.system_health.toUpperCase()}

Metrics:
- v2.1 Audits (24h): ${metrics.v21_audits_24h}
- v2.1 Audits (7d): ${metrics.v21_audits_7d}
- Average Overall Score: ${metrics.avg_v21_overall.toFixed(1)}%
- Average Visibility Score: ${metrics.avg_v21_visibility.toFixed(1)}%
- Audits with Visibility Data: ${metrics.audits_with_visibility}
- Error Rate: ${metrics.error_rate.toFixed(1)}%

${metrics.alerts.length > 0 ? `
Alerts:
${metrics.alerts.map(alert => `- ${alert}`).join('\n')}
` : ''}

Dashboard: https://geodude-api.kevin-mcgovern.workers.dev/status
  `;
  
  // In production, you'd use a proper email service like SendGrid, SES, etc.
  console.log('📧 Email notification (mock):');
  console.log(`To: ${email}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}`);
}

function logMetrics(metrics: QAMetrics) {
  console.log('📊 v2.1 QA Metrics');
  console.log('==================');
  console.log(`Timestamp: ${metrics.timestamp}`);
  console.log(`System Health: ${metrics.system_health.toUpperCase()}`);
  console.log(`v2.1 Audits (24h): ${metrics.v21_audits_24h}`);
  console.log(`v2.1 Audits (7d): ${metrics.v21_audits_7d}`);
  console.log(`Average Overall Score: ${metrics.avg_v21_overall.toFixed(1)}%`);
  console.log(`Average Visibility Score: ${metrics.avg_v21_visibility.toFixed(1)}%`);
  console.log(`Audits with Visibility Data: ${metrics.audits_with_visibility}`);
  console.log(`Error Rate: ${metrics.error_rate.toFixed(1)}%`);
  
  if (metrics.alerts.length > 0) {
    console.log('\n🚨 Alerts:');
    metrics.alerts.forEach(alert => console.log(`  - ${alert}`));
  }
  
  // Log to file for historical tracking
  const fs = require('fs');
  const logEntry = {
    timestamp: metrics.timestamp,
    ...metrics
  };
  
  const logFile = `qa_metrics_${new Date().toISOString().split('T')[0]}.json`;
  const logData = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
  logData.push(logEntry);
  fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
  
  console.log(`\n📝 Metrics logged to: ${logFile}`);
}

async function main() {
  const args = process.argv.slice(2);
  const slackWebhook = args.find(arg => arg.startsWith('--slack-webhook='))?.split('=')[1];
  const email = args.find(arg => arg.startsWith('--email='))?.split('=')[1];
  
  console.log('🔍 Optiview v2.1 Daily QA Job');
  console.log('==============================');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');
  
  try {
    // Fetch metrics
    const metrics = await fetchSystemMetrics();
    
    // Log metrics
    logMetrics(metrics);
    
    // Send notifications if configured
    if (slackWebhook) {
      await sendSlackNotification(metrics, slackWebhook);
    }
    
    if (email) {
      await sendEmailNotification(metrics, email);
    }
    
    // Exit with appropriate code
    if (metrics.system_health === 'critical') {
      console.log('\n🚨 Critical issues detected - exiting with error code');
      process.exit(1);
    } else if (metrics.system_health === 'warning') {
      console.log('\n⚠️  Warnings detected - check logs');
      process.exit(0);
    } else {
      console.log('\n✅ All systems healthy');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('💥 QA job failed:', error);
    process.exit(1);
  }
}

// Run the job
main();
