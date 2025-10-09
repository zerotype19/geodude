# M8 Execution Log - Dashboard + Share Links

**Sprint Duration**: 48 hours  
**Start Time**: 2025-10-09 15:00 UTC  
**Branch**: v0.10.0-dashboard

---

## 🕐 T+0–2hr — DNS + Secrets ✅ COMPLETE

### DNS Configuration

#### Collector DNS ✅
```
Domain: collector.optiview.ai
Resolution: 104.21.9.151, 172.67.160.51
Target: geodude-collector worker
Status: ACTIVE

Test:
curl -sI https://collector.optiview.ai/px?prop_id=prop_demo
Result: HTTP/2 200, content-type: image/gif ✅
```

#### App DNS ⚠️
```
Domain: app.optiview.ai
Status: PENDING (configure after first Pages deploy)
```

### HASH_SALT Rotation ✅
```
Old: "change_me"
New: "prod_salt_6bd61859686eebd3e0caa31f2192ac83"
Updated: packages/api-worker/wrangler.toml
Updated: packages/collector-worker/wrangler.toml
Deployed: Both workers ✅
```

### Verification ✅
```bash
# Test hit with new salt
curl -H "User-Agent: GPTBot/1.0" \
  "https://collector.optiview.ai/px?prop_id=prop_demo&u=https://test-hash.com"

# Check new hash pattern
wrangler d1 execute optiview_db --remote \
  --command "SELECT ip_hash, bot_type FROM hits ORDER BY id DESC LIMIT 1;"

Result:
ip_hash: 9d9ca3a33bb88379e52c54982ab5ddf7886349d7eaf139d05e1f9b3a109f317b
bot_type: GPTBot
Status: ✅ New hash pattern confirmed (different from old salt)
```

---

## 🕓 T+2–12hr — Dashboard Implementation (IN PROGRESS)

### Cursor Prompt (Copy-Paste Ready)

```
In apps/app, implement the following features for M8 - Dashboard + Shareable Audits:

**Tech Stack**: Vite + React + TypeScript + Tailwind CSS

**File Structure**:
```
apps/app/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── routes/
│   │   ├── Dashboard.tsx
│   │   └── PublicAudit.tsx
│   ├── hooks/
│   │   └── useApiKey.ts
│   ├── services/
│   │   └── api.ts
│   └── components/
│       ├── AuditResults.tsx
│       ├── ScoreCard.tsx
│       └── IssuesTable.tsx
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js
```

**1. Route: /a/:audit_id (public view)**
```tsx
// src/routes/PublicAudit.tsx
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getAudit } from '../services/api';
import { AuditResults } from '../components/AuditResults';

export function PublicAudit() {
  const { auditId } = useParams();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (auditId) {
      setLoading(true);
      getAudit(auditId)
        .then(data => {
          setAudit(data);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [auditId]);

  if (loading) return <div>Loading audit...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!audit) return <div>Audit not found</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Audit Results</h1>
      <AuditResults audit={audit} isPublic={true} />
    </div>
  );
}
```

**2. useApiKey() hook**
```tsx
// src/hooks/useApiKey.ts
import { useState, useEffect } from 'react';

const API_KEY_STORAGE = 'optiview_api_key';

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string>(() => {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  });

  const setApiKey = (key: string) => {
    localStorage.setItem(API_KEY_STORAGE, key);
    setApiKeyState(key);
  };

  const clearApiKey = () => {
    localStorage.removeItem(API_KEY_STORAGE);
    setApiKeyState('');
  };

  return { apiKey, setApiKey, clearApiKey };
}
```

**3. API Service**
```tsx
// src/services/api.ts
const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.optiview.ai';

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
    const error = await response.json();
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getAudit(auditId: string) {
  const response = await fetch(`${API_BASE}/v1/audits/${auditId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}
```

**4. Dashboard Route**
```tsx
// src/routes/Dashboard.tsx
import { useState } from 'react';
import { useApiKey } from '../hooks/useApiKey';
import { startAudit } from '../services/api';
import { AuditResults } from '../components/AuditResults';

export function Dashboard() {
  const { apiKey, setApiKey } = useApiKey();
  const [propertyId, setPropertyId] = useState('prop_demo');
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRunAudit = async () => {
    if (!apiKey) {
      alert('Please enter your API key');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await startAudit(propertyId, apiKey);
      setAudit(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!audit?.id) return;
    
    const shareUrl = `${window.location.origin}/a/${audit.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Share link copied to clipboard!');
    });
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Optiview Dashboard</h1>

      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Property ID</label>
          <input
            type="text"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            placeholder="prop_demo"
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <button
          onClick={handleRunAudit}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Running Audit...' : 'Run Audit'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {audit && (
        <div className="space-y-4">
          <button
            onClick={handleCopyShareLink}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Copy Share Link
          </button>

          <AuditResults audit={audit} isPublic={false} />
        </div>
      )}
    </div>
  );
}
```

**5. Main App Router**
```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './routes/Dashboard';
import { PublicAudit } from './routes/PublicAudit';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/a/:auditId" element={<PublicAudit />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

**6. Components**

Create these components:
- `AuditResults.tsx` - Main results display
- `ScoreCard.tsx` - Score visualization
- `IssuesTable.tsx` - Issues list

**7. Build & Deploy**

Update `apps/app/package.json`:
```json
{
  "name": "@geodude/app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "vite build && wrangler pages deploy dist --project-name=geodude-app"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.45",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.3",
    "vite": "^5.4.1"
  }
}
```

**Environment**:
- Set `VITE_API_BASE=https://api.optiview.ai` in Cloudflare Pages settings

