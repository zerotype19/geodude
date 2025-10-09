# 🚀 v0.9.0 → v0.10.0 Transition Complete

**Date**: 2025-10-09  
**Status**: Ready for 48-hour M8 sprint

---

## ✅ WHAT WE JUST DID

### 1. Locked v0.9.0 Production Release
```bash
✅ git tag v0.9.0
✅ git push origin v0.9.0
```

**v0.9.0 is LOCKED on `main`** - Production-ready milestone

---

### 2. Created v0.10.0 Development Branch
```bash
✅ git checkout -b v0.10.0-dashboard
✅ git push origin v0.10.0-dashboard
```

**Active development**: `v0.10.0-dashboard`  
**PR ready**: https://github.com/zerotype19/geodude/pull/new/v0.10.0-dashboard

---

### 3. Confirmed Infrastructure Bindings

#### Wrangler
- ✅ Logged in: kevin.mcgovern@gmail.com

#### KV Namespace
- ✅ geodude-api-RATE_LIMIT_KV: `29edf1f05bde42c09b7afa8e128b7066`

#### D1 Database
- ✅ optiview_db: `975fb94d-9fac-4fd9-b8e2-41444f488334`

#### Workers
- ✅ geodude-api (api.optiview.ai)
- ✅ geodude-collector (collector.optiview.ai - needs DNS)

#### Pages
- ✅ geodude (optiview.ai)
- ⚠️ geodude-app (app.optiview.ai - needs setup)

#### Cron
- ✅ Schedule: `0 6 * * 1` (Mondays 6am UTC)

---

### 4. Security Audit

#### Production API Key ✅
```
prj_live_8c5e1556810d52f8d5e8b179
Status: Rotated, tested, secured
```

#### HASH_SALT ⚠️
```
Current: "change_me"
Status: NEEDS ROTATION

Command:
NEW_SALT="prod_salt_$(openssl rand -hex 16)"
sed -i '' "s/HASH_SALT = \"change_me\"/HASH_SALT = \"$NEW_SALT\"/" packages/*/wrangler.toml
```

#### Rate Limit ✅
```
AUDIT_DAILY_LIMIT = 10
Status: Configured
```

---

### 5. Created Sprint Documentation

#### V0_10_0_SPRINT.md
- 48-hour sprint plan
- Cursor copy-paste prompt (ready to use)
- QA test scripts
- Post-launch comms templates
- GitHub milestones roadmap

#### INFRA_STATUS.md
- Complete infrastructure audit
- All bindings documented
- DNS requirements listed
- Smoke test commands
- Security action items

#### .github/workflows/deploy-dashboard.yml
- Auto-deploy for apps/app
- Triggered on push to v0.10.0-dashboard or main
- Cloudflare Pages integration

---

## 🎯 WHAT'S NEXT (In Order)

### Step 1: DNS Configuration (5 minutes)
**In Cloudflare DNS**, add these CNAMEs:

```
Type: CNAME
Name: collector
Target: geodude-collector.kevin-mcgovern.workers.dev
Proxy: ON

Type: CNAME  
Name: app
Target: geodude-app.pages.dev (get from Pages after first deploy)
Proxy: ON
```

**Test**:
```bash
curl -I https://collector.optiview.ai/px?prop_id=prop_demo
# Expected: HTTP/2 200, image/gif
```

---

### Step 2: Rotate HASH_SALT (2 minutes)
```bash
# Generate unique salt
NEW_SALT="prod_salt_$(openssl rand -hex 16)"

# Update both workers
sed -i '' "s/HASH_SALT = \"change_me\"/HASH_SALT = \"$NEW_SALT\"/" \
  packages/api-worker/wrangler.toml

sed -i '' "s/HASH_SALT = \"change_me\"/HASH_SALT = \"$NEW_SALT\"/" \
  packages/collector-worker/wrangler.toml

# Redeploy
cd packages/api-worker && npx wrangler deploy
cd ../collector-worker && npx wrangler deploy
```

---

### Step 3: M8 Implementation (Copy-Paste to Cursor)

**Paste this into Cursor**:

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

---

### Step 4: Deploy Dashboard (5 minutes)
```bash
cd apps/app
pnpm build
npx wrangler pages deploy dist --project-name=geodude-app
```

**Then in Cloudflare Pages**:
1. Set environment variable: `VITE_API_BASE=https://api.optiview.ai`
2. Set custom domain: `app.optiview.ai`
3. Trigger redeploy

---

### Step 5: QA (10 minutes)

#### Test 1: API Key Auth
```bash
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}' | jq '{id, status, score_overall}'
```

#### Test 2: Public Share Link
```bash
# Use audit ID from Test 1
open https://app.optiview.ai/a/aud_xxx
```

#### Test 3: Dashboard Flow
1. Open https://app.optiview.ai/
2. Enter API key: `prj_live_8c5e1556810d52f8d5e8b179`
3. Click "Run Audit"
4. Click "Copy Share Link"
5. Open in private window
6. Verify public access

---

### Step 6: Launch (15 minutes)

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

## 📋 Success Criteria (v0.10.0 Gate)

### Must Have
- [ ] **≥3 external users** run an audit
- [ ] **≥1 share link** used by stakeholder
- [ ] **Zero deploy errors**

### Nice to Have
- [ ] Public share link featured on LinkedIn
- [ ] Internal team feedback collected
- [ ] Error rate < 1%

---

## 🏆 CURRENT STATUS

### Completed ✅
- [x] v0.9.0 tagged and locked
- [x] v0.10.0-dashboard branch created
- [x] Infrastructure bindings confirmed
- [x] API key rotated and tested
- [x] Sprint documentation complete
- [x] GitHub Actions workflow created
- [x] QA scripts ready
- [x] Comms templates prepared

### Pending ⚠️
- [ ] Configure collector DNS
- [ ] Configure app DNS
- [ ] Rotate HASH_SALT
- [ ] Implement M8 (Dashboard)
- [ ] Deploy to Cloudflare Pages
- [ ] Run QA tests
- [ ] Launch comms

---

## 📦 Deliverables Ready

### Documentation
- ✅ V0_10_0_SPRINT.md (48-hour plan)
- ✅ INFRA_STATUS.md (complete audit)
- ✅ DO_THIS_NEXT.md (action plan)
- ✅ .github/ISSUE_M8.md (GitHub issue)
- ✅ QA test scripts
- ✅ Marketing copy

### Infrastructure
- ✅ v0.9.0 production tag
- ✅ v0.10.0-dashboard dev branch
- ✅ GitHub Actions workflow
- ✅ API key rotated
- ✅ Bindings verified

### Code (Ready to Build)
- ✅ apps/app skeleton exists
- ✅ API endpoints ready (/v1/audits/*)
- ✅ Cursor prompt prepared
- ✅ Build scripts ready

---

## 🚀 READY TO SPRINT!

**Branch**: `v0.10.0-dashboard`  
**Target**: M8 Dashboard + Share Links  
**Duration**: 48 hours  
**Start**: Now!

**Next Actions**:
1. ⚡ Configure DNS (collector + app)
2. 🔐 Rotate HASH_SALT
3. 💻 Paste Cursor prompt → implement M8
4. 🚀 Deploy dashboard
5. 🧪 Run QA
6. 📣 Launch!

---

**v0.9.0 LOCKED. v0.10.0 READY. LET'S SHIP! 🔥**

