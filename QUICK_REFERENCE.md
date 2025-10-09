# 🚀 Optiview Quick Reference Card

## One-Command Launch Verification

```bash
./LAUNCH.sh
```

This automated script checks:
- ✅ API endpoints (/status, /v1/citations/budget)
- ✅ Fresh audit creation & citations
- ✅ R2 backups presence
- ✅ Status page accessibility
- ✅ Security headers (noindex)

**Exit 0** = All systems go! 🎉  
**Exit 1** = Review failures and fix

---

## Daily Health Check (30 seconds)

```bash
# One-liner status
curl -s https://api.optiview.ai/status | jq '{status, budget: .citations_budget, latest: .latest_audit.completed_at}'

# Expected output:
{
  "status": "ok",
  "budget": { "used": 5, "remaining": 195, "max": 200 },
  "latest": "2025-01-09T10:30:00Z"
}
```

**Green flags**:
- `status: "ok"`
- `remaining > 150`
- `latest` is recent (< 7 days)

**Red flags**:
- `status: "error"`
- `remaining < 20` → increase budget
- `latest` very old → check cron

---

## Emergency Rollback

### Restore from R2 backup

```bash
# List available backups
npx wrangler r2 object list geodude-backups --prefix backups/

# Restore to local D1 (safe testing)
./scripts/restore-from-r2.sh 2025-01-09 --local

# Restore to production (DANGEROUS!)
./scripts/restore-from-r2.sh 2025-01-09 --remote
```

### Quick worker rollback

```bash
# View recent deployments
npx wrangler deployments list

# Rollback API worker
cd packages/api-worker
npx wrangler rollback [deployment-id]

# Rollback app (Pages)
cd apps/app
npx wrangler pages deployment list --project-name geodude-app
```

---

## Monitoring Commands

### Real-time logs

```bash
# API worker logs (all events)
npx wrangler tail geodude-api --format=json | jq -r 'select(.out).out'

# Filter for errors only
npx wrangler tail geodude-api --format=json | jq -r 'select(.level=="error")'

# Filter for citations
npx wrangler tail geodude-api --format=json | jq -r 'select(.out | contains("Brave"))'
```

### Budget monitoring

```bash
# Current budget
curl -s https://api.optiview.ai/v1/citations/budget | jq

# Watch budget (refresh every 5 min)
watch -n 300 'curl -s https://api.optiview.ai/v1/citations/budget | jq'
```

### Admin metrics (requires auth)

```bash
# 7-day metrics
curl -s -u ops:PASSWORD https://api.optiview.ai/v1/admin/metrics | jq

# Expected:
{
  "audits_7d": 42,
  "avg_score_7d": "0.856",
  "domains_7d": 12,
  "timestamp": "2025-01-09T..."
}
```

---

## Common Fixes

### Budget exhausted (429 errors)

```bash
# Increase budget (edit wrangler.toml)
cd packages/api-worker
# Change: CITATIONS_DAILY_BUDGET = "400"
pnpm deploy

# Or increase via env var
echo "400" | npx wrangler secret put CITATIONS_DAILY_BUDGET
```

### Brave API down (citations empty)

**No action needed** - Citations return `[]` gracefully. UI shows "No citations found" (expected behavior).

### Backup missing

```bash
# Check cron is configured
cd packages/api-worker
grep -A5 "triggers" wrangler.toml
# Should show: crons = ["0 6 * * 1", "0 3 * * *"]

# Check worker logs for backup failures
npx wrangler tail geodude-api --format=json | jq -r 'select(.out | contains("backup"))'

# Manual backup trigger (test)
npx wrangler d1 export optiview_db --remote --output=manual_backup.sql
```

### Status page not updating

Status page auto-refreshes every 30 seconds. If frozen:
1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+F5` (Windows)
2. Check API `/status` directly: `curl -s https://api.optiview.ai/status`
3. Redeploy if needed: `cd apps/web && npx wrangler pages deploy . --project-name=geodude --commit-dirty=true`

---

## Performance Baselines (SLOs)

### Availability
- **Target**: 99.9% uptime
- **Check**: `curl -s https://api.optiview.ai/status` returns 200

### Latency (P95)
- **Cache hit**: < 50ms
- **Cache miss**: < 600ms
- **Check**: Browser DevTools Network tab or `curl -w "@curl-format.txt"`

### Citations Cache Hit Rate
- **Target**: > 80% after warmup
- **Check**: Logs for "Brave cache hit" vs "Brave API call"

### Budget Consumption
- **Target**: < 200/day (stay in free tier)
- **Alert threshold**: < 20 remaining
- **Check**: `/v1/citations/budget`

---

## Deployment Commands

### Deploy API worker

