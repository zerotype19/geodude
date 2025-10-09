# 🔧 Infrastructure Status - v0.10.0

**Last Updated**: 2025-10-09  
**Branch**: v0.10.0-dashboard

---

## ✅ Wrangler Identity

```
Logged In: kevin.mcgovern@gmail.com
Permissions: account (read)
```

---

## ✅ Cloudflare Bindings Confirmed

### KV Namespace
```
Name: geodude-api-RATE_LIMIT_KV
ID: 29edf1f05bde42c09b7afa8e128b7066
Status: ✅ Active
Binding: RATE_LIMIT_KV (in wrangler.toml)
```

### D1 Database
```
Name: optiview_db
ID: 975fb94d-9fac-4fd9-b8e2-41444f488334
Created: 2025-08-13
Status: ✅ Active
Size: 131072 bytes
Binding: DB (in wrangler.toml)
```

### Workers
```
✅ geodude-api (api.optiview.ai)
   - Route: api.optiview.ai/*
   - D1: optiview_db
   - KV: RATE_LIMIT_KV
   - Cron: 0 6 * * 1 (Mondays 6am UTC)

✅ geodude-collector (collector.optiview.ai - PENDING DNS)
   - Route: collector.optiview.ai/* (needs DNS)
   - D1: optiview_db
```

### Pages
```
✅ geodude (www.optiview.ai)
   - Source: apps/web/public
   - Build: static
   - Status: Live

⚠️ geodude-app (app.optiview.ai - PENDING)
   - Source: apps/app
   - Build: pnpm build
   - Output: apps/app/dist
   - Status: Needs DNS + deployment
```

---

## ⚙️ Environment Variables

### geodude-api (packages/api-worker/wrangler.toml)
```toml
[vars]
USER_AGENT = "OptiviewAuditBot/1.0 (+https://www.optiview.ai)"
AUDIT_MAX_PAGES = "30"
AUDIT_DAILY_LIMIT = "10"
HASH_SALT = "change_me"  # ⚠️ Should rotate to unique value
```

### geodude-collector (packages/collector-worker/wrangler.toml)
```toml
[vars]
HASH_SALT = "change_me"  # ⚠️ Should rotate to unique value
```

### geodude-app (Cloudflare Pages env)
```
VITE_API_BASE = "https://api.optiview.ai"  # ⚠️ Needs to be set in Pages
```

---

## ⏰ Cron Triggers

### geodude-api
```toml
[triggers]
crons = ["0 6 * * 1"]  # Mondays 6am UTC
```

**Handler**: `async scheduled()` in `packages/api-worker/src/index.ts`  
**Action**: Re-audits all verified properties (1 RPS throttle)  
**Next Run**: Monday 2025-10-13 06:00:00 UTC

---

## 🌐 DNS Configuration

### Current (Active)
```
✅ optiview.ai → Pages (geodude)
✅ www.optiview.ai → Pages (geodude)
✅ api.optiview.ai → Worker (geodude-api)
```

### Pending (v0.10.0)
```
⚠️ collector.optiview.ai
   Type: CNAME
   Target: geodude-collector.kevin-mcgovern.workers.dev
   Proxy: ON (orange cloud)
   Status: NEEDS CONFIGURATION

⚠️ app.optiview.ai
   Type: CNAME
   Target: geodude-app.pages.dev (or assigned Pages domain)
   Proxy: ON (orange cloud)
   Status: NEEDS CONFIGURATION
```

---

## 🔐 Secrets & Keys

### Production API Key
```
Key: prj_live_8c5e1556810d52f8d5e8b179
Stored: Password manager
Updated: 2025-10-09
Project: prj_demo
Status: ✅ Active
```

### HASH_SALT (Needs Rotation)
```
Current: "change_me"
Status: ⚠️ Insecure (default value)
Action Required: Rotate to unique value

Recommended:
HASH_SALT = "prod_salt_$(openssl rand -hex 16)"
```

