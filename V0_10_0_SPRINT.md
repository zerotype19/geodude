# 🚀 v0.10.0 Sprint Plan - Dashboard Launch

**Branch**: `v0.10.0-dashboard`  
**Duration**: 48 hours  
**Goal**: M8 - Deploy Dashboard + Shareable Audit Links

---

## ✅ 1. Tag and Branch (COMPLETE)

```bash
✅ git tag v0.9.0 && git push origin v0.9.0
✅ git checkout -b v0.10.0-dashboard
```

**Status**: v0.9.0 LOCKED on main, v0.10.0 active dev branch

---

## ✅ 2. Infra Bindings Confirmed

### Wrangler Identity
```
✅ Logged in: kevin.mcgovern@gmail.com
```

### KV Namespace
```
✅ geodude-api-RATE_LIMIT_KV → 29edf1f05bde42c09b7afa8e128b7066
```

### D1 Database
```
✅ optiview_db → 975fb94d-9fac-4fd9-b8e2-41444f488334
```

### Environment Variables (packages/api-worker/wrangler.toml)
```
✅ USER_AGENT = "OptiviewAuditBot/1.0 (+https://www.optiview.ai)"
✅ AUDIT_MAX_PAGES = "30"
✅ AUDIT_DAILY_LIMIT = "10"
⚠️ HASH_SALT = "change_me" (should rotate to unique value)
```

### Cron Schedule
```
✅ crons = ["0 6 * * 1"] (Mondays 6am UTC)
```

---

## ⚠️ 3. Deploy DNS Before Code (PENDING)

### Cloudflare DNS Configuration

#### Collector (Ready to Configure)
```
Type: CNAME
Name: collector
Target: geodude-collector.kevin-mcgovern.workers.dev
Proxy: ON (orange cloud)
```

**Test**:
```bash
curl -I https://collector.optiview.ai/px?prop_id=prop_demo
# Expected: HTTP/2 200, content-type: image/gif
```

#### App Dashboard (Ready to Configure)
```
Type: CNAME
Name: app
Target: geodude-app.pages.dev (or assigned Pages domain)
Proxy: ON (orange cloud)
```

**Test**:
```bash
curl -I https://app.optiview.ai/
# Expected: HTTP/2 200
```

---

## 🚀 4. M8 Implementation - Dashboard + Share Links

### Cursor Prompt (Copy-Paste Ready)

```
In apps/app, implement the following features for M8 - Dashboard + Shareable Audits:

1. **Route: /a/:audit_id (public view)**
   - Fetches GET /v1/audits/:id (no auth required)
   - Renders scores, issues, pages (read-only)
   - Works in private/incognito window

2. **useApiKey() hook**
   - Reads/writes localStorage.getItem('optiview_api_key')
   - Provides setApiKey() function
   - Used for x-api-key header in POST requests

3. **Button: "Run Audit"**
   - Calls POST /v1/audits/start with x-api-key header
   - Body: {"property_id": "prop_demo"}
   - Shows loading state during audit
   - Displays results when complete

4. **Button: "Copy Share Link"**
   - Generates URL: https://app.optiview.ai/a/${auditId}
   - Copies to clipboard using navigator.clipboard.writeText()
   - Shows toast/confirmation message

5. **Build & Deploy**
   - Build output: /apps/app/dist
   - Deploy to Cloudflare Pages → app.optiview.ai
   - Environment: VITE_API_BASE=https://api.optiview.ai

**Gate (Must Pass)**:
✅ POST /v1/audits/start works with x-api-key
✅ /a/<id> view renders publicly (scores/issues/pages)
✅ Private window works without auth
✅ Copy link button works
```

### Technical Requirements

#### Component Structure
```typescript
// App.tsx - Main routes
<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/a/:auditId" element={<PublicAudit />} />
</Routes>

// hooks/useApiKey.ts
export function useApiKey() {
  const [apiKey, setApiKey] = useState(
    localStorage.getItem('optiview_api_key') || ''
  );
  
  const saveApiKey = (key: string) => {
    localStorage.setItem('optiview_api_key', key);
    setApiKey(key);
  };
  
  return { apiKey, setApiKey: saveApiKey };
}

// components/Dashboard.tsx
- API key input field
- Property selector
- "Run Audit" button
- Results display (scores/issues/pages)
- "Copy Share Link" button

// components/PublicAudit.tsx
- Fetches GET /v1/audits/:id (no auth)
- Displays scores, issues, pages
- Read-only view
- No API key required
```

