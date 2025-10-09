# v0.15 - Email Reports & Notifications Specification

**Goal**: Send weekly "AI Index Readiness" email when cron runs  
**Timeline**: 1 day  
**Priority**: Medium (retention feature)

---

## 🎯 OBJECTIVES

1. Integrate Resend API for email delivery
2. Send weekly audit summary on cron
3. Include scores delta, top issues, share link
4. Track bot visits in email
5. Beautiful HTML email template

---

## 📧 RESEND API

### **Setup**
1. Create account at https://resend.com (free tier: 100 emails/day)
2. Verify sending domain (e.g., `@optiview.ai`)
3. Get API key
4. Add to Worker secrets:
   ```bash
   wrangler secret put RESEND_API_KEY
   ```

### **API Details**
- **Endpoint**: `https://api.resend.com/emails`
- **Auth**: Header `Authorization: Bearer {key}`
- **Method**: POST
- **Rate Limit**: 100 emails/day (free), 1000/day (paid)

### **Request**
```json
{
  "from": "Optiview <audits@optiview.ai>",
  "to": ["user@example.com"],
  "subject": "Weekly AI Index Report - Your Site",
  "html": "<html>...</html>"
}
```

### **Response**
```json
{
  "id": "msg_...",
  "from": "audits@optiview.ai",
  "to": ["user@example.com"],
  "created_at": "2025-10-09T16:30:00.000Z"
}
```

---

## 🔧 IMPLEMENTATION

### **New File: `packages/api-worker/src/email.ts`**

