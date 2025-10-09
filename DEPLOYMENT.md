# Deployment Guide

## ✅ Completed Setup

### Prompts 1-5 Complete

- ✅ Monorepo scaffold with pnpm + turbo
- ✅ Marketing site (apps/web)
- ✅ D1 migrations created
- ✅ API Worker (packages/api-worker)
- ✅ Collector Worker (packages/collector-worker)
- ✅ All dependencies installed

## 🚀 Deployment Steps

### 1. Apply D1 Migrations

```bash
# Local (for development)
pnpm migrate:local

# Production
pnpm migrate
```

### 2. Deploy Workers

```bash
# Deploy API Worker
pnpm -C packages/api-worker deploy

# Deploy Collector Worker
pnpm -C packages/collector-worker deploy
```

### 3. Configure Cloudflare DNS

Point these domains to their respective workers:

- `api.optiview.ai` → Worker: `geodude-api`
- `collector.optiview.ai` → Worker: `geodude-collector`

### 4. Configure Cloudflare Pages

- Project: `geodude`
- Build output directory: `/apps/web/public`
- Point `www.optiview.ai` to this Pages project

## 🧪 Testing

### Marketing Site
```bash
curl https://www.optiview.ai/
curl https://www.optiview.ai/robots.txt
curl https://www.optiview.ai/sitemap.xml
```

### API Worker
```bash
curl https://api.optiview.ai/health
# Should return: ok

curl -i https://api.optiview.ai/v1/tag.js
# Should return: 410 Gone JSON
```

### Collector Worker
```bash
curl -I "https://collector.optiview.ai/px?prop_id=prop_demo&u=https%3A%2F%2Fexample.com"
# Should return: 200 image/gif

# Verify database
wrangler d1 execute optiview_db --command "SELECT COUNT(*) FROM hits;"
```

## 📋 Next: Audit Engine (Prompt 6)

Once the above is deployed and tested, we'll add:

1. `packages/api-worker/src/audit.ts` - Audit orchestration
2. `packages/api-worker/src/html.ts` - HTML parsing helpers
3. `packages/api-worker/src/score.ts` - Scoring model
4. Updated `index.ts` with audit endpoints:
   - `POST /v1/audits/start`
   - `GET /v1/audits/:id`

## 🔐 Environment Variables

Remember to update these in production:

- `HASH_SALT` - Secure random string for IP hashing
- `USER_AGENT` - Already set to OptiviewAuditBot/1.0

## 📊 Infrastructure

- **D1 Database**: `optiview_db` (975fb94d-9fac-4fd9-b8e2-41444f488334)
- **API Worker**: `geodude-api`
- **Collector Worker**: `geodude-collector`
- **Pages Project**: `geodude`