#### API Integration
```typescript
// services/api.ts
const API_BASE = import.meta.env.VITE_API_BASE;

export async function startAudit(propertyId: string, apiKey: string) {
  const response = await fetch(`${API_BASE}/v1/audits/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({ property_id: propertyId })
  });
  
  if (!response.ok) {
    throw new Error(`Audit failed: ${response.status}`);
  }
  
  return response.json();
}

export async function getAudit(auditId: string) {
  const response = await fetch(`${API_BASE}/v1/audits/${auditId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch audit: ${response.status}`);
  }
  
  return response.json();
}
```

---

## 🧪 5. Post-Launch QA Script

### Test 1: Run Audit with API Key
```bash
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}' | jq '{id, status, score_overall}'
```

**Expected**:
```json
{
  "id": "aud_xxx",
  "status": "completed",
  "score_overall": 0.99
}
```

### Test 2: Open Share Link
```bash
# Use audit ID from Test 1
open https://app.optiview.ai/a/aud_xxx
```

**Confirm**:
- ✅ UI loads scores & issues
- ✅ GET endpoint returns public JSON
- ✅ No auth required
- ✅ Works in private/incognito window

### Test 3: Dashboard Flow
1. Open https://app.optiview.ai/
2. Enter API key: `prj_live_8c5e1556810d52f8d5e8b179`
3. Click "Run Audit"
4. Wait for completion (~5-10s)
5. Click "Copy Share Link"
6. Open link in private window
7. Verify public access works

### Test 4: Error Handling
```bash
# Test without API key
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}'

# Expected: 401 Unauthorized
```

```bash
# Test with invalid audit ID
curl https://api.optiview.ai/v1/audits/invalid_id

# Expected: 404 Not Found
```

---

## 📋 6. GitHub Milestones (Ready to Create)

### v0.10.0 - Dashboard & Shareable Links
**Due**: 48 hours from now  
**Issue**: .github/ISSUE_M8.md

**Tasks**:
- [ ] Deploy apps/app to app.optiview.ai
- [ ] Implement /a/:audit_id route (public)
- [ ] Add useApiKey() hook (localStorage)
- [ ] Add "Run Audit" button
- [ ] Add "Copy Share Link" button
- [ ] QA: Private window test
- [ ] QA: Error handling

**Success Criteria**:
- ✅ POST audit works with x-api-key
- ✅ /a/<id> renders publicly
- ✅ Private window works without auth
- ✅ Copy link button works
- ✅ Zero deploy errors

---

### v0.11.0 - Entity Graph (sameAs)
**Issue**: .github/ISSUE_M10.md

**Tasks**:
- [ ] Detect missing Organization.sameAs
- [ ] Generate 3-5 recommendations
- [ ] Copy-paste JSON-LD snippet
- [ ] "Mark as applied" toggle

---

### v0.12.0 - Citations Lite
**Issue**: .github/ISSUE_M9.md

**Tasks**:
- [ ] Citations table migration
- [ ] API field: citations: []
- [ ] UI tab with empty state
- [ ] Stub implementation (0 results)

---

## 📣 7. Comms / Marketing Prep

### Key Message
```
"Optiview now audits and visualizes your AI index readiness."
```

### Screenshots Needed
1. **Dashboard UI**: API key input + Run Audit button
2. **Audit Results**: Scores visualization (0.99/1.0)
3. **Issues Table**: List of recommendations
4. **Public Share Link**: /a/:id read-only view
5. **Docs FAQ**: JSON-LD example with FAQ schema

### Distribution Channels
- ✅ LinkedIn (personal + company)
- ✅ Internal Publicis Slack
- ✅ Product Hunt (later)
- ✅ Indie Hackers (later)

### Copy Templates

#### LinkedIn Post
```
🚀 Launching Optiview v0.10.0 - AI Index Audits

