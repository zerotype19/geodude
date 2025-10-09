# 🎯 Optiview Operations Playbook

Quick reference for common operational scenarios.

---

## 🚨 Common Issues & Fixes

### Budget Exhausted (429 Errors)

**Symptoms**:
- API returns 429 status code
- Error message: "Daily citations budget exceeded"
- `/v1/citations/budget` shows `remaining: 0`

**Fix**:
```bash
cd packages/api-worker

# Edit wrangler.toml
# Change: CITATIONS_DAILY_BUDGET = "400"  # was 200

pnpm deploy
```

**Verify**:
```bash
curl -s https://api.optiview.ai/v1/citations/budget | jq
# Should show: "max": 400, "remaining": > 0
```

**Timeline**: Takes effect immediately after deploy (~30 seconds)

---

### Citations Slow on First View

**Symptoms**:
- First audit takes 2-3 seconds for citations
- Subsequent audits are instant

**Explanation**: This is expected! First call fetches from Brave API, subsequent calls hit 24-hour cache.

**Solutions**:

**Option A: Wait for auto-warmup (recommended)**
- Cache warms automatically after Monday 06:00 UTC audits
- No action needed

**Option B: Manual warmup**
```bash
# Run one audit to prime the cache
curl -s -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: YOUR_API_KEY" \
  -H "content-type: application/json" \
  -d '{"property_id":"YOUR_PROPERTY_ID"}' | jq
```

**Option C: Pre-warm specific domains**
```bash
# Edit packages/api-worker/src/citations-warm.ts
# Add specific domains to warmup list
pnpm -C packages/api-worker deploy
```

---

### Bad Deploy / Broken Worker

**Symptoms**:
- API returns 500 errors
- Worker logs show exceptions
- `/status` endpoint fails

**Fix - Quick Rollback**:
```bash
# View recent deployments
cd packages/api-worker
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback [DEPLOYMENT_ID]
```

**Fix - Git Revert**:
```bash
# Find bad commit
git log --oneline -10

# Revert it
git revert [COMMIT_SHA]

# Redeploy
cd packages/api-worker
pnpm deploy
```

**Verify**:
```bash
curl -s https://api.optiview.ai/status | jq
# Should show: "status": "ok"
```

---

### Data Loss / Need Restore

**Symptoms**:
- Audits missing from database
- Data corruption suspected
- Need to roll back to previous state

**Fix - Restore from R2**:
```bash
# List available backups
npx wrangler r2 object list geodude-backups --prefix backups/

# Test restore locally FIRST (safe)
./scripts/restore-from-r2.sh 2025-01-09 --local

# Verify local restore worked
npx wrangler d1 execute optiview_db --local --command "SELECT COUNT(*) FROM audits"

# If good, restore to production (DANGEROUS)
./scripts/restore-from-r2.sh 2025-01-09 --remote
# Type "RESTORE" to confirm
```

**Timeline**: 
- Local restore: 1-2 minutes
- Production restore: 2-5 minutes (depends on data size)

**Warning**: Production restore will overwrite current data!

---

### Backup Missing

**Symptoms**:
- No backup files in R2 for today
- Expected 4 files after 03:00 UTC
- Cron may have failed

**Diagnose**:
```bash
# Check if cron is configured
cd packages/api-worker
grep -A5 "triggers" wrangler.toml
# Should show: crons = ["0 6 * * 1", "0 3 * * *"]

# Check worker logs for backup failures
npx wrangler tail geodude-api --format=json | jq -r 'select(.out | contains("backup"))'
```

**Fix - Manual Backup**:
```bash
# Option 1: SQL dump
npx wrangler d1 export optiview_db --remote --output=manual_backup_$(date +%F).sql

# Option 2: Trigger backup manually (if scheduled handler exists)
# You'll need to invoke the scheduled handler manually or wait for next cron
```

**Prevent**:
- Add alerting for missing backups (see "Nice-to-Haves" below)
- Monitor R2 bucket daily for first week

---

### Brave API Down

**Symptoms**:
- Citations tab shows empty state
- Logs show "Brave search failed: 503"
- `/v1/citations/budget` still working

**Fix**: **No action needed!**

This is expected graceful degradation:
- Citations endpoint returns `[]` (empty array)
- UI shows "No citations found" message
- Audits still complete successfully
- Service recovers automatically when Brave API is back

**Verify graceful handling**:
```bash
# Check that audits still work
curl -s -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: YOUR_KEY" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}' | jq '.status'
# Should show: "completed" (not "failed")
```

