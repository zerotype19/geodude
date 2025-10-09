# 🚀 Optiview Geodude - Beta Roadmap

**Current Version**: v0.12.0 (Citations Lite)  
**Status**: Production Live ✅  
**Target**: Usable Beta in 3-5 days

---

## ✅ VICTORY LAP (Complete)

- ✅ **app.optiview.ai**: Production live
- ✅ **M8/M10/M9**: All shipped
- ✅ **Cron + Rate Limits**: Operational
- ✅ **SPA Fallback**: `_redirects` deployed
- ✅ **Security Headers**: CSP, X-Frame-Options deployed
- ✅ **CORS Allowlist**: app.optiview.ai + localhost configured

---

## 📅 RELEASE SCHEDULE

### **v0.13 - Multi-Project Onboarding** (2 days)
**Goal**: Let users add domains and run audits without touching SQL

**Scope**:
- API: `POST /v1/projects`, `POST /v1/properties`, `POST /v1/properties/verify`
- Verification: DNS TXT (`ov-verify=<prop_id>`) OR HTML file (`/.well-known/optiview-verify.txt`)
- Auto-generate API key per project
- Dashboard: "Add Site" wizard (3 steps)
- Store API key in localStorage

**Accept**:
- ✅ Add new domain from dashboard
- ✅ Verify via DNS TXT or HTML
- ✅ Run audit on new property
- ✅ View share link

### **v0.14 - Citations (Real Signal)** (1-2 days)
**Goal**: Replace stub with TOS-safe citations source

**Scope**:
- Integrate Bing Web Search API (Azure)
- Query: brand/domain variations
- Parse top N results
- Mark hits pointing to your domain as citations
- Store in `citations` table with `engine='bing'`

**Accept**:
- ✅ Citations tab shows ≥0 items for at least one query
- ✅ Empty state still clean
- ✅ Engine label shows "Bing"

### **v0.15 - Reports & Notifications** (1 day)
**Goal**: Weekly "AI Index Readiness" email

**Scope**:
- Integrate Resend API (or SMTP)
- Add `owner_email` to projects table
- On cron re-audit: compile summary (scores delta, top issues, bots seen)
- Send email with share link

**Accept**:
- ✅ After Monday cron, owner receives summary email
- ✅ Email shows scores and share link
- ✅ Message ID logged

---

## 🔧 OPS & SAFEGUARDS (Quick Wins)

### **Rate Limit Headers** (30 min)
**Status**: Partially complete (rate limiting works, headers need refinement)

**Add to API responses**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
Retry-After: 86400
```

### **Backups** (1 hour)
**Goal**: Nightly D1 export to R2

**Scope**:
- Scheduled worker (extend API cron)
- Export `audits`, `audit_pages`, `audit_issues` to JSONL
- Write to R2 bucket: `optiview-backups/YYYY-MM-DD/`
- One-click restore script

### **Status Page** (30 min)
**Goal**: Public `/status` endpoint

**Add to `apps/web`**:
- Fetch `/health` from API
- Show latest `audits.finished_at`
- Display cron last run time

---

## 📝 GTM CHECKLIST (After v0.13)

### **Documentation**
- [ ] Onboarding doc (one page): "Add site → verify → run audit → share link → pixel"
- [ ] 3-min demo script (Loom recording)
- [ ] FAQ page for common issues

### **Pilot Program**
- [ ] 5-10 friendly domains
- [ ] Run first audits
- [ ] Collect feedback on missing checks
- [ ] Iterate based on feedback

### **Marketing**
- [ ] LinkedIn post (beta announcement)
- [ ] Internal Slack announcement
- [ ] Email to early access list

---

## 🎯 SUCCESS METRICS

### **v0.13 (Onboarding)**
- 🎯 3+ users add their own domains
- 🎯 2+ users complete verification
- 🎯 5+ self-service audits run
- 🎯 Zero support tickets for "how to add domain"

### **v0.14 (Citations)**
- 🎯 1+ domain shows citations in tab
- 🎯 Zero TOS violations
- 🎯 Average 1-3 citations per audit

### **v0.15 (Email)**
- 🎯 Weekly email sent to all project owners
- 🎯 >50% email open rate
- 🎯 1+ user clicks share link from email

---

## 🚀 DEPLOYMENT COMMANDS

### **App Redeploy**
```bash
cd apps/app
pnpm build
npx wrangler pages deploy dist --project-name=geodude-app --commit-dirty=true --branch=main
```

### **API Redeploy**
```bash
cd packages/api-worker
npx wrangler deploy
```

### **Collector Redeploy**
```bash
cd packages/collector-worker
npx wrangler deploy
```

---

## 📋 CURRENT STATE SUMMARY

### **Infrastructure** ✅
- [x] All DNS configured
- [x] All SSL certificates active
- [x] All workers deployed
- [x] Custom domains attached

### **Security** ✅
- [x] API key authentication
- [x] Rate limiting (10/day)
- [x] CORS allowlist
- [x] Security headers
- [x] IP hashing

### **Features** ✅
- [x] Dashboard (M8)
- [x] Entity Graph (M10)
- [x] Citations stub (M9)
- [x] Share links
- [x] Tab navigation

### **Next Up** ⚠️
- [ ] Multi-project onboarding (v0.13)
- [ ] Real citations (v0.14)
- [ ] Email reports (v0.15)
- [ ] Rate limit headers
- [ ] Backups to R2
- [ ] Status page

---

## 🎯 TIMELINE

| Milestone | Days | Status |
|-----------|------|--------|
| Beta Polish | 0 | ✅ Complete |
| v0.13 Onboarding | 2 | 🔜 Next |
| v0.14 Citations | 1-2 | ⏳ Queued |
| v0.15 Email | 1 | ⏳ Queued |
| Ops Safeguards | 0.5 | ⏳ Parallel |
| **Total** | **4-5 days** | 🎯 **On Track** |

---

## 📞 NEXT ACTIONS

### **Immediate** (Today):
1. ✅ Verify beta polish complete
2. 🔜 Start v0.13 spec and implementation
3. 🔜 Create onboarding wizard UI mockup

### **Tomorrow**:
4. 🔜 Implement verification endpoints
5. 🔜 Build "Add Site" wizard
6. 🔜 Test self-service flow

### **Day 3-4**:
7. 🔜 Integrate Bing Search API
8. 🔜 Update citations display
9. 🔜 Test citation detection

### **Day 5**:
10. 🔜 Add Resend email integration
11. 🔜 Build email templates
12. 🔜 Test cron email flow

---

**Last Updated**: 2025-10-09  
**Status**: Ready to begin v0.13  
**Confidence**: High ✅

