# Go-Live Checklist

**Target**: Production deployment of Geodude v0.9.0-mvp  
**Date**: 2025-10-09

---

## ☐ DNS Configuration

### Collector Domain
- [ ] Add CNAME record: `collector.optiview.ai` → `geodude-collector.workers.dev`
- [ ] Enable Cloudflare proxy (orange cloud)
- [ ] Test: `curl -I https://collector.optiview.ai/px?prop_id=prop_demo`
- [ ] Verify: Should return 200 with content-type: image/gif

### Dashboard Domain (if deploying now)
- [ ] Create Cloudflare Pages project for `apps/app`
- [ ] Set build output directory: `apps/app/dist`
- [ ] Add custom domain: `app.optiview.ai`
- [ ] Test: `curl -I https://app.optiview.ai/`
- [ ] Verify: Should return 200 with React app

---

## ☐ API Key Rotation

### Rotate from dev_key to production key

**Generate new key** (use ULID or similar):
```bash
# Example: prj_live_01JB2K3M4N5P6Q7R8S9T0V
NEW_KEY="prj_live_$(openssl rand -hex 12)"
echo $NEW_KEY
```

**Update D1**:
```bash
wrangler d1 execute optiview_db --remote \
  --command "UPDATE projects SET api_key='$NEW_KEY' WHERE id='prj_demo';"
```

**Store securely**:
- [ ] Save to password manager (1Password, LastPass, etc.)
- [ ] Share with authorized team members only
- [ ] Update dashboard env if deployed

**Test**:
```bash
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "content-type: application/json" \
  -H "x-api-key: $NEW_KEY" \
  -d '{"property_id":"prop_demo"}'
```

---

## ☐ Rate Limit Configuration

- [x] Default set to 10 audits/day (AUDIT_DAILY_LIMIT=10)
- [ ] Confirm this is appropriate for launch
- [ ] Optional: Increase for beta users if needed
- [ ] Monitor KV usage (should be minimal)

**To adjust**:
```bash
# In packages/api-worker/wrangler.toml
[vars]
AUDIT_DAILY_LIMIT = "10"  # Change as needed
```

---

## ☐ Cron Verification

- [x] Schedule: Mondays 6am UTC (`0 6 * * 1`)
- [x] Max pages: 30 (AUDIT_MAX_PAGES)
- [ ] Verify cron trigger in Cloudflare dashboard
- [ ] Check logs after first Monday run

**View logs**:
```bash
wrangler tail geodude-api --format=pretty
```

**Expected log output** (after Monday 6am UTC):
```
Cron audit started at 2025-10-XX 06:00:00
Found N verified properties to audit
Cron audit started: prop_demo (optiview.ai)
Cron audit completed: prop_demo → aud_xxxxx
Cron audit batch completed
```

---

## ☐ Self-Audit & Dogfooding

### Run audit on optiview.ai
```bash
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "content-type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"property_id":"prop_demo"}' | jq
```

- [ ] Review score (target: 0.95+)
- [ ] Check issues (should be minimal)
- [ ] Fix any High/Critical issues found
- [ ] Re-run audit to verify improvements

**Current score**: 0.99/1.0 ✅
**Issues**: 1 warning (thin content on homepage)

### Optional fixes:
- [ ] Add more content to homepage (increase word count)
- [ ] Ensure all 3 docs pages have sufficient content
- [ ] Verify FAQ schema on all pages

---

## ☐ Documentation Links

- [x] Footer links on homepage
  - [x] /docs/audit.html
  - [x] /docs/bots.html
  - [x] /docs/security.html
- [x] Sitemap includes all docs
- [x] robots.txt references sitemap

**Test**:
```bash
curl -s https://optiview.ai/ | grep -o 'href="/docs/[^"]*"'
curl -s https://optiview.ai/sitemap.xml | grep -o '<loc>[^<]*</loc>'
```

---

## ☐ Security Checklist

### Headers
- [x] X-Content-Type-Options: nosniff
- [x] X-Frame-Options: DENY (or SAMEORIGIN)
- [x] Referrer-Policy: strict-origin-when-cross-origin
- [x] CORS configured correctly