```typescript
interface EmailAuditSummary {
  domain: string;
  auditId: string;
  scoreOverall: number;
  scorePrevious?: number;
  scoreDelta?: number;
  topIssues: Array<{ severity: string; message: string }>;
  botsThisWeek: Array<{ bot_id: string; count: number }>;
  shareLink: string;
}

export async function sendWeeklyReport(
  env: Env,
  ownerEmail: string,
  summary: EmailAuditSummary
): Promise<{ id: string } | null> {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set, skipping email');
    return null;
  }

  const html = generateEmailHTML(summary);
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Optiview <audits@optiview.ai>',
        to: [ownerEmail],
        subject: `Weekly AI Index Report - ${summary.domain}`,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend API error:', error);
      return null;
    }

    const data = await response.json();
    console.log('Email sent:', data.id);
    return data;
  } catch (error) {
    console.error('Failed to send email:', error);
    return null;
  }
}

function generateEmailHTML(summary: EmailAuditSummary): string {
  const deltaSign = summary.scoreDelta && summary.scoreDelta > 0 ? '+' : '';
  const deltaColor = summary.scoreDelta && summary.scoreDelta > 0 ? '#10b981' : '#ef4444';
  const scorePercent = Math.round((summary.scoreOverall || 0) * 100);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly AI Index Report</title>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; background: #0b0b0c; color: #f3f4f6; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #141518; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0 0 8px 0; font-size: 24px; color: white;">Weekly AI Index Report</h1>
      <p style="margin: 0; opacity: 0.9; color: white;">${summary.domain}</p>
    </div>

    <!-- Score Card -->
    <div style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #1f2937;">
      <div style="font-size: 48px; font-weight: 700; margin-bottom: 8px;">${scorePercent}%</div>
      <div style="font-size: 14px; opacity: 0.8;">Overall AI Readiness Score</div>
      ${summary.scoreDelta ? `
        <div style="margin-top: 12px; font-size: 16px; color: ${deltaColor};">
          ${deltaSign}${Math.round((summary.scoreDelta || 0) * 100)}% from last week
        </div>
      ` : ''}
    </div>

    <!-- Top Issues -->
    ${summary.topIssues.length > 0 ? `
    <div style="padding: 24px; border-bottom: 1px solid #1f2937;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px;">Top Issues to Fix</h3>
      ${summary.topIssues.map(issue => `
        <div style="background: #1a1b1e; padding: 12px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid ${issue.severity === 'critical' ? '#ef4444' : '#f59e0b'};">
          <div style="font-size: 12px; text-transform: uppercase; opacity: 0.7; margin-bottom: 4px;">${issue.severity}</div>
          <div style="font-size: 14px;">${issue.message}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Bot Activity -->
    ${summary.botsThisWeek.length > 0 ? `
    <div style="padding: 24px; border-bottom: 1px solid #1f2937;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px;">AI Bot Visits This Week</h3>
      ${summary.botsThisWeek.map(bot => `
        <div style="display: flex; justify-content: space-between; padding: 8px 0;">
          <span style="opacity: 0.8;">${bot.bot_id}</span>
          <span style="font-weight: 600;">${bot.count} visits</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- CTA -->
    <div style="padding: 32px 24px; text-align: center;">
      <a href="${summary.shareLink}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
        View Full Report
      </a>
      <p style="margin: 16px 0 0 0; font-size: 12px; opacity: 0.6;">
        <a href="https://app.optiview.ai/" style="color: #93c5fd; text-decoration: none;">Dashboard</a> • 
        <a href="https://optiview.ai/docs/" style="color: #93c5fd; text-decoration: none;">Docs</a>
      </p>
    </div>

  </div>

  <!-- Footer -->
  <div style="text-align: center; padding: 24px; font-size: 12px; opacity: 0.6;">
    <p style="margin: 0;">You're receiving this because you have an active Optiview audit for ${summary.domain}.</p>
    <p style="margin: 8px 0 0 0;">
      <a href="https://optiview.ai" style="color: #93c5fd; text-decoration: none;">optiview.ai</a>
    </p>
  </div>
</body>
</html>
  `.trim();
}
```

### **Update: `packages/api-worker/src/index.ts`**

```typescript
import { sendWeeklyReport } from './email';

// In scheduled() handler, after running audit:
async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  console.log('Cron triggered at', new Date(event.scheduledTime));

  try {
    // ... existing audit logic ...

    // After audit completes, send email
    if (project.owner_email && audit) {
      // Get previous audit for comparison
      const previousAudit = await env.DB.prepare(
        `SELECT score_overall 
         FROM audits 
         WHERE property_id = ? AND id != ? AND finished_at IS NOT NULL
         ORDER BY finished_at DESC 
         LIMIT 1`
      ).bind(property.id, audit.id).first<{ score_overall: number }>();

      // Get top issues
      const topIssues = await env.DB.prepare(
        `SELECT severity, message 
         FROM audit_issues 
         WHERE audit_id = ? 
         ORDER BY 
           CASE severity 
             WHEN 'critical' THEN 1 
             WHEN 'warning' THEN 2 
             ELSE 3 
           END,
           id
         LIMIT 3`
      ).bind(audit.id).all();

      // Get bot activity (last 7 days)
      const weekAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
      const botActivity = await env.DB.prepare(
        `SELECT bot_id, COUNT(*) as count
         FROM hits
         WHERE property_id = ? AND ts > ?
         GROUP BY bot_id
         ORDER BY count DESC
         LIMIT 5`
      ).bind(property.id, weekAgo).all();

      // Send email
      const emailResult = await sendWeeklyReport(env, project.owner_email, {
        domain: property.domain,
        auditId: audit.id,
        scoreOverall: audit.score_overall,
        scorePrevious: previousAudit?.score_overall,
        scoreDelta: previousAudit 
          ? audit.score_overall - previousAudit.score_overall 
          : undefined,
        topIssues: (topIssues.results || []).map((i: any) => ({
          severity: i.severity,
          message: i.message,
        })),
        botsThisWeek: (botActivity.results || []).map((b: any) => ({
          bot_id: b.bot_id,
          count: b.count,
        })),
        shareLink: `https://app.optiview.ai/a/${audit.id}`,
      });

      if (emailResult) {
        console.log('Weekly email sent:', emailResult.id);
      }
    }
  } catch (error) {
    console.error('Cron error:', error);
  }
}
```

### **Add to `wrangler.toml`**

```toml
[env.production.vars]
FROM_EMAIL = "audits@optiview.ai"

# Add secret via CLI:
# wrangler secret put RESEND_API_KEY --env production
```

---

## 🧪 TESTING

### **1. Setup Resend**
```bash
# Create account at https://resend.com
# Verify domain (optiview.ai)
# Get API key

# Add to Worker
wrangler secret put RESEND_API_KEY --env production
```

### **2. Test Email Sending**
```bash
# Test locally with curl
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "audits@optiview.ai",
    "to": ["your-email@example.com"],
    "subject": "Test",
    "html": "<p>Test email</p>"
  }'
```

### **3. Test Cron Manually**
```typescript
// Add test endpoint to index.ts
if (path === '/v1/test/email' && request.method === 'POST') {
  const { audit_id } = await request.json();
  // ... fetch audit, send email ...
  return new Response(JSON.stringify({ sent: true }), { headers: corsHeaders });
}
```

```bash
# Trigger test email
curl -X POST https://api.optiview.ai/v1/test/email \
  -H "x-api-key: prj_live_..." \
  -d '{"audit_id": "aud_..."}'
```

---

## 📋 ACCEPTANCE CRITERIA

- [ ] Resend API integrated
- [ ] Email template looks good in Gmail/Outlook
- [ ] Score delta calculated correctly
- [ ] Top 3 issues displayed
- [ ] Bot activity shown (last 7 days)
- [ ] Share link works
- [ ] Email sent after cron completes
- [ ] Message ID logged
- [ ] Errors handled gracefully
- [ ] owner_email column added to projects

---

## 🎯 SUCCESS METRICS

- 🎯 100% email delivery rate
- 🎯 >50% email open rate
- 🎯 1+ user clicks share link from email
- 🎯 Zero bounce/spam complaints
- 🎯 Emails sent within 5 minutes of cron

---

## 🚀 DEPLOYMENT

```bash
# 1. Verify domain in Resend
# (Manual step in Resend dashboard)

# 2. Add secret
wrangler secret put RESEND_API_KEY --env production

# 3. Apply migration (add owner_email to projects)
npx wrangler d1 execute optiview_db --remote \
  --command "ALTER TABLE projects ADD COLUMN owner_email TEXT"

# 4. Deploy worker
cd packages/api-worker
npx wrangler deploy

# 5. Test email
curl -X POST https://api.optiview.ai/v1/test/email \
  -H "x-api-key: prj_live_..." \
  -d '{"audit_id": "aud_..."}'

# 6. Wait for Monday cron or trigger manually
```

---

## 📝 CURSOR PROMPTS

### **Prompt A: Email Module**
```
Create packages/api-worker/src/email.ts with:
- sendWeeklyReport(env, ownerEmail, summary) function
- generateEmailHTML(summary) function with beautiful HTML template
- Include score card, score delta, top 3 issues, bot activity
- Use Resend API (POST https://api.resend.com/emails)
- Add RESEND_API_KEY to Env interface
```

### **Prompt B: Cron Integration**
```
Update index.ts scheduled() handler:
- After audit completes, fetch previous audit for score comparison
- Fetch top 3 issues ordered by severity
- Fetch bot activity (last 7 days) grouped by bot_id
- Call sendWeeklyReport() if project.owner_email exists
- Log message ID if successful
```

### **Prompt C: Test Endpoint**
```
Add POST /v1/test/email endpoint (requires x-api-key):
- Accept audit_id in body
- Fetch audit, issues, bot activity
- Send email using sendWeeklyReport()
- Return {sent: true, message_id: "..."}
Used for testing before waiting for cron.
```

---

**Status**: Ready to implement (after v0.14)  
**Estimated Time**: 4-6 hours  
**Complexity**: Low-Medium  
**Dependencies**: Resend account + domain verification

