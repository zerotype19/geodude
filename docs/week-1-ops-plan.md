# Week 1 Operations Plan

## Daily Checks (1-2 minutes)

### Morning Health Check
```bash
# Quick status check
curl -s https://api.optiview.ai/status | jq '{status, latest_audit, budget: .citations_budget}'
```

**Expected**:
- `status: "ok"`
- `latest_audit.completed_at` within last 7 days
- `budget.remaining > 0`

**Actions if not OK**:
- Status != "ok": Check worker logs (`npx wrangler tail`)
- No recent audits: Verify cron is running (Cloudflare Dashboard)
- Budget = 0: Increase `CITATIONS_DAILY_BUDGET` and redeploy

---

### Budget Monitoring
```bash
# Check daily budget
curl -s https://api.optiview.ai/v1/citations/budget | jq
```

**Thresholds**:
- 🟢 **Green**: `remaining > 50` (normal)
- 🟡 **Yellow**: `remaining < 50` (monitor)
- 🔴 **Red**: `remaining < 20` (increase budget)

**Quick Fix**:
```toml
# packages/api-worker/wrangler.toml
CITATIONS_DAILY_BUDGET = "400"  # Double from 200
```

Then: `pnpm -C packages/api-worker deploy`

---

## Monday (After Cron - 5 minutes)

### 1. Verify Weekly Audits Ran
```bash
# Check latest audit
curl -s https://api.optiview.ai/status | jq '.latest_audit'
```

**Expected**: `completed_at` should be this morning (after 06:00 UTC)

---

### 2. Verify R2 Backup
```bash
# List today's backup files
npx wrangler r2 object list geodude-backups --prefix backups/$(date -u +%F)/
```

**Expected**: 4 files (audits.jsonl, audit_pages.jsonl, audit_issues.jsonl, citations.jsonl)

**If missing**:
1. Check cron logs: `npx wrangler tail --format=json | grep -i backup`
2. Verify R2 binding in wrangler.toml
3. Check worker deployment status

---

### 3. Verify Cache Warming
```bash
# Open a recent share link
# Example: https://app.optiview.ai/a/aud_XXXXX
```

**Test**:
1. Open Citations tab
2. Should load instantly (~10ms, not ~500ms)
3. Citations should be populated from cache

**If slow**:
- Check logs for "Warming citations cache" message
- Verify cache warming ran after audits
- Check D1 citations_cache table

---

## Alerts to Watch

### Worker Logs (Daily)
```bash
# Stream and filter for issues
npx wrangler tail --format=json | jq -r 'select(.out).out | select(test("error|ERROR|failed"))'
```

**Watch for**:
1. `"brave search failed"` - Brave API issues
2. `"Citations daily budget exceeded"` - Budget limit hit
3. `"Nightly backup failed"` - R2 or D1 issues
4. `"Citations warming failed"` - Cache warming errors

---

### Budget Alerts
**Setup**: Check budget every 6 hours

```bash
# Cron job or monitoring service
*/360 * * * * curl -s https://api.optiview.ai/v1/citations/budget | jq -e '.remaining < 20'
```

**Alert if**: `remaining < 20` (send notification)

---

### Backup Alerts
**Setup**: Check R2 backups daily

```bash
# Verify yesterday's backup exists
npx wrangler r2 object list geodude-backups --prefix backups/$(date -u -d yesterday +%F)/ | grep -q audits.jsonl
```

**Alert if**: No backups for 48+ hours

---

## Quick Incident Runbook

### Scenario 1: Citations Empty + Budget Exhausted

**Symptoms**:
- Citations tab shows "No citations yet"
- Budget endpoint shows `remaining: 0`

**Fix**:
```bash
# Option A: Increase budget (permanent)
# Edit packages/api-worker/wrangler.toml
CITATIONS_DAILY_BUDGET = "400"
pnpm -C packages/api-worker deploy

# Option B: Reset counter (emergency, one-time)
TODAY=$(date +%Y-%m-%d)
npx wrangler kv key delete "citations_budget:$TODAY" \
  --namespace-id=29edf1f05bde42c09b7afa8e128b7066
```

---

### Scenario 2: Brave API Down

**Symptoms**:
- Logs show repeated "brave search failed"
- Citations return empty array

**Impact**: 
- UI still works (graceful degradation)
- Citations tab shows "No citations yet"

**Actions**:
1. No immediate action needed (system is designed for this)
2. Monitor Brave Search status page
3. Consider implementing mock fallback if extended outage:
   ```ts
   // In citations-brave.ts
   if (!response.ok) {
     console.error('brave search failed', response.status);
     // Optional: return mock citations for testing
     return [];
   }
   ```

---

### Scenario 3: Restore from R2 Backup

**Use Case**: Accidental data deletion or corruption

**Steps**:

1. **List available backups**:
   ```bash
   npx wrangler r2 object list geodude-backups --prefix backups/
   ```

2. **Download backup**:
   ```bash
   npx wrangler r2 object get geodude-backups \
     backups/2025-10-09/audits.jsonl > restore_audits.jsonl
   ```

3. **Restore to D1** (manual process):
   ```bash
   # Convert JSONL to SQL INSERT statements
   cat restore_audits.jsonl | while read -r line; do
     # Parse JSON and create INSERT statement
     # This is table-specific - adjust for your schema
     echo "INSERT INTO audits (...) VALUES (...);"
   done | npx wrangler d1 execute optiview_db --remote
   ```

**Note**: Full restore script can be created as needed

---

## Performance Monitoring

### Cache Hit Rate (Weekly)
```bash
# Monitor for 1 minute and count cache hits
npx wrangler tail --format=json | \
  jq -r 'select(.out).out | select(test("Brave (cache hit|API call)"))' | \
  grep -c "cache hit"
```

**Expected**: 80%+ cache hits after week 1

**If low**:
- Verify cache TTL is 24 hours
- Check if domains are changing frequently
- Review cache warming coverage

---

### Audit Frequency
```bash
# Get metrics (requires auth)
curl -s -u ops:PASSWORD https://api.optiview.ai/v1/admin/metrics | jq
```

**Metrics**:
- `audits_7d`: Total audits in last 7 days
- `avg_score_7d`: Average audit score
- `domains_7d`: Unique domains audited

**Expected Week 1**:
- `audits_7d`: 7-10 (weekly cron + manual tests)
- `avg_score_7d`: 0.6-1.0
- `domains_7d`: 1-3 (based on verified properties)

---

## Roadmap Nibbles (Fast Wins)

### 1. Status Dashboard (30 min)
- ✅ Created: `apps/web/status.html`
- Deploy to Pages
- Link from marketing site
- Auto-refreshes every 30s

### 2. Email Reports Button (45 min)
**Goal**: Add "Send Report" button to dashboard

```tsx
// In Dashboard.tsx
async function sendReport(auditId: string) {
  await fetch(`/v1/audits/${auditId}/email`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey }
  });
  alert('Report sent!');
}
```

### 3. Per-Project Budget (1 hour)
**Goal**: Prevent one noisy tenant from exhausting daily budget

```ts
// In checkCitationsBudget()
const key = `citations_budget:${projectId}:${today}`; // Add project_id
const projectBudget = 50; // Per-project limit
```

---

## Final Sanity Checklist

Before considering Week 1 complete, verify:

- [ ] `ADMIN_BASIC_AUTH` secret is set
- [ ] `/status` returns `status: "ok"`
- [ ] `/v1/citations/budget` returns valid JSON
- [ ] `/v1/admin/metrics` works with auth
- [ ] R2 objects exist under `backups/<today>/`
- [ ] CI is green with citations + status smoke tests
- [ ] Fresh audit share link loads with Citations tab
- [ ] `apps/web/status.html` deployed and accessible
- [ ] Team knows how to check daily status
- [ ] Alerts are configured (manual or automated)

---

## Success Metrics (End of Week 1)

**Availability**:
- [ ] 99%+ uptime on `/status` endpoint
- [ ] All cron jobs executed successfully

**Performance**:
- [ ] 80%+ citation cache hit rate
- [ ] <5s average audit completion time
- [ ] <100ms P95 API response time

**Reliability**:
- [ ] 7/7 nightly backups successful
- [ ] 0 budget exhaustion incidents
- [ ] All smoke tests passing

---

## Next Steps (Week 2+)

1. **Automated Alerts**: Set up Slack/Discord webhooks for:
   - Budget < 20 remaining
   - Backup failures
   - Status != "ok" for 5+ minutes

2. **Admin Dashboard**: Build `/admin` route in SPA:
   - Display metrics with charts
   - Show budget trends
   - Link to recent audits

3. **Email Improvements**:
   - Auto-populate `owner_email` from onboarding
   - Add "Send Report" button to dashboard
   - Weekly digest emails

4. **Monitoring Upgrades**:
   - Prometheus metrics export
   - Grafana dashboards
   - Better log aggregation

---

## Support & Escalation

### Cloudflare Issues
- Dashboard: https://dash.cloudflare.com
- Status: https://www.cloudflarestatus.com
- Support: Cloudflare support ticket

### Brave Search Issues
- Dashboard: https://brave.com/search/api/
- Support: api-support@brave.com
- Docs: https://brave.com/search/api/docs

### Resend Issues
- Dashboard: https://resend.com/dashboard
- Status: https://resend.com/status
- Support: support@resend.com

---

**Week 1 Goal**: Establish operational rhythm and catch any issues early! 🎯

