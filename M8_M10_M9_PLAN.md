# M8-M10 Implementation Plan (Exact, Minimal)

**Order**: M8 → M10 → M9  
**Scope**: Zero creep, testable slices

---

## 🎯 M8: Deploy Dashboard + Shareable Audits

**Goal**: Partners can run and share audits without CLI

### Do This (Exact Steps)

#### 1. Pages Deploy
```bash
# Cloudflare Pages Setup:
# - Project: geodude-app
# - Framework: Vite
# - Build command: pnpm build
# - Build output: apps/app/dist
# - Root directory: / (monorepo)
# - Environment: VITE_API_BASE=https://api.optiview.ai
# - Custom domain: app.optiview.ai
```

#### 2. Public View Route
Add `/a/:audit_id` route:
```typescript
// Route: /a/:audit_id
// Only calls: GET /v1/audits/:id (already public ✅)
// Renders: Scores, issues, pages (read-only)
```

#### 3. API Key Input
```typescript
// Small input persisted to localStorage
const apiKey = localStorage.getItem('optiview_api_key');

// Used only for POST /v1/audits/start
fetch('https://api.optiview.ai/v1/audits/start', {
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey || ''
  },
  body: JSON.stringify({ property_id: 'prop_demo' })
});
```

#### 4. Copy Link Button
```typescript
// Button that copies share URL
const shareUrl = `https://app.optiview.ai/a/${auditId}`;
navigator.clipboard.writeText(shareUrl);
```

### Acceptance
- [ ] In private window without key, `/a/<id>` renders read-only audit
- [ ] Scores, issues, pages visible
- [ ] Copy link button works

---

## 🎯 M10: Entity Graph (sameAs) — Fast Win

**Goal**: Detect and recommend sameAs links

### Do This

#### 1. Detection
```typescript
// In audit engine
function detectMissingSameAs(jsonLdBlocks: any[]): boolean {
  const org = jsonLdBlocks.find(b => b['@type'] === 'Organization');
  return org && (!org.sameAs || org.sameAs.length === 0);
}
```

#### 2. Recommendations (3-5 links)
```typescript
function generateSameAs(domain: string, companyName: string) {
  const slug = companyName.toLowerCase().replace(/\s+/g, '');
  return [
    `https://www.linkedin.com/company/${slug}`,
    `https://www.crunchbase.com/organization/${slug}`,
    `https://github.com/${slug}`,
    `https://www.wikidata.org/wiki/Special:Search/${companyName}`
  ];
}
```

#### 3. Copy-Paste JSON-LD
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Optiview",
  "url": "https://optiview.ai",
  "sameAs": [
    "https://www.linkedin.com/company/optiview",
    "https://www.crunchbase.com/organization/optiview",
    "https://github.com/optiview"
  ]
}
```

#### 4. "Mark as Applied" Toggle
```typescript
// Local state only
const [applied, setApplied] = useState(
  JSON.parse(localStorage.getItem('optiview_applied_sameas') || 'false')
);
```

### Acceptance
- [ ] Detects missing sameAs
- [ ] Shows 3-5 recommendations
- [ ] JSON-LD snippet copy works
- [ ] "Mark as applied" persists

---

## 🎯 M9: Citations Lite — Stub First

**Goal**: Wire pipeline, expand later

### Do This

#### 1. Citations Table
```sql
-- db/migrations/0003_citations.sql
CREATE TABLE IF NOT EXISTS citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id TEXT NOT NULL,
  engine TEXT NOT NULL,      -- 'perplexity' | 'bing' | 'stub'
  query TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  cited_at INTEGER NOT NULL
);
CREATE INDEX idx_citations_audit ON citations(audit_id);
```

#### 2. API Field
```typescript
// Add to GET /v1/audits/:id response
{
  "id": "aud_xxx",
  "score_overall": 0.99,
  "pages": [...],
  "issues": [...],
  "citations": []  // Start with empty array (stub)
}
```

#### 3. Start with Safe Stub
```typescript
// Internal endpoint (for later expansion)
async function fetchCitations(auditId: string, domain: string) {
  // Stub: return 0 results
  return [];
  
  // Later: add TOS-safe integration
  // const queries = [`${domain} AI visibility`];
  // const results = await searchAPI(queries);
  // return results.filter(r => r.url.includes(domain));
}
```

#### 4. UI Citations Tab
```typescript
// Show pipeline wired, empty state works
{citations && citations.length > 0 ? (
  <CitationsTable citations={citations} />
) : (
  <p>No citations yet. Your domain hasn't appeared in AI answer sources.</p>
)}
```

### Acceptance
- [ ] Table created ✅
- [ ] API field present ✅
- [ ] Stub returns 0 results ✅
- [ ] UI shows "None yet" correctly ✅

### Later Expansion (v0.12+)
- [ ] Add TOS-safe search API
- [ ] Implement citation extraction
- [ ] Store matches in D1

---

## 📊 Minimal Observability (Don't Overbuild)

### 1. Rate Limit Headers (Already Done ✅)
```typescript
// In index.ts - already implemented
headers: {
  'X-RateLimit-Limit': rateLimit.limit.toString(),
  'X-RateLimit-Remaining': (rateLimit.limit - rateLimit.count).toString(),
  'Retry-After': '86400'
}
```

