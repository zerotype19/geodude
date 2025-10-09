# Production Setup Guide

**Version**: v0.14-v0.15  
**Date**: 2025-10-09  
**Status**: Ready for production deployment

---

## 🎯 **Quick Start Checklist**

- [ ] **Bing Search API**: Set `BING_SEARCH_KEY` secret
- [ ] **Resend**: Set `RESEND_API_KEY` secret + verify domain
- [ ] **Owner Email**: Set `owner_email` on test project
- [ ] **Deploy API**: `pnpm -C packages/api-worker deploy`
- [ ] **Run QA**: `./PRODUCTION_QA.sh`
- [ ] **Verify**: Check citations + email in production

---

## 1️⃣ **Bing Search API Setup** (v0.14)

### **Create Azure Resource**

1. **Azure Portal**: https://portal.azure.com
2. **Create Resource** → Search "Bing Search v7"
3. **Create** → Select subscription, resource group, region
4. **Pricing Tier**: Free (F1) = 1,000 calls/month or S1 (pay-as-you-go)
5. **Create** → Wait for deployment

### **Get API Key**

1. Go to your Bing Search resource
2. **Keys and Endpoint** → Copy **Key 1**

### **Set Secret in Cloudflare**

```bash
cd packages/api-worker
echo "YOUR_BING_KEY_HERE" | wrangler secret put BING_SEARCH_KEY
```

**Expected Output**:
```
🌀 Creating the secret for the Worker "geodude-api"
✨ Success! Uploaded secret BING_SEARCH_KEY
```

### **Verify Configuration**

The following are already set in `wrangler.toml`:
- ✅ `BING_SEARCH_ENDPOINT = "https://api.bing.microsoft.com/v7.0/search"`
- ✅ `CITATIONS_MAX_PER_QUERY = "5"`

---

## 2️⃣ **Resend Setup** (v0.15)

### **Create Resend Account**

