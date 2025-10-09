# Operations Runbook

## Daily Health Checks

### Budget Monitoring
```bash
# Check citations budget
curl -s https://api.optiview.ai/v1/citations/budget | jq
```

**Expected**: `remaining` > 50, `used` < 150

**Alert if**: `remaining` < 20 or `used` > 180

**Action**: Increase `CITATIONS_DAILY_BUDGET` in wrangler.toml if needed

---

### System Status
```bash
# Overall health
curl -s https://api.optiview.ai/status | jq
```

**Expected**: 
- `status: "ok"`
- `latest_audit.completed_at` within last 7 days
- `citations_budget.remaining` > 50

**Alert if**: 
- `status != "ok"`
- No recent audits (indicates cron failure)
- Budget exhausted

---

### Admin Metrics (Weekly)
```bash
# Get 7-day metrics (requires auth)
curl -s -u user:pass https://api.optiview.ai/v1/admin/metrics | jq
```

**Expected**:
- `audits_7d` > 0
- `avg_score_7d` between 0.6-1.0
- `domains_7d` matches active properties

**Alert if**:
- `audits_7d` = 0 (cron failure)
- `avg_score_7d` < 0.5 (quality issue)

---

## Monitoring Logs

### Check for Errors
```bash
# Stream worker logs
npx wrangler tail --format=json | jq -r 'select(.out).out | select(test("error|ERROR|failed"))'
```

**Watch for**:
- `"brave search failed"` - API issues
- `"Citations daily budget exceeded"` - Budget limit hit
- `"Nightly backup failed"` - R2 or D1 issues
- `"Citations warming failed"` - Cache warming errors

---

### Cache Hit Rate
```bash
# Monitor cache performance
npx wrangler tail --format=json | jq -r 'select(.out).out | select(test("Brave (cache|API)"))'
```

**Healthy**: 80%+ "Brave cache hit" after first week

**Alert if**: <50% cache hits (indicates cache issues)

---

## Backup Verification

### Check R2 Backups
```bash
# List recent backups
npx wrangler r2 object list geodude-backups --prefix=backups/

# Download today's backup
npx wrangler r2 object get geodude-backups backups/$(date +%Y-%m-%d)/audits.jsonl
```

**Expected**: 4 files per day (audits, audit_pages, audit_issues, citations)

**Alert if**: Missing backups for >2 days

**Action**: Check cron logs, verify R2 binding

---

## Cron Jobs

### Schedule
- **03:00 UTC daily**: Nightly backup to R2
- **06:00 UTC Monday**: Weekly audits + cache warming

### Manual Trigger (Dev/Testing)
```bash
# Note: Cron triggers are automatic, no manual trigger via Wrangler
# For testing, deploy a temporary route that calls the backup/warm functions
```

---

## Troubleshooting

### Citations Not Appearing

**Symptoms**: `/v1/audits/:id/citations` returns `{items: []}`

**Diagnosis**:
```bash
# Check budget
curl -s https://api.optiview.ai/v1/citations/budget | jq .remaining

# Check logs for Brave errors
npx wrangler tail --format=json | jq -r 'select(.out).out | select(test("brave"))'
```

**Actions**:
1. Verify `BRAVE_SEARCH` secret is set
2. Check if budget exhausted (increase limit)
3. Review Brave API errors in logs
4. Verify domain has indexed pages

---

### Backup Failures

**Symptoms**: "Nightly backup failed" in logs

**Diagnosis**:
```bash
# Check R2 bucket exists
npx wrangler r2 bucket list | grep geodude-backups

# Check worker has R2 binding
npx wrangler deployments list geodude-api
```

**Actions**:
1. Verify R2 bucket `geodude-backups` exists
2. Check R2_BACKUPS binding in wrangler.toml
3. Review D1 query performance (timeout?)
4. Check R2 storage limits

---

### Cache Warming Failures

**Symptoms**: "Citations warming failed" in logs after Monday audits

**Diagnosis**:
```bash
# Check if domains exist
npx wrangler d1 execute optiview_db --remote \
  --command="SELECT COUNT(*) FROM properties WHERE verified=1"

# Check budget after warming
curl -s https://api.optiview.ai/v1/citations/budget | jq
```