### 2. Audit Guardrails
```typescript
// Log errors or slow audits
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

### 3. Weekly Rollup Query (Manual)
```sql
-- Run weekly to monitor bot traffic
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

## 🎓 Customer-Ready Copy

### Onboarding Steps (README/Email)
```
1. Here's your API key: [REDACTED]

2. Go to app.optiview.ai, paste key, add your domain, click Run Audit.

3. Fix items using the provided snippets; re-run to confirm.

4. Optional: Install 1×1 pixel to see AI bot hits.
   <img src="https://collector.optiview.ai/px?prop_id=YOUR_PROP_ID&u={{page_url}}" width="1" height="1" alt="" />
```

### 3-Minute Demo Script
```
1. Show optiview.ai/robots.txt (bots allowed)
   → Point out GPTBot, ClaudeBot, etc.

2. In app.optiview.ai, run audit
   → Show scores/issues/pages appear

3. Open /docs/audit.html (has FAQ JSON-LD)
   → Re-run audit, show improvement in structured score

4. Hit collector with User-Agent: GPTBot
   → Show DB row in hits table with bot_type="GPTBot"
```

**Command for Demo Step 4**:
```bash
curl -H "User-Agent: Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.0)" \
  "https://collector.optiview.ai/px?prop_id=prop_demo&u=https://demo.com"

# Then show:
wrangler d1 execute optiview_db --remote \
  --command "SELECT * FROM hits WHERE bot_type='GPTBot' ORDER BY id DESC LIMIT 1;"
```

---

## 🔒 Lightweight Security Polish

### 1. CSP Headers
```
# Add to apps/web/public/_headers and apps/app/public/_headers
/*
  Content-Security-Policy: default-src 'self'; img-src 'self' data: https://collector.optiview.ai; script-src 'self'; style-src 'self' 'unsafe-inline';
```

### 2. CORS Tightening
```typescript
// In packages/api-worker/src/index.ts
const allowedOrigins = [
  'https://app.optiview.ai',
  'https://optiview.ai',
  'http://localhost:5173'  // dev
];

const origin = request.headers.get('Origin');
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://optiview.ai',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key'
};
```

### 3. IP Hashing Salt
```typescript
// Verify HASH_SALT is unique & not default
// In wrangler.toml:
[vars]
HASH_SALT = "prod_salt_$(openssl rand -hex 16)"  # Rotate if leaked
```

### 4. /status Page (Static)
```html
<!-- apps/web/public/status.html -->
<!DOCTYPE html>
<html>
<head><title>Optiview Status</title></head>
<body>
  <h1>Optiview Status</h1>
  <div id="status">Checking...</div>
  <script>
    fetch('https://api.optiview.ai/health')
      .then(r => r.text())
      .then(t => {
        document.getElementById('status').innerHTML = 
          t === 'ok' ? '✅ Operational' : '❌ Degraded';
      });
  </script>
</body>
</html>
```

---

## 📈 Success Metrics (v0.10-0.12)

### M8 Success (v0.10.0)
- 🟢 **3+ external users** run audit via dashboard
- 🟢 **1+ share link** used by stakeholder
- 🟢 **0 errors** in dashboard deployment

### M10 Success (v0.11.0)
- 🟢 **≥1 recommended sameAs** added to customer site
- 🟢 **Re-audit shows** structured score improvement
- 🟢 **JSON-LD validates** in Google Rich Results Test

### M9 Success (v0.12.0)
- 🟢 **Citations pipeline stores rows** (even 0's)
- 🟢 **UI shows "None yet"** without errors
- 🟢 **Migration applied** successfully

---

## 🔐 Optional: Signed Share Links (Future)

**Keep Simple Now** (GET /v1/audits/:id is public)

**If Needed Later**:
```typescript
// Generate signed link
const sig = await crypto.subtle.digest('SHA-256', 
  new TextEncoder().encode(`${id}.${exp}.${HMAC_SECRET}`)
);

// URL: /v1/audits/share/:id?exp=<unix>&sig=<hex>

// Validate
const expected = await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(`${id}.${exp}.${HMAC_SECRET}`)
);
if (sig !== hex(expected) || Date.now() > exp * 1000) {
  return 403;
}
```

**Not needed yet** since GET is public, but easy to drop in.

---

## ✅ Implementation Checklist

### Pre-M8
- [ ] API key rotated
- [ ] Collector DNS configured
- [ ] Self-audit clean (0.99+)

### M8 (v0.10.0)
- [ ] Deploy apps/app to app.optiview.ai
- [ ] Add /a/:id route (public view)
- [ ] API key input (localStorage)
- [ ] Copy link button
- [ ] Test in private window

### M10 (v0.11.0)
- [ ] Detect missing sameAs
- [ ] Generate 3-5 recommendations
- [ ] Copy-paste JSON-LD snippet
- [ ] "Mark as applied" toggle

### M9 (v0.12.0)
- [ ] Citations table migration
- [ ] API field added
- [ ] Stub implementation (0 results)
- [ ] UI tab with empty state

### Security Polish
- [ ] CSP headers added
- [ ] CORS tightened
- [ ] IP salt verified/rotated
- [ ] /status page created

---

**Status**: Plan locked, zero scope creep  
**Next**: Execute M8 → M10 → M9

