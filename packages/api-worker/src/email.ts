/**
 * Email Reports - Weekly AI Index Readiness
 * Send via Resend API
 */

interface Env {
  RESEND_KEY?: string;
  FROM_EMAIL?: string;
}

interface Audit {
  id: string;
  domain: string;
  overall_score: number;
  crawlability_score: number;
  structured_data_score: number;
  answerability_score: number;
  trust_score: number;
  issues_count: number;
  pages_crawled: number;
  created_at: number;
}

interface AuditIssue {
  severity: string;
  message: string;
  page_url: string;
}

interface Project {
  id: string;
  name: string;
  owner_email?: string;
}

interface Property {
  id: string;
  domain: string;
}

interface Bot {
  bot_name: string;
  hits: number;
}

export interface WeeklyReportData {
  project: Project;
  property: Property;
  audit: Audit;
  prevAudit?: Audit;
  topIssues: AuditIssue[];
  topBots: Bot[];
  citationsCount: number;
}

/**
 * Send weekly AI Index Readiness report
 */
export async function sendWeeklyReport(
  env: Env,
  data: WeeklyReportData
): Promise<{ messageId?: string; error?: string }> {
  // Skip if no owner_email
  if (!data.project.owner_email) {
    return { error: 'No owner_email configured' };
  }

  // Skip if no Resend API key
  if (!env.RESEND_KEY || !env.FROM_EMAIL) {
    return { error: 'Resend not configured' };
  }

  const { audit, prevAudit, topIssues, topBots, citationsCount, project, property } = data;
  
  // Calculate delta
  const scoreDelta = prevAudit ? audit.overall_score - prevAudit.overall_score : 0;
  const deltaSign = scoreDelta > 0 ? '+' : '';
  const deltaColor = scoreDelta > 0 ? '#10b981' : scoreDelta < 0 ? '#ef4444' : '#9ca3af';

  // Build HTML email
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Index Readiness Report</title>
</head>
<body style="
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f9fafb;
  color: #111827;
">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    
    <!-- Header -->
    <div style="
      background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%);
      padding: 32px 24px;
      border-radius: 12px 12px 0 0;
      text-align: center;
    ">
      <h1 style="
        margin: 0;
        font-size: 28px;
        font-weight: 700;
        color: #ffffff;
      ">
        AI Index Readiness Report
      </h1>
      <p style="
        margin: 8px 0 0 0;
        font-size: 16px;
        color: #e0e7ff;
      ">
        ${property.domain}
      </p>
    </div>

    <!-- Main Content -->
    <div style="
      background: #ffffff;
      padding: 32px 24px;
      border-radius: 0 0 12px 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    ">
      
      <!-- Overall Score -->
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="
          font-size: 56px;
          font-weight: 700;
          color: ${audit.overall_score >= 80 ? '#10b981' : audit.overall_score >= 60 ? '#f59e0b' : '#ef4444'};
          line-height: 1;
        ">
          ${audit.overall_score}
        </div>
        <div style="
          font-size: 14px;
          color: #6b7280;
          margin-top: 8px;
        ">
          Overall AI Readiness Score
        </div>
        ${scoreDelta !== 0 ? `
        <div style="
          display: inline-block;
          margin-top: 8px;
          padding: 4px 12px;
          background: ${deltaColor === '#10b981' ? '#d1fae5' : deltaColor === '#ef4444' ? '#fee2e2' : '#f3f4f6'};
          color: ${deltaColor};
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
        ">
          ${deltaSign}${scoreDelta} from last week
        </div>
        ` : ''}
      </div>

      <!-- Subscores -->
      <div style="margin-bottom: 32px;">
        <h3 style="
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        ">
          Score Breakdown
        </h3>
        <div style="display: grid; gap: 12px;">
          ${renderScoreBar('Crawlability', audit.crawlability_score)}
          ${renderScoreBar('Structured Data', audit.structured_data_score)}
          ${renderScoreBar('Answerability', audit.answerability_score)}
          ${renderScoreBar('Trust & Authority', audit.trust_score)}
        </div>
      </div>

      <!-- Top Issues -->
      ${topIssues.length > 0 ? `
      <div style="margin-bottom: 32px;">
        <h3 style="
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        ">
          Top Issues to Fix
        </h3>
        ${topIssues.slice(0, 3).map(issue => `
        <div style="
          padding: 12px;
          margin-bottom: 8px;
          background: #fef3c7;
          border-left: 3px solid #f59e0b;
          border-radius: 4px;
        ">
          <div style="
            font-weight: 600;
            font-size: 14px;
            color: #92400e;
            margin-bottom: 4px;
          ">
            ${issue.severity.toUpperCase()}
          </div>
          <div style="
            font-size: 14px;
            color: #78350f;
            margin-bottom: 4px;
          ">
            ${issue.message}
          </div>
          <div style="
            font-size: 12px;
            color: #92400e;
            opacity: 0.8;
          ">
            ${truncateUrl(issue.page_url, 60)}
          </div>
        </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- Citations -->
      <div style="margin-bottom: 32px;">
        <h3 style="
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        ">
          AI Citations
        </h3>
        <div style="
          padding: 16px;
          background: #f3f4f6;
          border-radius: 8px;
          text-align: center;
        ">
          <div style="
            font-size: 32px;
            font-weight: 700;
            color: #1e40af;
          ">
            ${citationsCount}
          </div>
          <div style="
            font-size: 14px;
            color: #6b7280;
            margin-top: 4px;
          ">
            Citations found in Bing search results
          </div>
        </div>
      </div>

      <!-- Bot Activity -->
      ${topBots.length > 0 ? `
      <div style="margin-bottom: 32px;">
        <h3 style="
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        ">
          Top AI Bot Activity (Last 7 Days)
        </h3>
        ${topBots.slice(0, 3).map(bot => `
        <div style="
          padding: 12px;
          margin-bottom: 8px;
          background: #f3f4f6;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <span style="font-size: 14px; color: #374151; font-weight: 500;">
            ${bot.bot_name}
          </span>
          <span style="
            padding: 4px 12px;
            background: #1e40af;
            color: #ffffff;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
          ">
            ${bot.hits} hits
          </span>
        </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 32px;">
        <a href="https://app.optiview.ai/a/${audit.id}" style="
          display: inline-block;
          padding: 14px 32px;
          background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%);
          color: #ffffff;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
        ">
          View Full Report →
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="
      text-align: center;
      margin-top: 24px;
      padding: 16px;
      color: #6b7280;
      font-size: 12px;
    ">
      <p style="margin: 0;">
        Sent by <a href="https://optiview.ai" style="color: #1e40af; text-decoration: none;">Optiview</a>
      </p>
      <p style="margin: 8px 0 0 0;">
        You're receiving this because you own the project "${project.name}"
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();

  // Send via Resend
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: data.project.owner_email,
        subject: `AI Readiness Report: ${property.domain} (Score: ${audit.overall_score})`,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend API error:', error);
      return { error: `Resend failed: ${response.status}` };
    }

    const result = await response.json<{ id: string }>();
    console.log(`Email sent: ${result.id} → ${data.project.owner_email}`);
    
    return { messageId: result.id };
  } catch (error) {
    console.error('Email send failed:', error);
    return { error: String(error) };
  }
}

function renderScoreBar(label: string, score: number): string {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const bgColor = score >= 80 ? '#d1fae5' : score >= 60 ? '#fef3c7' : '#fee2e2';
  
  return `
  <div style="margin-bottom: 8px;">
    <div style="
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 13px;
      color: #6b7280;
    ">
      <span>${label}</span>
      <span style="font-weight: 600; color: ${color};">${score}</span>
    </div>
    <div style="
      width: 100%;
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
    ">
      <div style="
        width: ${score}%;
        height: 100%;
        background: ${color};
        transition: width 0.3s ease;
      "></div>
    </div>
  </div>
  `;
}

function truncateUrl(url: string, maxLength: number): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}

