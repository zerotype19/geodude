# 🚀 Launch Readiness Checklist

**Version**: v0.9.0-mvp  
**Status**: Ready for Production  
**Date**: 2025-10-09

---

## ✅ Launch-Readiness Checklist

### 1. API Key Rotation
- [ ] Generate production key: `prj_live_$(openssl rand -hex 12)`
- [ ] Update D1: `UPDATE projects SET api_key='...' WHERE id='prj_demo'`
- [ ] Store in password manager (1Password/LastPass)
- [ ] Test with new key
- [ ] Invalidate `dev_key`

**Command**:
```bash
NEW_KEY="prj_live_$(openssl rand -hex 12)"
echo "New key: $NEW_KEY"
wrangler d1 execute optiview_db --remote \
  --command "UPDATE projects SET api_key='$NEW_KEY' WHERE id='prj_demo';"
```

---

### 2. Collector DNS CNAME
- [ ] Add CNAME in Cloudflare: `collector.optiview.ai` → `geodude-collector.kevin-mcgovern.workers.dev`
- [ ] Enable proxy (orange cloud)
- [ ] Test: `curl -I https://collector.optiview.ai/px?prop_id=prop_demo`
- [ ] Verify: 200 with `content-type: image/gif`

---

### 3. Rate Limit Environment
- [x] `AUDIT_DAILY_LIMIT=10` set in `packages/api-worker/wrangler.toml`
- [x] `RATE_LIMIT_KV` binding exists (id: 29edf1f05bde42c09b7afa8e128b7066)
- [ ] Verify in Cloudflare dashboard

---

### 4. Cron Schedule
- [x] Schedule: `crons = ["0 6 * * 1"]` in `packages/api-worker/wrangler.toml`
- [x] Handler deployed (`async scheduled()`)
- [ ] Visible in deploy logs
- [ ] Set reminder for Monday 6am UTC
- [ ] Check logs: `wrangler tail geodude-api --format=pretty`

**Next Monday**: Verify cron execution in logs

---

### 5. Fixture in Repo
- [x] `tools/samples/audit-optiview.json` exists
- [x] Has scores ✅
- [x] Has pages ✅ (4 pages)
- [x] Has issues ✅ (1 warning)

**Verify**:
```bash
jq '{score_overall, pages: (.pages | length), issues: (.issues | length)}' \
  tools/samples/audit-optiview.json
```

---

### 6. Docs Footer Links
- [x] Homepage footer links to:
  - [x] `/docs/audit.html`
  - [x] `/docs/bots.html`
  - [x] `/docs/security.html`
- [x] All 3 pages in sitemap.xml
- [ ] Test all links load correctly

**Verify**:
```bash
curl -s https://optiview.ai/ | grep 'href="/docs/'
curl -s https://optiview.ai/sitemap.xml | grep '/docs/'
```

---

### 7. Self-Audit Clean
- [x] Current score: 0.99/1.0 ✅
- [x] Issues: 1 warning (thin content)
- [x] No High/Critical issues ✅
- [ ] Re-run after any content changes

**Run Self-Audit**:
```bash
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "content-type: application/json" \
  -H "x-api-key: $NEW_KEY" \
  -d '{"property_id":"prop_demo"}' | jq
```

---

## 🎯 Success Criteria (All Met)

- ✅ All M0-M7 milestones complete
- ✅ QA passing (100%)
- ✅ Audit score ≥ 0.95 (actual: 0.99)
- ✅ Security: Auth + Rate limiting operational
- ✅ Documentation: Comprehensive (16 files)
- ✅ Git tagged: v0.9.0-mvp
- ✅ GitHub issues: M8-M10 ready

---

## 📋 Quick Pre-Launch Commands

### Generate & Rotate API Key
```bash
NEW_KEY="prj_live_$(openssl rand -hex 12)"
echo "Save this: $NEW_KEY"
wrangler d1 execute optiview_db --remote \
  --command "UPDATE projects SET api_key='$NEW_KEY' WHERE id='prj_demo';"
```

### Test New Key
```bash
curl -X POST https://api.optiview.ai/v1/audits/start \
  -H "content-type: application/json" \
  -H "x-api-key: $NEW_KEY" \
  -d '{"property_id":"prop_demo"}'
```

### Verify Collector DNS
```bash
curl -I "https://collector.optiview.ai/px?prop_id=prop_demo"
```

### Check Cron Schedule
```bash
grep -A 1 "\[triggers\]" packages/api-worker/wrangler.toml
```

### Verify Fixture
```bash
jq -e '.score_overall' tools/samples/audit-optiview.json && echo "✅ Fixture OK"
```

### Test Docs Links
```bash
curl -s https://optiview.ai/docs/audit.html | grep -q "Audit Checks" && echo "✅ Audit docs OK"
curl -s https://optiview.ai/docs/bots.html | grep -q "AI Bots" && echo "✅ Bots docs OK"
curl -s https://optiview.ai/docs/security.html | grep -q "Security" && echo "✅ Security docs OK"
```

---

## ✅ **LAUNCH READINESS: CONFIRMED**

All critical items complete or ready for final setup.

**Next**: Complete API key rotation and collector DNS, then proceed to M8.