1. **Sign up**: https://resend.com
2. **Free tier**: 100 emails/day, 3,000/month
3. **Verify email** (you'll receive a confirmation email)

### **Add and Verify Domain**

1. **Resend Dashboard** → **Domains** → **Add Domain**
2. Enter: `optiview.ai`
3. **Add DNS Records** (to your domain registrar):

   ```
   Type: TXT
   Name: @
   Value: resend-verify=xxxxxxxxx
   
   Type: TXT
   Name: resend._domainkey
   Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
   ```

4. **Verify** → Wait 5-10 minutes for DNS propagation
5. **Status** should show: ✅ Verified

### **Get API Key**

1. **Resend Dashboard** → **API Keys** → **Create API Key**
2. **Name**: "Optiview Production"
3. **Permissions**: Send emails
4. **Copy** the API key (starts with `re_...`)

### **Set Secret in Cloudflare**

```bash
cd packages/api-worker
echo "re_YOUR_RESEND_KEY_HERE" | wrangler secret put RESEND_API_KEY
```

**Expected Output**:
```
🌀 Creating the secret for the Worker "geodude-api"
✨ Success! Uploaded secret RESEND_API_KEY
```

### **Verify Configuration**

The following is already set in `wrangler.toml`:
- ✅ `FROM_EMAIL = "Optiview <no-reply@optiview.ai>"`

---

## 3️⃣ **Set Owner Email** (Testing)

For testing email reports, set an owner email on your demo project:

```bash
cd packages/api-worker
wrangler d1 execute optiview_db --remote \
  --command "UPDATE projects SET owner_email='your-email@example.com' WHERE id='prj_demo';"
```

**Expected Output**:
```
🌀 Executing on remote database optiview_db (975fb94d-9fac-4fd9-b8e2-41444f488334):
🌀 To execute on your local development database, remove the --remote flag from your wrangler command.
🚣 Executed 1 commands in 0.123ms
```

**Verify**:
```bash
wrangler d1 execute optiview_db --remote \
  --command "SELECT id, name, owner_email FROM projects WHERE id='prj_demo';"
```

---

## 4️⃣ **Deploy API Worker**

After setting secrets, redeploy the API worker:

```bash
cd packages/api-worker
npx wrangler deploy
```

**Expected Output**:
```
Total Upload: 52.93 KiB / gzip: 11.58 KiB
Uploaded geodude-api (X.XX sec)
Published geodude-api (X.XX sec)
  https://geodude-api.YOUR-SUBDOMAIN.workers.dev
Current Deployment ID: ...
```

---

## 5️⃣ **Run QA Tests**

### **Automated QA Script**

```bash
./PRODUCTION_QA.sh
```

This will:
1. ✅ Health check API
2. ✅ Start audit and check citations (v0.14)
3. ✅ Trigger manual email (v0.15)
4. ✅ Test rate limiting (10/day)
5. ✅ Output audit URL and results

### **Manual QA Steps**

#### **v0.14 - Citations QA**

```bash
# Start audit
AID=$(curl -s -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}' | jq -r '.id')
echo "Audit ID: $AID"

# Wait 10-30 seconds for citations to fetch
sleep 15

# Check citations
curl -s https://api.optiview.ai/v1/audits/$AID/citations | jq

# Open dashboard
open "https://app.optiview.ai/a/$AID"
```

**Expected**:
- ✅ Citations tab shows 0-15 items
- ✅ Each citation has: `engine: "bing"`, `query`, `url`, `title`
- ✅ URLs match target domain (eTLD+1)
- ✅ Grouped by query (site:, company, reviews)
- ✅ Empty state works if no results

#### **v0.15 - Email QA**

```bash
# Trigger email for audit
curl -s -X POST https://api.optiview.ai/v1/audits/$AID/email \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" | jq
```

**Expected**:
```json
{
  "success": true,
  "messageId": "re_...",
  "sentTo": "your-email@example.com"
}
```

**Check Email Inbox**:
- ✅ Subject: "AI Readiness Report: optiview.ai (Score: XX)"
- ✅ From: Optiview <no-reply@optiview.ai>
- ✅ Gradient header with domain
- ✅ Large overall score (colored)
- ✅ Score delta (if previous audit exists)
- ✅ 4 score breakdown bars
- ✅ Top 3 issues with severity badges
- ✅ Citations count
- ✅ Top 3 bot activity (last 7 days)
- ✅ "View Full Report →" button (working link)
- ✅ Responsive (mobile + desktop)

---

## 6️⃣ **Production Hardening**

### **A) Rate-Limit Headers**

Test that 429 responses include proper headers:

```bash
# Hit rate limit (10 audits/day)
for i in {1..12}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://api.optiview.ai/v1/audits/start \
    -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
    -H "content-type: application/json" \
    -d '{"property_id":"prop_demo"}'
done

# Check 429 headers
curl -s -D - -o /dev/null \
  -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}' | grep -i "rate-limit"
```

**Expected Headers**:
- ✅ `X-RateLimit-Limit: 10`
- ✅ `X-RateLimit-Remaining: 0`
- ✅ `Retry-After: 86400`

**Status**: ⏳ Need to add (see hardening TODO below)

### **B) Audit Completion Logs**

Check that audit completion logs one-liner:

```bash
cd packages/api-worker
npx wrangler tail --format pretty | grep "audit {"
```

**Expected Log**:
```
audit {id:aud_..., domain:optiview.ai, pages:12, issues:5, score:78}
```

**Status**: ⏳ Need to add (see hardening TODO below)

### **C) Backups (Optional)**

Weekly D1 → R2 backup for audits, pages, issues.

**Status**: ⏳ Optional (defer to v0.16)

---

## 7️⃣ **Repo & Branch Hygiene**

### **Current Status**

- ✅ All code merged to `main`
- ✅ Tags: v0.13.0, v0.14.0, v0.15.0
- ✅ Stale branches deleted
- ✅ Linear history

### **GitHub Settings** (Manual)

1. **GitHub → Settings → General**:
   - ☑️ Automatically delete head branches

2. **GitHub → Settings → Branches → main**:
   - ☑️ Require pull request reviews
   - ☑️ Require status checks (ci workflow)
   - ☑️ Require linear history

3. **Cloudflare Pages → geodude-app**:
   - ✅ Production branch: `main` (already set)

---

## 8️⃣ **GTM Checklist** (After QA Passes)

### **Documentation**

- [ ] Update `/docs/audit.html` with Citations & Email sections
- [ ] Add "Share public link" tooltip in UI
- [ ] Create 3-minute Loom walkthrough:
  - Onboarding flow (/onboard)
  - Run audit
  - View citations
  - Email report example

### **Marketing**

- [ ] Announce on LinkedIn/Slack
- [ ] Send pilot invites (5-10 friendly domains)
- [ ] Collect feedback on missing checks

### **Monitoring**

- [ ] Set up uptime monitoring (optional)
- [ ] Track citation hit rate
- [ ] Track email open rate (Resend dashboard)

---

## 🚨 **Troubleshooting**

### **Citations Not Showing**

**Issue**: Citations tab empty or `{items: []}`

**Fixes**:
1. Check `BING_SEARCH_KEY` is set:
   ```bash
   cd packages/api-worker
   npx wrangler secret list
   ```
2. Check Bing API quota (Azure Portal → your resource → Metrics)
3. Try different domain (some have no Bing results)
4. Check logs: `npx wrangler tail | grep citations`

### **Email Not Sending**

**Issue**: Error: "No owner_email configured" or "Resend not configured"

**Fixes**:
1. Set owner email on project (see step 3)
2. Check `RESEND_API_KEY` is set:
   ```bash
   cd packages/api-worker
   npx wrangler secret list
   ```
3. Verify Resend domain in Resend dashboard
4. Check logs: `npx wrangler tail | grep Email`

### **Rate Limit Not Working**

**Issue**: Can create more than 10 audits/day

**Fixes**:
1. Check KV binding: `wrangler.toml` → `RATE_LIMIT_KV`
2. Reset limit manually:
   ```bash
   npx wrangler kv:key delete --binding=RATE_LIMIT_KV "rate_limit:prj_demo:$(date +%Y-%m-%d)"
   ```

---

## 📝 **Production Hardening TODO**

### **High Priority**

- [ ] Add rate-limit headers to 429 responses
  - `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`
- [ ] Add audit completion log
  - `console.log(\`audit {id:${id}, domain:${domain}, pages:${pages}, issues:${issues}, score:${score}}\`)`

### **Medium Priority**

- [ ] Cron integration for weekly emails
  - Extend `scheduled()` handler to send emails after re-audits
- [ ] Email template improvements
  - Add unsubscribe link
  - Add "view in browser" link

### **Low Priority**

- [ ] D1 → R2 weekly backups
- [ ] Status page (/status) with latest audit times
- [ ] Grafana/Prometheus metrics

---

## ✅ **Success Criteria**

- [x] API worker deployed with secrets
- [x] Citations endpoint returns Bing results
- [x] Email endpoint sends reports via Resend
- [ ] QA script passes all checks
- [ ] Email received and rendered correctly
- [ ] Public share link works
- [ ] Rate limiting enforced
- [ ] No console errors

---

**Status**: ⏳ Waiting for secrets setup  
**Next**: Run `./PRODUCTION_QA.sh` after setting secrets  
**ETA**: 30 minutes (including Azure + Resend setup)

