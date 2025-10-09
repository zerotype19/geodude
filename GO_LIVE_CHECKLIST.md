# 🚀 Go-Live Checklist

## Status: In Progress

### ✅ Completed (Automated)
- [x] Status page deployed to Cloudflare Pages
- [x] Noindex protection added (meta + headers)
- [x] Cache control configured (no-store)
- [x] All workflows using single pnpm version source
- [x] CI smoke tests (citations + status)
- [x] R2 backups configured (nightly 03:00 UTC)
- [x] Cache warming configured (after Monday audits)
- [x] Admin metrics endpoint created
- [x] Comprehensive documentation written

---

## 🔧 Manual Steps Required (5-10 minutes)

### Step 1: Set Admin Authentication ⚠️ REQUIRED
```bash
cd packages/api-worker
echo "ops:YOUR_STRONG_PASSWORD_HERE" | npx wrangler secret put ADMIN_BASIC_AUTH
```

**Replace `YOUR_STRONG_PASSWORD_HERE` with a strong password!**

Format: `username:password` (e.g., `ops:P@ssw0rd123!`)

---

### Step 2: Test All Monitoring Endpoints ⚠️ REQUIRED

After setting admin auth, test:

```bash
# 1. Status endpoint (public)
curl -s https://api.optiview.ai/status | jq

# Expected: {"status":"ok", "latest_audit":{...}, "citations_budget":{...}}

# 2. Budget endpoint (public)
curl -s https://api.optiview.ai/v1/citations/budget | jq

# Expected: {"used":X, "remaining":Y, "max":200, "date":"YYYY-MM-DD"}

# 3. Metrics endpoint (requires auth)
curl -s -u ops:YOUR_PASSWORD https://api.optiview.ai/v1/admin/metrics | jq

# Expected: {"audits_7d":X, "avg_score_7d":"0.XXX", "domains_7d":Y, "timestamp":"..."}
```

**✅ Pass Criteria**:
- All 3 endpoints return valid JSON
- Status endpoint shows `"status":"ok"`
- Metrics endpoint works with auth (401 without)

---

### Step 3: Verify R2 Backups 📦

Check if backups are present (may be empty if not yet 03:00 UTC):

```bash
npx wrangler r2 object list geodude-backups --prefix backups/$(date -u +%F)/
```

**Expected**:
- 4 files: `audits.jsonl`, `audit_pages.jsonl`, `audit_issues.jsonl`, `citations.jsonl`
- OR empty if backup hasn't run yet (first run at 03:00 UTC)

**Note**: First backup will appear after 03:00 UTC tomorrow.

---

### Step 4: Test Fresh Audit & Citations 🧪

```bash
# Start new audit
AID=$(curl -s -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}' | jq -r '.id')

echo "Audit ID: $AID"

# Check citations
curl -s https://api.optiview.ai/v1/audits/$AID/citations | jq

# Open in browser
echo "Share link: https://app.optiview.ai/a/$AID"
```

**✅ Pass Criteria**:
- Audit completes (status: "completed")
- Citations endpoint returns `{"items":[...]}`
- Share link loads with Citations tab
- Citations load instantly (if cached) or within 1-2 seconds

---

### Step 5: Verify Status Page 🖥️

```bash
# Open status page
open https://c6b5ecd3.geodude.pages.dev/status.html
# Or: https://optiview.ai/status.html (once DNS is live)
```

**✅ Pass Criteria**:
- Page loads with gradient background
- Shows "All Systems Operational" (green badge)
- Displays latest audit timestamp
- Shows budget bar (green = good)
- Auto-refreshes every 30 seconds

**Privacy Check**:
- View page source: `<meta name="robots" content="noindex,nofollow">`
- Check response headers: `X-Robots-Tag: noindex, nofollow`

---

### Step 6: Verify CI is Green ✅

Check GitHub Actions:
```bash
open https://github.com/zerotype19/geodude/actions
```

