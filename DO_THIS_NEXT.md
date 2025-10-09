# 🎯 DO THIS NEXT - v0.9.0-mvp → v1.0.0

**Current**: v0.9.0-mvp LOCKED ✅  
**Target**: v1.0.0 (M8 + M10 + M9)  
**Zero drift, testable gates**

---

## ✅ IMMEDIATE ACTIONS (TODAY) - COMPLETE!

### 1. API Key Rotated ✅
```
Production Key: prj_live_8c5e1556810d52f8d5e8b179
Status: ✅ Updated in D1
Status: ✅ Tested and working
Action: 📝 SAVE TO PASSWORD MANAGER NOW!
```

### 2. Rate Limit Confirmed ✅
```
AUDIT_DAILY_LIMIT = 10 ✅
Location: packages/api-worker/wrangler.toml (line 17)
```

### 3. Collector DNS ⚠️ PENDING
```bash
# Add in Cloudflare DNS:
# Type: CNAME
# Name: collector
# Target: geodude-collector.kevin-mcgovern.workers.dev
# Proxy: ON (orange cloud)

# Then smoke test:
curl -I "https://collector.optiview.ai/px?prop_id=prop_demo"
# Expected: HTTP/2 200, content-type: image/gif
```

---

## 🚀 M8: Deploy Dashboard + Share Links

**Goal**: Partners can run + share audits without CLI

### Do This (Exact Steps)

1. **Deploy apps/app → app.optiview.ai**
   ```bash
   # Cloudflare Pages:
   # - Project name: geodude-app
   # - Build command: cd apps/app && pnpm build
   # - Build output: apps/app/dist
   # - Root directory: / (monorepo)
   # - Environment: VITE_API_BASE=https://api.optiview.ai
   # - Custom domain: app.optiview.ai
   ```

2. **Add `/a/:audit_id` route (public view)**
   ```typescript
   // Route: /a/:audit_id
   // Fetches: GET /v1/audits/:id (no auth required)
   // Renders: Scores, issues, pages (read-only)
   ```

3. **Add API key field (localStorage)**
   ```typescript
   const apiKey = localStorage.getItem('optiview_api_key');
   // Use in POST /v1/audits/start header: x-api-key
   ```

4. **Add "Copy share link" button**
   ```typescript
   const shareUrl = `https://app.optiview.ai/a/${auditId}`;
   navigator.clipboard.writeText(shareUrl);
   ```

### Gate (Must Pass)
- [ ] `/a/<id>` loads in private window WITHOUT key
- [ ] Renders scores/issues/pages correctly
- [ ] Copy link button works
- [ ] Share link loads for non-authenticated users

**Target**: v0.10.0

---

## 🎯 M10: Entity Graph (sameAs) — Fast Win

**Goal**: Detect and recommend sameAs links

### Do This

1. **Detect missing `Organization.sameAs`**
   ```typescript
   const org = jsonLdBlocks.find(b => b['@type'] === 'Organization');
   const missingSameAs = org && (!org.sameAs || org.sameAs.length === 0);
   ```

2. **Suggest 3-5 links**
   ```typescript
   const suggestions = [
     `https://www.linkedin.com/company/${slug}`,
     `https://www.crunchbase.com/organization/${slug}`,
     `https://github.com/${slug}`,
     `https://www.wikidata.org/wiki/Special:Search/${name}`
   ];
   ```

3. **Copy-paste JSON-LD + "mark as applied"**
   ```json
   {
     "@context": "https://schema.org",
     "@type": "Organization",
     "name": "Optiview",
     "url": "https://optiview.ai",
     "sameAs": [...]
   }
   ```

### Gate (Must Pass)
- [ ] Snippet validates in Google Rich Results Test
- [ ] Re-audit shows structured score ≥ baseline
- [ ] "Mark as applied" persists to localStorage

**Target**: v0.11.0

---

## 🔍 M9: Citations Lite — Stub First

**Goal**: Wire pipeline, expand later

### Do This

1. **Add citations table**
   ```sql
   CREATE TABLE citations (
     id INTEGER PRIMARY KEY,
     audit_id TEXT NOT NULL,
     engine TEXT NOT NULL,
     query TEXT NOT NULL,
     url TEXT NOT NULL,
     title TEXT,
     cited_at INTEGER NOT NULL
   );
   CREATE INDEX idx_citations_audit ON citations(audit_id);
   ```

2. **Return `citations: []` in GET audit**
   ```typescript
   // Start with empty array (stub)
   {
     "id": "aud_xxx",
     "citations": []  // Stub for now
   }
   ```

3. **UI tab shows "None yet"**
   ```typescript
   {citations.length > 0 ? (
     <CitationsTable />
   ) : (
     <p>No citations yet. Your domain hasn't appeared in AI sources.</p>
   )}
   ```

### Gate (Must Pass)
- [ ] Migration applies cleanly
- [ ] UI shows empty state without errors
- [ ] Pipeline ready for future integration

**Target**: v0.12.0

---

## 📊 Minimal Monitoring (Don't Overshoot)

### 1. Rate Limit Headers ✅ (Already Done)
```typescript
headers: {
  'X-RateLimit-Limit': '10',
  'X-RateLimit-Remaining': '0',
  'Retry-After': '86400'
}
```

### 2. Audit Guardrail Logs
```typescript
if (audit.status === 'error' || elapsed > 90000) {
  console.error('AUDIT_FAILURE', {
    property_id,
    domain,
    status: audit.status,
    error: audit.error,
    elapsed_ms: elapsed
  });
}
```

### 3. Weekly Bot Rollup (Manual)
```sql
SELECT 
  date(created_at) AS d,
  bot_type,
  COUNT(*) AS c