**Verify**:
```bash
curl -I https://optiview.ai/ | grep -E "X-|Referrer"
curl -I https://api.optiview.ai/health | grep -E "Access-Control"
```

### API Security
- [x] x-api-key required for audit endpoints
- [x] 401 Unauthorized without key
- [x] Rate limiting enforced (429 on exceed)
- [ ] Consider adding IP-based rate limiting (future)

### Privacy
- [x] IP hashing (SHA-256, no raw IPs)
- [x] No tracking cookies
- [x] Minimal data collection
- [x] GDPR-compliant (privacy-first design)

---

## ☐ Monitoring Setup

### Cloudflare Dashboard
- [ ] Bookmark Workers analytics
- [ ] Set up email alerts for errors
- [ ] Monitor D1 usage
- [ ] Monitor KV usage

### Weekly Check (SQL)
```bash
wrangler d1 execute optiview_db --remote --command \
  "SELECT DATE(created_at) d, bot_type, COUNT(*) c 
   FROM hits 
   GROUP BY d, bot_type 
   ORDER BY d DESC, c DESC 
   LIMIT 50;"
```

### Audit Failures
- [ ] Check for audits with status='error'
- [ ] Monitor audit duration (should be < 90s)

```bash
wrangler d1 execute optiview_db --remote --command \
  "SELECT id, property_id, status, error, started_at, completed_at 
   FROM audits 
   WHERE status != 'completed' 
   ORDER BY started_at DESC 
   LIMIT 10;"
```

---

## ☐ Customer Onboarding (Ready)

### Email Template
```
Subject: Welcome to Optiview - Your API Key

Hi [Name],

Welcome to Optiview! Here's your API key to get started:

API Key: [REDACTED - from password manager]

Quick Start:
1. Visit https://app.optiview.ai
2. Paste your API key
3. Enter your domain
4. Click "Run Audit"
5. Review scores and fix suggested issues

Optional: Install 1px tracking beacon to see AI bot visits.

Docs: https://optiview.ai/docs/audit.html

Questions? Reply to this email.

Thanks,
The Optiview Team
```

### Demo Script (3 minutes)
1. **Show robots.txt**: https://optiview.ai/robots.txt
   - "See how we allow AI bots? GPTBot, ClaudeBot, etc."
   
2. **Run audit**: https://app.optiview.ai
   - Input API key
   - Run audit
   - Watch scores appear
   - Show issues table
   
3. **Show docs with FAQ**: https://optiview.ai/docs/audit.html
   - "We dogfood our own product - FAQ schema here"
   - Re-run audit → scores improve
   
4. **Optional - Bot tracking**:
   ```bash
   curl -H "User-Agent: GPTBot" \
     "https://collector.optiview.ai/px?prop_id=prop_demo"
   ```
   - Show DB row appears with bot_type="GPTBot"

---

## ☐ Pre-Launch Final Checks

- [ ] All DNS records configured
- [ ] API key rotated and stored securely
- [ ] Rate limits appropriate
- [ ] Cron schedule verified
- [ ] Self-audit score ≥ 0.95
- [ ] All docs links working
- [ ] Security headers present
- [ ] Monitoring dashboard bookmarked
- [ ] Customer onboarding email ready
- [ ] Demo script tested

---

## ☐ Launch Day

- [ ] Deploy dashboard to app.optiview.ai (if not already)
- [ ] Send announcement (if applicable)
- [ ] Monitor logs for first few hours
- [ ] Check for any 500 errors
- [ ] Verify first customer audit runs successfully
- [ ] Monitor rate limit usage

---

## Post-Launch (Week 1)

- [ ] Check Monday cron execution
- [ ] Review bot tracking data
- [ ] Monitor audit success rate
- [ ] Gather initial customer feedback
- [ ] Fix any bugs discovered
- [ ] Plan M8-M10 implementation

---

**Status**: Ready for production ✅  
**Next**: Complete DNS setup and rotate API key