**✅ Pass Criteria**:
- Latest workflow run shows green checkmark
- "API smoke - citations shape" passes
- "API smoke - status" passes
- No failed builds

---

## 📋 Final Go-Live Checklist

### Core Functionality
- [ ] Admin auth set (`ADMIN_BASIC_AUTH` secret)
- [ ] Status endpoint returns `"ok"`
- [ ] Budget endpoint returns valid data
- [ ] Metrics endpoint works with auth
- [ ] Fresh audit completes successfully
- [ ] Citations tab loads (populated or graceful empty state)
- [ ] Share links work publicly

### Monitoring & Operations
- [ ] Status page accessible and auto-refreshing
- [ ] R2 backups configured (will run at 03:00 UTC)
- [ ] Cache warming configured (runs after Monday audits)
- [ ] CI smoke tests passing
- [ ] All secrets set:
  - [ ] `BRAVE_SEARCH`
  - [ ] `RESEND_KEY`
  - [ ] `ADMIN_BASIC_AUTH`

### Documentation
- [ ] Team trained on daily status check
- [ ] `SETUP_COMPLETE.md` reviewed
- [ ] `docs/week-1-ops-plan.md` bookmarked
- [ ] `docs/ops-runbook.md` accessible

### Optional (Can Do Later)
- [ ] Alerts configured (budget < 20)
- [ ] Weekly metrics review scheduled
- [ ] Per-project budget limits
- [ ] "Send Report" button in dashboard
- [ ] Admin dashboard UI at `/admin`

---

## 🎯 Success Criteria (End of Day 1)

### Availability
- ✅ All endpoints responding
- ✅ Status page live and updating
- ✅ No errors in worker logs

### Performance
- ✅ Citations cache working (check logs for "cache hit")
- ✅ API responses < 500ms
- ✅ Share links load < 2 seconds

### Reliability
- ✅ Budget > 150 remaining
- ✅ All cron jobs configured
- ✅ CI pipeline green

---

## 📊 Post-Launch Monitoring (First 24 Hours)

### Hour 1
```bash
# Check status every 15 minutes
watch -n 900 'curl -s https://api.optiview.ai/status | jq'
```

### Hour 4
```bash
# Verify budget consumption
curl -s https://api.optiview.ai/v1/citations/budget | jq
# Expected: used < 10 (light usage)
```

### Hour 24
```bash
# Check for backup after 03:00 UTC
npx wrangler r2 object list geodude-backups --prefix backups/$(date -u +%F)/
# Expected: 4 files present
```

---

## 🚨 Rollback Procedures

### If Status Endpoint Fails
```bash
# Check worker logs
npx wrangler tail geodude-api --format=json | jq -r 'select(.out).out'

# Redeploy if needed
cd packages/api-worker && pnpm deploy
```

### If Budget Exhausts Unexpectedly
```bash
# Increase budget immediately
# Edit packages/api-worker/wrangler.toml
CITATIONS_DAILY_BUDGET = "400"

# Redeploy
pnpm -C packages/api-worker deploy
```

### If Backup Fails
```bash
# Check R2 binding
npx wrangler r2 bucket list | grep geodude-backups

# Check cron logs
npx wrangler tail geodude-api | grep -i backup

# Manual backup if needed
npx wrangler d1 export optiview_db --remote --output=manual_backup.sql
```

---

## 📞 Support Contacts

### Cloudflare Issues
- Dashboard: https://dash.cloudflare.com
- Status: https://www.cloudflarestatus.com

### Brave Search Issues
- Dashboard: https://brave.com/search/api/
- Support: api-support@brave.com

### Resend Issues
- Dashboard: https://resend.com/dashboard
- Status: https://resend.com/status

---

## ✨ You're Almost There!

**Remaining**: Just set `ADMIN_BASIC_AUTH` → Test endpoints → You're live! 🚀

All systems are **deployed**, **configured**, and **ready**. 

**Last mile**: 5 minutes of manual verification, then you're **production-ready**! 💪