FROM hits
GROUP BY d, bot_type
ORDER BY d DESC, c DESC
LIMIT 50;
```

---

## 🔒 Tiny Security Polish

### 1. CSP Headers
```
# Add to apps/web/public/_headers and apps/app/public/_headers
/*
  Content-Security-Policy: default-src 'self'; img-src 'self' data: https://collector.optiview.ai; script-src 'self'; style-src 'self' 'unsafe-inline';
```

### 2. Tighten CORS
```typescript
const allowedOrigins = [
  'https://app.optiview.ai',
  'https://optiview.ai',
  'http://localhost:5173'
];
```

### 3. Confirm HASH_SALT Unique
```bash
grep "HASH_SALT" packages/api-worker/wrangler.toml
# Should NOT be "change_me"
```

---

## ✅ Success Metrics (Sign-Off)

### M8 Success
- 🎯 **≥3 external users** run an audit
- 🎯 **≥1 share link** used by stakeholder
- 🎯 **Zero deploy errors**

### M10 Success
- 🎯 **≥1 customer** adds sameAs
- 🎯 **Structured score** improves on re-audit

### M9 Success
- 🎯 **Citations pipeline** writes rows (even 0's)
- 🎯 **UI shows** "None yet" correctly

---

## 🏁 Implementation Order

```
1. ✅ API Key Rotated (DONE)
2. ⚠️ Collector DNS (PENDING - add CNAME)
3. 🚀 M8 - Dashboard (1-2 days)
4. 🎯 M10 - Entity Graph (1-2 days)
5. 🔍 M9 - Citations Stub (1-2 days)
6. 🔒 Security Polish (ongoing)
```

---

## 📝 Quick Commands

### Test New API Key
```bash
NEW_KEY="prj_live_8c5e1556810d52f8d5e8b179"
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "content-type: application/json" \
  -H "x-api-key: $NEW_KEY" \
  -d '{"property_id":"prop_demo"}'
```

### Test Collector DNS (After CNAME)
```bash
curl -I "https://collector.optiview.ai/px?prop_id=prop_demo"
```

### Weekly Bot Rollup
```bash
wrangler d1 execute optiview_db --remote --command \
  "SELECT date(created_at) d, bot_type, COUNT(*) c FROM hits GROUP BY d, bot_type ORDER BY d DESC, c DESC LIMIT 50;"
```

### Check Cron Logs (Monday Morning)
```bash
wrangler tail geodude-api --format=pretty
```

---

## 🎯 CURRENT STATUS

✅ **v0.9.0-mvp**: LOCKED & SHIPPED  
✅ **API Key**: ROTATED (prj_live_8c5e1556810d52f8d5e8b179)  
✅ **Rate Limit**: CONFIRMED (10/day)  
⚠️ **Collector DNS**: PENDING (add CNAME)  
🚀 **Next**: M8 Dashboard Deployment

---

**Zero drift. Testable gates. Ship it!** 🚀