Get instant visibility into how AI crawlers see your site:
✅ Robots.txt check (GPTBot, ClaudeBot, Perplexity)
✅ Structured data validation (JSON-LD)
✅ Answerability score
✅ Shareable audit links

Try it: https://app.optiview.ai

#AIVisibility #SEO #ProductLaunch
```

#### Publicis Slack
```
Hey team! 👋

Just shipped Optiview v0.10.0 - our AI index audit tool.

You can now:
- Run audits on any domain (no login required)
- See how AI bots perceive your content
- Get actionable recommendations
- Share results with clients

Try it: https://app.optiview.ai
API key: prj_live_8c5e1556810d52f8d5e8b179

Would love feedback! 🚀
```

---

## 🔍 8. Optional Lightweight Monitoring

### /status Endpoint (Optional)
```typescript
// packages/api-worker/src/index.ts
// Add route: GET /status

if (path === '/status') {
  const lastCron = await env.DB.prepare(
    'SELECT MAX(started_at) as last_run FROM audits WHERE status="completed"'
  ).first();
  
  const auditCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM audits'
  ).first();
  
  return new Response(JSON.stringify({
    ok: true,
    service: 'geodude-api',
    last_cron: lastCron?.last_run,
    total_audits: auditCount?.count,
    uptime: Date.now()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Weekly Hits Rollup (Manual)
```bash
npx wrangler d1 execute optiview_db --remote --command \
  "SELECT date(created_at) AS d, bot_type, COUNT(*) AS c 
   FROM hits 
   GROUP BY d, bot_type 
   ORDER BY d DESC, c DESC 
   LIMIT 50;"
```

### Logpush (Optional)
```bash
# Enable Cloudflare Logpush for geodude-api
# Workers > geodude-api > Logs > Logpush
# Destination: S3/GCS/HTTP endpoint
```

---

## ✅ Success Metrics (v0.10.0 Gate)

### Must Have
- ✅ **≥3 external users** run an audit
- ✅ **≥1 share link** used by stakeholder
- ✅ **Zero deploy errors**

### Nice to Have
- ✅ Public share link featured on LinkedIn
- ✅ Internal team feedback collected
- ✅ Error rate < 1%

---

## 🏁 Sprint Checklist

### Pre-Sprint (COMPLETE)
- [x] v0.9.0 tagged and pushed
- [x] v0.10.0-dashboard branch created
- [x] Infra bindings confirmed
- [x] API key rotated (prj_live_8c5e1556810d52f8d5e8b179)

### Sprint Setup (PENDING)
- [ ] Configure collector DNS (CNAME)
- [ ] Configure app DNS (CNAME)
- [ ] Rotate HASH_SALT to unique value
- [ ] Test DNS endpoints

### M8 Implementation (PENDING)
- [ ] Implement /a/:audit_id route
- [ ] Add useApiKey() hook
- [ ] Add "Run Audit" button
- [ ] Add "Copy Share Link" button
- [ ] Build apps/app
- [ ] Deploy to Cloudflare Pages
- [ ] Configure VITE_API_BASE env var

### QA (PENDING)
- [ ] Run audit with API key
- [ ] Open share link
- [ ] Test in private window
- [ ] Verify error handling
- [ ] Check CORS headers

### Post-Launch (PENDING)
- [ ] Create GitHub milestones
- [ ] Take screenshots
- [ ] Write LinkedIn post
- [ ] Share in Publicis Slack
- [ ] Monitor for 24h

---

## 📦 Deliverables

### Code
- ✅ apps/app (Dashboard SPA)
- ✅ Route: /a/:audit_id (public)
- ✅ Hook: useApiKey()
- ✅ Component: Dashboard
- ✅ Component: PublicAudit

### Infra
- ✅ Cloudflare Pages: app.optiview.ai
- ✅ DNS CNAME: collector.optiview.ai
- ✅ DNS CNAME: app.optiview.ai

### Docs
- ✅ QA script
- ✅ Marketing copy
- ✅ Screenshots

### Comms
- ✅ LinkedIn post
- ✅ Slack announcement
- ✅ GitHub milestones

---

**Status**: v0.10.0 sprint setup COMPLETE  
**Next**: Configure DNS → Implement M8 → Deploy → QA → Launch 🚀