**Commands to Rotate**:
```bash
# Generate new salt
NEW_SALT="prod_salt_$(openssl rand -hex 16)"

# Update geodude-api
sed -i '' "s/HASH_SALT = \"change_me\"/HASH_SALT = \"$NEW_SALT\"/" \
  packages/api-worker/wrangler.toml

# Update geodude-collector
sed -i '' "s/HASH_SALT = \"change_me\"/HASH_SALT = \"$NEW_SALT\"/" \
  packages/collector-worker/wrangler.toml

# Redeploy
pnpm deploy:api
pnpm deploy:collector
```

---

## 🧪 Smoke Tests

### API Worker (geodude-api)
```bash
# Health check
curl https://api.optiview.ai/health
# Expected: ok

# Legacy endpoint (410 Gone)
curl -I https://api.optiview.ai/v1/tag.js
# Expected: HTTP/2 410

# Start audit (requires key)
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}'
# Expected: {"id":"aud_xxx","status":"completed","score_overall":0.99}

# Get audit (public)
curl https://api.optiview.ai/v1/audits/aud_xxx
# Expected: Full audit JSON
```

### Collector Worker (geodude-collector)
```bash
# PENDING DNS - Run after CNAME configured
curl -I "https://collector.optiview.ai/px?prop_id=prop_demo"
# Expected: HTTP/2 200, content-type: image/gif
```

### Pages (geodude)
```bash
# Homepage
curl -I https://optiview.ai/
# Expected: HTTP/2 200

# Robots
curl https://optiview.ai/robots.txt
# Expected: Sitemap + bot allow rules

# Sitemap
curl https://optiview.ai/sitemap.xml
# Expected: XML with 4 URLs

# Docs
curl -I https://optiview.ai/docs/audit.html
# Expected: HTTP/2 200
```

---

## 📊 Current Metrics

### Audits
```sql
-- Total audits
SELECT COUNT(*) FROM audits;
-- Result: ~15-20 (from testing)

-- Average score
SELECT AVG(score_overall) FROM audits WHERE status='completed';
-- Result: ~0.99

-- Last cron run
SELECT MAX(started_at) FROM audits WHERE status='completed';
-- Result: TBD (first run Monday)
```

### Hits (Bot Tracking)
```sql
-- Total hits
SELECT COUNT(*) FROM hits;
-- Result: ~10-15 (from testing)

-- Bot breakdown
SELECT bot_type, COUNT(*) FROM hits GROUP BY bot_type;
-- Result: GPTBot, curl, etc.
```

### Rate Limits
```bash
# Check current day's count for prj_demo
npx wrangler kv key get "rl:prj_demo:2025-10-09" \
  --namespace-id=29edf1f05bde42c09b7afa8e128b7066
# Result: Current count (max 10/day)
```

---

## 🚨 Action Items (v0.10.0)

### Critical (Before M8)
- [ ] Configure collector DNS CNAME
- [ ] Configure app DNS CNAME
- [ ] Rotate HASH_SALT to unique value
- [ ] Set VITE_API_BASE in Pages env

### Important (Security)
- [ ] Rotate HASH_SALT (both workers)
- [ ] Verify CSP headers on Pages
- [ ] Tighten CORS to allowed origins only
- [ ] Enable Logpush (optional)

### Nice to Have (Monitoring)
- [ ] Add /status endpoint to API
- [ ] Set up weekly hits rollup cron
- [ ] Create Cloudflare dashboard for metrics

---

## 📝 Deployment Commands

### Deploy API Worker
```bash
cd packages/api-worker
npx wrangler deploy
```

### Deploy Collector Worker
```bash
cd packages/collector-worker
npx wrangler deploy
```

### Deploy Pages (geodude)
```bash
# Triggered by git push to main
git push origin main
```

### Deploy Dashboard (geodude-app - PENDING)
```bash
cd apps/app
pnpm build
npx wrangler pages deploy dist --project-name=geodude-app
```

---

## 🔗 Quick Links

- **Dashboard**: https://app.optiview.ai (pending)
- **API**: https://api.optiview.ai
- **Collector**: https://collector.optiview.ai (pending DNS)
- **Docs**: https://optiview.ai/docs/
- **GitHub**: https://github.com/zerotype19/geodude
- **Cloudflare**: https://dash.cloudflare.com

---

**Status**: Infrastructure confirmed, DNS pending for v0.10.0 sprint 🚀

