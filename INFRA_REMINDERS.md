# Infrastructure Reminders

**Pre-Production Checklist**

---

## 🔑 Rotate Demo API Key

Current key `dev_key` is for development only. Rotate to production ULID:

```bash
# Generate new production key
NEW_KEY="prj_live_$(openssl rand -hex 12)"
echo "New API key: $NEW_KEY"

# Update D1
wrangler d1 execute optiview_db --remote \
  --command "UPDATE projects SET api_key='$NEW_KEY' WHERE id='prj_demo';"

# Verify
wrangler d1 execute optiview_db --remote \
  --command "SELECT id, api_key FROM projects WHERE id='prj_demo';"
```

**Action Items**:
- [ ] Generate new key (save to password manager)
- [ ] Update D1 database
- [ ] Test with new key
- [ ] Invalidate `dev_key`

---

## 📊 Rate Limit Configuration

Verify rate limit environment variables in `geodude-api`:

```bash
# Check current config
grep -A 3 "\[vars\]" packages/api-worker/wrangler.toml

# Should show:
# AUDIT_DAILY_LIMIT = "10"
```

**Current Settings**:
- ✅ `AUDIT_DAILY_LIMIT=10` (configured)
- ✅ `RATE_LIMIT_KV` binding exists (id: 29edf1f05bde42c09b7afa8e128b7066)

**Action Items**:
- [ ] Confirm 10/day is appropriate
- [ ] Optional: Increase for beta users if needed
- [ ] Monitor KV usage via Cloudflare dashboard

---

## ⏰ Cron Schedule Confirmation

Verify cron triggers in API worker:

```bash
# Check wrangler.toml
grep -A 1 "\[triggers\]" packages/api-worker/wrangler.toml

# Should show:
# [triggers]
# crons = ["0 6 * * 1"]
```

**Schedule**: Mondays at 6:00 AM UTC

**Action Items**:
- [ ] Confirm schedule in Cloudflare dashboard
- [ ] Bookmark cron logs URL
- [ ] Set reminder to check first Monday execution
- [ ] Monitor for errors in logs

**View Logs**:
```bash
wrangler tail geodude-api --format=pretty
```

---

## 🌐 Collector DNS

Add CNAME record for collector subdomain:

```bash
# Cloudflare DNS Setup:
# Type: CNAME
# Name: collector
# Target: geodude-collector.kevin-mcgovern.workers.dev
# Proxy: ON (orange cloud)
```

**Action Items**:
- [ ] Add CNAME in Cloudflare dashboard
- [ ] Wait for DNS propagation (5-10 min)
- [ ] Test: `curl -I https://collector.optiview.ai/px?prop_id=prop_demo`
- [ ] Verify: Should return 200 with `content-type: image/gif`

**Test Command**:
```bash
curl -I "https://collector.optiview.ai/px?prop_id=prop_demo&u=https://optiview.ai"
```

---

## 📱 Dashboard DNS (Optional - for M8)

If deploying dashboard to app.optiview.ai:

```bash
# Cloudflare Pages Setup:
# 1. Create Pages project for apps/app
# 2. Build output: apps/app/dist
# 3. Custom domain: app.optiview.ai
```

**Action Items** (when deploying M8):
- [ ] Create Cloudflare Pages project
- [ ] Configure build settings (output: `apps/app/dist`)
- [ ] Add custom domain: app.optiview.ai
- [ ] Test: `curl -I https://app.optiview.ai/`

---

## 🔒 Security Verification

### API Key Rotation Checklist
- [ ] New key generated (ULID format: `prj_live_XXXXXXXXXXXX`)
- [ ] Stored in password manager
- [ ] D1 updated
- [ ] Old `dev_key` invalidated
- [ ] New key tested successfully

### Rate Limiting Checklist
- [ ] KV namespace bound correctly
- [ ] Daily limit configured (10/day)
- [ ] 429 responses working
- [ ] X-RateLimit headers present

### Cron Checklist
- [ ] Schedule verified (0 6 * * 1)
- [ ] Handler function deployed
- [ ] First execution monitored
- [ ] Error handling tested

### DNS Checklist
- [ ] collector.optiview.ai → CNAME configured
- [ ] Proxy enabled (orange cloud)
- [ ] HTTPS working
- [ ] 1x1 GIF response verified

---

## 🧪 Mini Test Plan (Sign-off Before M8)

### 1. QA Block Passes ✅
```bash
# Run full QA suite
curl -sI https://optiview.ai/ | sed -n '1p;/content-type/p'
curl -s https://api.optiview.ai/health
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.optiview.ai/v1/audits/start
curl -sI "https://collector.optiview.ai/px?prop_id=prop_demo"
grep -n "crons" packages/api-worker/wrangler.toml
```

**Expected**:
- Pages: 200 ✅
- API health: ok ✅
- No auth: 401 ✅
- Collector: 200 gif ✅
- Cron: schedule found ✅

### 2. Fixture Saved ✅
```bash
# Verify fixture
jq -e '.score_overall' tools/samples/audit-optiview.json
jq -e '.pages[0].url' tools/samples/audit-optiview.json
jq -e '.issues' tools/samples/audit-optiview.json
```

**Expected**:
- scores ✅
- pages ✅
- issues ✅

### 3. Self-Audit Clean ✅
```bash
# Run with new API key
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "content-type: application/json" \
  -H "x-api-key: $NEW_API_KEY" \
  -d '{"property_id":"prop_demo"}' | jq
```

**Verify**:
- [ ] No High/Critical issues on optiview.ai
- [ ] All docs pages (/, /docs/audit.html, /docs/bots.html, /docs/security.html)
- [ ] Score ≥ 0.95
- [ ] FAQ schema detected

---

## 📋 Quick Commands Reference

### Generate Production API Key
```bash
openssl rand -hex 12 | awk '{print "prj_live_" $1}'
```

### Update API Key in D1
```bash
NEW_KEY="prj_live_XXXXXXXXXXXX"
wrangler d1 execute optiview_db --remote \
  --command "UPDATE projects SET api_key='$NEW_KEY' WHERE id='prj_demo';"
```

### Test New API Key
```bash
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "content-type: application/json" \
  -H "x-api-key: $NEW_KEY" \
  -d '{"property_id":"prop_demo"}'
```

### View Cron Logs
```bash
wrangler tail geodude-api --format=pretty
```

### Check Rate Limit KV
```bash
wrangler kv:key list --namespace-id=29edf1f05bde42c09b7afa8e128b7066
```

### Clear Rate Limit (for testing)
```bash
TODAY=$(date +%Y-%m-%d)
wrangler kv:key delete "rl:prj_demo:$TODAY" --namespace-id=29edf1f05bde42c09b7afa8e128b7066
```

---

**Status**: Pre-production checklist ready  
**Next**: Complete items above before M8 deployment