---

### Status Page Not Updating

**Symptoms**:
- Status page shows stale data
- Timestamp not recent
- Page appears frozen

**Fix**:
```bash
# 1. Hard refresh browser
# Mac: Cmd+Shift+R
# Windows: Ctrl+F5

# 2. Check API directly
curl -s https://api.optiview.ai/status | jq

# 3. If API is fine but page frozen, redeploy
cd apps/web
npx wrangler pages deploy . --project-name=geodude --commit-dirty=true --branch=main
```

**Note**: Status page auto-refreshes every 30 seconds. If it's truly stuck, check browser console for JavaScript errors.

---

## 🔧 Routine Maintenance

### Weekly Checklist (Mondays, 5 minutes)

```bash
# 1. Check weekly audit ran (06:00 UTC)
curl -s https://api.optiview.ai/status | jq '.latest_audit'

# 2. Verify budget reset
curl -s https://api.optiview.ai/v1/citations/budget | jq

# 3. Check Sunday backup (03:00 UTC)
npx wrangler r2 object list geodude-backups --prefix backups/$(date -u -d 'yesterday' +%F)/

# 4. Review 7-day metrics
curl -s -u ops:PASSWORD https://api.optiview.ai/v1/admin/metrics | jq

# 5. CI green?
open https://github.com/zerotype19/geodude/actions
```

---

### Monthly Checklist (First Monday, 15 minutes)

```bash
# 1. Review R2 storage usage
npx wrangler r2 bucket list | grep geodude-backups

# 2. Check total backups (should be ~30 folders)
npx wrangler r2 object list geodude-backups --prefix backups/ | wc -l

# 3. Test restore process (local)
./scripts/restore-from-r2.sh $(date -u -d '7 days ago' +%F) --local

# 4. Review budget trends
# If consistently hitting 80%+ daily, consider increasing

# 5. Update secrets if needed
cd packages/api-worker
npx wrangler secret list
```

---

### Secret Rotation (Every 90 Days)

```bash
cd packages/api-worker

# Rotate admin auth
echo "ops:NEW_STRONG_PASSWORD" | npx wrangler secret put ADMIN_BASIC_AUTH

# Rotate Brave API key (if needed)
echo "NEW_BRAVE_KEY" | npx wrangler secret put BRAVE_SEARCH

# Rotate Resend key (if needed)
echo "NEW_RESEND_KEY" | npx wrangler secret put RESEND_KEY

# Deploy immediately
pnpm deploy

# Verify
curl -s -u ops:NEW_PASSWORD https://api.optiview.ai/v1/admin/metrics | jq
```

---

## 🎯 Performance Optimization

### Check Cache Hit Rate

```bash
# Tail logs and count cache hits vs API calls
npx wrangler tail geodude-api --format=json | \
  jq -r 'select(.out).out' | \
  grep -E "cache hit|API call" | \
  uniq -c

# Goal: > 80% cache hits after warmup
```

### Identify Slow Queries

```bash
# Monitor response times
npx wrangler tail geodude-api --format=json | \
  jq -r 'select(.out | contains("audit complete")).out'

# Look for: "audit complete" logs with timestamps
# Goal: < 15 seconds per audit
```

### Optimize Budget Usage

```bash
# Find which domains consume most citations
curl -s -u ops:PASSWORD https://api.optiview.ai/v1/admin/metrics | \
  jq '.domains_7d'

# If one domain dominates, consider per-project budgets
```

---

## 📊 Monitoring Commands

### Real-Time Health

```bash
# Watch status (refreshes every 5 min)
watch -n 300 'curl -s https://api.optiview.ai/status | jq'

# Follow logs live
npx wrangler tail geodude-api --format=json | jq -r 'select(.out).out'

# Filter errors only
npx wrangler tail geodude-api --format=json | jq -r 'select(.level=="error")'
```

### Historical Analysis

```bash
# 7-day metrics
curl -s -u ops:PASSWORD https://api.optiview.ai/v1/admin/metrics | jq

# List recent audits
npx wrangler d1 execute optiview_db --remote \
  --command "SELECT id, property_id, status, created_at FROM audits ORDER BY created_at DESC LIMIT 10"

# Check backup history
npx wrangler r2 object list geodude-backups --prefix backups/ | tail -20
```

---

## 🚀 Deployment Playbook

### Deploy API Worker