```bash
cd packages/api-worker
pnpm deploy

# With specific branch
git checkout -b hotfix/issue-name
# ... make changes ...
pnpm deploy
```

### Deploy dashboard app

```bash
cd apps/app
pnpm build
npx wrangler pages deploy dist --project-name=geodude-app --commit-dirty=true --branch=main
```

### Deploy marketing site (with status page)

```bash
cd apps/web
npx wrangler pages deploy . --project-name=geodude --commit-dirty=true --branch=main
```

### Apply D1 migrations

```bash
# Local first (testing)
npx wrangler d1 migrations apply optiview_db --local

# Then production
npx wrangler d1 migrations apply optiview_db --remote
```

---

## Secrets Management

### List all secrets

```bash
cd packages/api-worker
npx wrangler secret list
```

### Update secrets

```bash
# Admin auth
echo "ops:NEW_PASSWORD" | npx wrangler secret put ADMIN_BASIC_AUTH

# Brave Search API key
echo "YOUR_BRAVE_KEY" | npx wrangler secret put BRAVE_SEARCH

# Resend API key
echo "re_..." | npx wrangler secret put RESEND_KEY
```

### Rotate secrets

1. Generate new secret value
2. Update in Cloudflare: `npx wrangler secret put SECRET_NAME`
3. Redeploy immediately: `pnpm deploy`
4. Verify with smoke test

---

## Weekly Checklist (Mondays, 5 min)

```bash
# 1. Check audit ran (06:00 UTC)
curl -s https://api.optiview.ai/status | jq '.latest_audit'

# 2. Verify budget reset
curl -s https://api.optiview.ai/v1/citations/budget | jq

# 3. Check backup from Sunday (03:00 UTC)
npx wrangler r2 object list geodude-backups --prefix backups/$(date -u -d 'yesterday' +%F)/

# 4. Review metrics
curl -s -u ops:PASSWORD https://api.optiview.ai/v1/admin/metrics | jq

# 5. CI green?
open https://github.com/zerotype19/geodude/actions
```

---

## Useful Links

### Production
- **API**: https://api.optiview.ai
- **App**: https://app.optiview.ai
- **Status**: https://optiview.ai/status.html
- **Marketing**: https://optiview.ai

### Monitoring
- **Status**: https://api.optiview.ai/status
- **Budget**: https://api.optiview.ai/v1/citations/budget
- **Metrics**: https://api.optiview.ai/v1/admin/metrics (auth)

### Admin
- **Cloudflare**: https://dash.cloudflare.com
- **GitHub**: https://github.com/zerotype19/geodude
- **Actions**: https://github.com/zerotype19/geodude/actions
- **R2**: https://dash.cloudflare.com > R2 > geodude-backups

### External APIs
- **Brave**: https://brave.com/search/api/
- **Resend**: https://resend.com/dashboard

---

## Support Escalation

### Issue Categories

**P0 - Critical (fix now)**:
- API completely down
- All audits failing
- Data loss

**P1 - High (fix < 4 hours)**:
- Citations broken
- Budget exceeded
- Backup failures

**P2 - Medium (fix < 24 hours)**:
- Status page issues
- Slow performance
- Cache inefficiency

**P3 - Low (fix when possible)**:
- UI polish
- Documentation updates
- Nice-to-have features

### Escalation Path

1. **Check logs**: `npx wrangler tail geodude-api`
2. **Check status**: `curl https://api.optiview.ai/status`
3. **Check Cloudflare**: https://www.cloudflarestatus.com
4. **Check external APIs**: Brave/Resend status pages
5. **Rollback if needed**: See "Emergency Rollback" above
6. **Open incident**: Document in GitHub Issues

---

## Pro Tips

### Faster debugging

```bash
# Create alias for common commands
alias opti-status='curl -s https://api.optiview.ai/status | jq'
alias opti-budget='curl -s https://api.optiview.ai/v1/citations/budget | jq'
alias opti-logs='npx wrangler tail geodude-api --format=json | jq -r "select(.out).out"'

# Add to ~/.zshrc or ~/.bashrc
```

### Local testing

```bash
# Test API locally
cd packages/api-worker
npx wrangler dev

# Test app locally
cd apps/app
pnpm dev
# Visit: http://localhost:5173
```

### Quick audit test

```bash
# One-liner: start audit + get share link
curl -s -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}' | jq -r '"https://app.optiview.ai/a/" + .id'
```

---

**📖 Full Documentation**: See `GO_LIVE_CHECKLIST.md`, `SETUP_COMPLETE.md`, and `docs/` folder.

**🚨 Emergency?** Run `./LAUNCH.sh` first to diagnose, then see "Emergency Rollback" section.

**💬 Questions?** Check `docs/ops-runbook.md` or GitHub Issues.