**Deploy**:
```bash
cd apps/app
pnpm install
pnpm build
pnpm deploy
```

**Gate (Must Pass)**:
✅ POST /v1/audits/start works with x-api-key
✅ /a/<id> view renders publicly (scores/issues/pages)
✅ Private window works without auth
✅ Copy link button works
✅ No auth/key leaks in network tab
```

### Implementation Checklist
- [ ] Install dependencies (react-router-dom, etc.)
- [ ] Create file structure
- [ ] Implement useApiKey hook
- [ ] Implement API service
- [ ] Create Dashboard route
- [ ] Create PublicAudit route
- [ ] Create AuditResults component
- [ ] Build and test locally
- [ ] Deploy to Cloudflare Pages
- [ ] Configure VITE_API_BASE env var
- [ ] Set up app.optiview.ai custom domain

---

## 🧪 T+12–24hr — QA Pass (PENDING)

### Test Plan

#### Test 1: API Key Auth
```bash
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}' | jq '{id, status, score_overall}'
```

**Expected**: `{"id":"aud_xxx","status":"completed","score_overall":0.99}`

#### Test 2: Dashboard Flow
1. Open https://app.optiview.ai/
2. Enter API key: `prj_live_8c5e1556810d52f8d5e8b179`
3. Property: `prop_demo`
4. Click "Run Audit"
5. Wait for completion (~5-10s)
6. Click "Copy Share Link"
7. Open link in private window
8. Verify public access works

#### Test 3: Public Share Link
```bash
# Get latest audit ID
AUDIT_ID=$(curl -s -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}' | jq -r '.id')

# Open in browser
open "https://app.optiview.ai/a/$AUDIT_ID"
```

**Expected**: Audit renders without auth in private window

#### Test 4: Error Handling
```bash
# Test without API key
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}'

# Expected: 401 Unauthorized

# Test with invalid audit ID
curl https://api.optiview.ai/v1/audits/invalid_id

# Expected: 404 Not Found
```

#### Test 5: Security Check
- [ ] Open DevTools → Network
- [ ] Run audit
- [ ] Check requests for API key exposure
- [ ] Verify x-api-key only sent with auth requests
- [ ] Confirm public GET has no auth headers

### Screenshots Needed
- [ ] Dashboard with API key input
- [ ] Audit results (scores)
- [ ] Issues table
- [ ] Public share link view
- [ ] Copy link confirmation

### Deliverable
- [ ] QA_M8_REPORT.md (auto-generated)

---

## 🕛 T+24–36hr — Content + Comms (PENDING)

### Content Updates

#### Update /docs/audit.html
Add new FAQ section:
```html
<div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
  <h3 itemprop="name">How to use the Optiview dashboard?</h3>
  <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
    <div itemprop="text">
      <p>Visit app.optiview.ai, enter your API key, select a property, and click "Run Audit". 
      Results appear in seconds with actionable recommendations. Share audits using the 
      "Copy Link" button for stakeholder review.</p>
    </div>
  </div>
</div>
```

### Comms Distribution

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

### Checklist
- [ ] Update docs FAQ
- [ ] Post to LinkedIn
- [ ] Share in Publicis Slack
- [ ] Collect feedback

---

## 🕒 T+36–48hr — Tag v0.10.0 + Plan Next (PENDING)

### Tag Release
```bash
git checkout v0.10.0-dashboard
git pull
git tag v0.10.0
git push origin v0.10.0

# Merge to main
git checkout main
git merge v0.10.0-dashboard
git push origin main
```

### Next Milestones

#### M10 — Entity Graph (sameAs)
**Branch**: v0.11.0-entity-graph
**Tasks**:
- Detect missing Organization.sameAs
- Generate 3-5 recommendations (LinkedIn, Crunchbase, GitHub)
- Copy-paste JSON-LD snippet
- "Mark as applied" toggle

#### M9 — Citations Lite
**Branch**: v0.12.0-citations
**Tasks**:
- Citations table migration
- API field: citations: []
- UI tab with empty state
- Stub implementation (0 results)

---

## 🎯 Success Gates

### Must Pass
- [ ] /a/:id renders public audit ✅
- [ ] ≥3 external audits run via UI
- [ ] ≥1 share link used externally
- [ ] No auth/key leaks in network tab
- [ ] Dashboard deployed error-free (<100ms TTFB)

### Nice to Have
- [ ] ?domain=<site> param to prefill property
- [ ] Mini chart of audit scores over time
- [ ] Mobile-responsive design
- [ ] Loading skeleton states

---

## ⚡ Optional Enhancements (If Time Permits)

### URL Param Prefill
```tsx
// In Dashboard.tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const domainParam = params.get('domain');
  if (domainParam) {
    // Look up or create property for domain
    // setPropertyId(foundPropertyId);
  }
}, []);
```

### Audit History Chart
```tsx
// Fetch recent audits for property
const audits = await fetch(`/v1/audits?property_id=${propertyId}&limit=10`);

// Display mini line chart
<LineChart data={audits.map(a => ({
  date: a.started_at,
  score: a.score_overall
}))} />
```

---

## 📊 Current Status

### Phase 1: DNS + Secrets ✅ COMPLETE
- [x] Collector DNS verified
- [x] HASH_SALT rotated
- [x] Workers redeployed
- [x] New hash pattern confirmed

### Phase 2: Dashboard Implementation (NEXT)
- [ ] Paste Cursor prompt
- [ ] Implement features
- [ ] Build & deploy
- [ ] Smoke test

### Phase 3: QA Pass (PENDING)
### Phase 4: Comms (PENDING)
### Phase 5: Tag Release (PENDING)

---

**Next Action**: Paste Cursor prompt and implement M8 features 🚀