**Actions**:
1. Verify properties have `verified=1`
2. Check if budget limit hit during warming
3. Review individual domain errors in logs
4. Increase budget if needed

---

### High Budget Usage

**Symptoms**: `used` approaching 200/day

**Diagnosis**:
```bash
# Check current usage
curl -s https://api.optiview.ai/v1/citations/budget | jq

# Check audit frequency
curl -s https://api.optiview.ai/v1/admin/metrics -u user:pass | jq .audits_7d
```

**Actions**:
1. Review audit frequency (manual vs cron)
2. Check if cache warming is too aggressive
3. Increase `CITATIONS_DAILY_BUDGET` in wrangler.toml
4. Consider upgrading Brave API tier

---

## Secrets Management

### Required Secrets
```bash
# List secrets
npx wrangler secret list --name geodude-api
```

**Expected**:
- `BRAVE_SEARCH` - Brave Search API key
- `RESEND_KEY` - Resend email API key
- `ADMIN_BASIC_AUTH` - Admin metrics auth (format: user:pass)

### Rotate Secret
```bash
# Update secret
echo "new_value" | npx wrangler secret put SECRET_NAME --name geodude-api

# Redeploy after rotation
npx wrangler deploy
```

---

## Rollback Procedures

### Brave API Down

**Symptom**: Multiple "brave search failed" errors

**Impact**: Citations return `[]` (graceful degradation)

**Action**: 
1. No immediate action needed (UI still works)
2. Monitor Brave status page
3. Consider temporary Bing fallback if extended outage

---

### Budget Exhausted

**Symptom**: "Citations daily budget exceeded" logs

**Impact**: No new citations until next day

**Temporary Fix**:
```bash
# Manually reset daily budget counter (emergency only)
TODAY=$(date +%Y-%m-%d)
npx wrangler kv key delete "citations_budget:$TODAY" \
  --namespace-id=29edf1f05bde42c09b7afa8e128b7066
```

**Permanent Fix**:
```toml
# In wrangler.toml
CITATIONS_DAILY_BUDGET = "400"  # Increase from 200
```

---

### Backup Missing

**Symptom**: No backups in R2 for 2+ days

**Emergency Recovery**:
```bash
# Manual backup (one-time)
# Create a temporary script to export tables:

npx wrangler d1 export optiview_db --remote --output=backup-$(date +%Y-%m-%d).sql

# Upload to R2
npx wrangler r2 object put geodude-backups emergency/backup-$(date +%Y-%m-%d).sql \
  --file=backup-$(date +%Y-%m-%d).sql
```

---

## Performance Tuning

### Optimize Cache Hit Rate

**Current**: ~90% after first audit per domain

**To improve**:
1. Increase cache TTL (currently 24h)
2. Pre-warm cache for new domains
3. Monitor cache size in D1

---

### Reduce API Calls

**Current**: 0-3 Brave calls per audit (cache dependent)

**To reduce**:
1. Increase cache warming coverage
2. Implement query deduplication
3. Consider shared cache across domains

---

## Alerts Configuration

### Recommended Alerts

1. **Budget Alert**: `remaining` < 20
2. **Status Alert**: `status != "ok"` for >5 minutes
3. **Backup Alert**: No new backups for >48 hours
4. **Audit Alert**: No audits for >8 days (cron failure)
5. **Error Alert**: >10 "failed" logs in 1 hour

### Alert Endpoints

- Status: `https://api.optiview.ai/status`
- Budget: `https://api.optiview.ai/v1/citations/budget`
- Metrics: `https://api.optiview.ai/v1/admin/metrics` (auth required)

---

## Contact & Escalation

### Cloudflare Issues
- Dashboard: https://dash.cloudflare.com
- Status: https://www.cloudflarestatus.com

### Brave Search Issues
- Dashboard: https://brave.com/search/api/
- Support: api-support@brave.com

### Resend Issues
- Dashboard: https://resend.com/dashboard
- Status: https://resend.com/status