```bash
cd packages/api-worker

# 1. Run tests (if available)
pnpm test || true

# 2. Build
pnpm build

# 3. Deploy
pnpm deploy

# 4. Verify
curl -s https://api.optiview.ai/status | jq
```

### Deploy Dashboard App

```bash
cd apps/app

# 1. Build
pnpm build

# 2. Deploy
npx wrangler pages deploy dist \
  --project-name=geodude-app \
  --commit-dirty=true \
  --branch=main

# 3. Verify
open https://app.optiview.ai
```

### Apply D1 Migration

```bash
# 1. Test locally first
npx wrangler d1 migrations apply optiview_db --local

# 2. Verify schema
npx wrangler d1 execute optiview_db --local \
  --command "SELECT name FROM sqlite_master WHERE type='table'"

# 3. Apply to production
npx wrangler d1 migrations apply optiview_db --remote

# 4. Verify production
npx wrangler d1 execute optiview_db --remote \
  --command "SELECT COUNT(*) FROM audits"
```

---

## 🎁 Nice-to-Have Enhancements

### 1. Footer Status Link

```html
<!-- In apps/web/index.html -->
<footer>
  <a href="/status.html" rel="nofollow">System Status</a>
</footer>
```

### 2. Send Sample Report Button

```typescript
// In dashboard UI
async function sendSampleReport(auditId: string) {
  await fetch(`https://api.optiview.ai/v1/audits/${auditId}/email`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey }
  });
  alert('Report sent!');
}
```

### 3. Per-Project Budgets

```typescript
// In packages/api-worker/src/index.ts
async function checkProjectBudget(env: Env, projectId: string): Promise<boolean> {
  const key = `citations_budget:${projectId}:${date}`;
  const used = await env.RATE_LIMIT_KV.get(key) || '0';
  return parseInt(used) < 50; // 50 per project per day
}
```

### 4. Mini Admin View

```typescript
// In apps/app/src/routes/Admin.tsx
export function Admin() {
  const [metrics, setMetrics] = useState(null);
  
  useEffect(() => {
    fetch('https://api.optiview.ai/v1/admin/metrics', {
      headers: { 'Authorization': 'Basic ' + btoa('ops:PASSWORD') }
    })
    .then(r => r.json())
    .then(setMetrics);
  }, []);
  
  return (
    <div>
      <h1>Admin Metrics</h1>
      <p>Audits (7d): {metrics?.audits_7d}</p>
      <p>Avg Score: {metrics?.avg_score_7d}</p>
      <p>Domains: {metrics?.domains_7d}</p>
    </div>
  );
}
```

---

## 📞 Escalation Matrix

### P0 - Critical (Fix Immediately)
- API completely down
- All audits failing
- Data loss confirmed

**Action**: Rollback immediately, restore from backup if needed

### P1 - High (Fix < 4 Hours)
- Citations completely broken
- Budget exceeded blocking users
- Backup failed

**Action**: Apply hotfix, monitor closely

### P2 - Medium (Fix < 24 Hours)
- Status page issues
- Slow performance
- Cache inefficiency

**Action**: Schedule fix, communicate to users

### P3 - Low (Fix When Possible)
- UI polish
- Documentation updates
- Feature requests

**Action**: Backlog for next sprint

---

## 🎓 Pro Tips

### Faster Debugging

```bash
# Create aliases in ~/.zshrc or ~/.bashrc
alias opti-status='curl -s https://api.optiview.ai/status | jq'
alias opti-budget='curl -s https://api.optiview.ai/v1/citations/budget | jq'
alias opti-logs='npx wrangler tail geodude-api --format=json | jq -r "select(.out).out"'
alias opti-metrics='curl -s -u ops:PASSWORD https://api.optiview.ai/v1/admin/metrics | jq'

# Then just run:
opti-status
opti-budget
```

### Local Testing

```bash
# Test API changes locally
cd packages/api-worker
npx wrangler dev
# Visit: http://localhost:8787

# Test app changes locally
cd apps/app
pnpm dev
# Visit: http://localhost:5173
```

### Quick Audit Test

```bash
# One-liner: start audit + copy share link
curl -s -X POST https://api.optiview.api/v1/audits/start \
  -H "x-api-key: YOUR_KEY" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}' | \
  jq -r '"https://app.optiview.ai/a/" + .id' | \
  tee /dev/tty | pbcopy  # Mac only (copies to clipboard)

echo "Share link copied to clipboard!"
```

---

**Last Updated**: 2025-01-09  
**Version**: v1.0.0-beta  
**Owner**: ops@optiview.ai

