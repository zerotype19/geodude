# 🚀 Deployment Runbook - COMPLETE

**Status**: ✅ Successfully deployed  
**Date**: 2025-10-18  
**Version**: Universal Classification v1.0 (Shadow Mode)

---

## ✅ Deployment Summary

### What Was Deployed

**Worker**: `optiview-audit-worker`
- URL: https://api.optiview.ai
- Classifier v2 running in shadow mode
- Health monitoring active
- Circuit breaker ready (AI disabled)

**Frontend**: `geodude-app`
- URL: https://app.optiview.ai
- Health dashboard: `/admin/health`
- Classifier compare: `/admin/classifier-compare`

**Database**: `optiview` (D1)
- Migration 0010 applied: `metadata` column added
- KV namespace: `RULES` (classifier cache)

---

## 🧪 Smoke Test Commands

```bash
# Test health endpoint
curl -s "https://api.optiview.ai/api/admin/classifier-health" | jq

# Test classifier compare (example)
curl -s "https://api.optiview.ai/api/admin/classifier-compare?host=nike.com" | jq '.v2.site_type'
```

---

## 📊 Admin Tools

| Tool | URL | Purpose |
|------|-----|---------|
| Health Dashboard | https://app.optiview.ai/admin/health | Real-time metrics & alerts |
| Classifier Compare | https://app.optiview.ai/admin/classifier-compare | Legacy vs v2 comparison |
| Main Admin | https://app.optiview.ai/admin | Audit management |

---

## 🎯 Testing Checklist (Next 48-72h)

### Step 1: Verify Deployment
- [x] Worker deployed successfully
- [x] Frontend deployed successfully
- [x] D1 migration applied
- [ ] Health endpoint responds
- [ ] Compare endpoint responds

### Step 2: Test Existing Audits
- [ ] Open last 5-10 audits
- [ ] Check classifier compare for each domain
- [ ] Verify site_type/industry agreement (~80-85%)
- [ ] Verify site_mode and brand_kind make sense

### Step 3: Run Fresh Audits

**Retail & E-commerce:**
- [ ] nike.com (expect: ecommerce, retail, brand_store)
- [ ] fender.com (expect: ecommerce, retail, manufacturer)

**Automotive:**
- [ ] lexus.com (expect: corporate, automotive, brand_marketing)
- [ ] toyota.com (expect: corporate/ecommerce, automotive)

**Finance:**
- [ ] amex.com (expect: financial, finance, convert)
- [ ] chase.com (expect: financial, finance)

**Travel:**
- [ ] united.com (expect: ecommerce/corporate, travel, sell)
- [ ] marriott.com (expect: ecommerce, travel)

**Software/Docs:**
- [ ] openai.com (expect: software/corporate, software)
- [ ] github.com (expect: software, docs_site if on docs.*)

**Media:**
- [ ] nytimes.com (expect: media, media, inform)
- [ ] bbc.com (expect: media, media)

**Gov/Edu (Override Tests):**
- [ ] usa.gov (expect: corporate, **government** forced)
- [ ] harvard.edu (expect: corporate, **education** forced)

**International:**
- [ ] rakuten.co.jp (expect: marketplace, retail, lang=ja)

### Step 4: Monitor Health Dashboard
- [ ] Visit `/admin/health`
- [ ] Cache hit rate ≥80% (after 6-12h warmup)
- [ ] P95 latency ≤25ms
- [ ] Site type agreement ≥80%
- [ ] Industry agreement ≥70%
- [ ] Low confidence rate <15%
- [ ] Error rate <0.5%

---

## 📝 What to Look For

### Quality Signals (Good)
- ✅ `category_terms` feel brand-accurate
- ✅ `purpose` aligns with page intent (sell/inform/convert/assist)
- ✅ `site_mode` and `brand_kind` obviously correct
- ✅ `lang`/`region` detected properly
- ✅ `confidence` mostly ≥0.7
- ✅ No performance regressions

### Red Flags (Bad)
- ❌ Cache hit rate <60% after warmup
- ❌ Agreement rate <75% for site_type
- ❌ Error rate >1%
- ❌ Low confidence spike (>25%)
- ❌ Latency >50ms p95

---

## 🚨 Rollback Plan

### If Issues Detected

**Disable shadow mode** (if classifier crashes audits):
```bash
# Set environment variable to disable
wrangler secret put CLASSIFIER_V2_ENABLED
# Enter: 0
```

**Clear KV cache** (if bad data cached):
```bash
# Delete specific domain
wrangler kv:key delete --binding=RULES "optiview:classify:v1:${host}"

# Or flush all (nuclear option)
# Manually via Cloudflare dashboard
```

**Revert deployment** (if critical):
```bash
cd packages/audit-worker
# Rollback to previous version ID
wrangler rollback --message "Rollback classifier v2"
```

---

## 🎯 Go/No-Go Criteria

After 48-72h of shadow mode operation:

### ✅ GO Criteria
- Cache hit rate ≥80%
- P95 latency ≤25ms
- Site type agreement ≥85% OR v2 has higher confidence with JSON-LD support
- Low confidence rate <15%
- Error rate <0.5%
- Zero material performance regressions

### 🔄 Phase 2 Enablement (When Ready)
```bash
# Enable AI layer (Workers AI)
wrangler secret put CLASSIFIER_AI_ENABLED
# Enter: 1

# Monitor circuit breaker state
curl -s "https://api.optiview.ai/api/admin/classifier-health" | jq '.circuit_breaker'
```

### 🚀 Phase 3 Promotion (Week 4+)
```bash
# Flip prompts to use v2
# Add to wrangler.toml:
# [vars]
# CLASSIFIER_V2_PROMPTS = "1"

wrangler deploy
```

---

## 📊 Telemetry Events to Monitor

```bash
# Classification v2 logged events
grep "classification_v2_logged" logs

# Health alerts
grep "classifier_health_alert" logs

# Cache hit/miss ratio
grep "CLASSIFY_V2" logs | grep -E "(Cache hit|Computed for)"

# Errors
grep "CLASSIFY_V2.*Error" logs
```

---

## 🔧 Weight Tuning (If Needed)

If a domain is consistently misclassified:

1. Open `/admin/classifier-compare?host=<domain>`
2. Note: `v2.site_type.value`, `v2.confidence`, `v2.signals`
3. If confidence ≥0.75 but wrong → adjust weights in `lib/weights.ts`
4. Document change in `WEIGHTS_CHANGELOG.md`
5. Test on 10+ diverse domains
6. Deploy and monitor for 24h

---

## 📞 Support

**Documentation:**
- Core implementation: `PHASE_1_CLASSIFIER_V2_COMPLETE.md`
- Hardening: `PHASE_1_HARDENING_COMPLETE.md`
- This runbook: `DEPLOYMENT_RUNBOOK_COMPLETE.md`

**Admin Tools:**
- Health: https://app.optiview.ai/admin/health
- Compare: https://app.optiview.ai/admin/classifier-compare

---

## ✅ Deployment Complete!

**Current Status**: Shadow mode active, collecting data  
**Next Milestone**: 48-72h monitoring → Go/No-Go decision  
**Phase 2**: AI layer (feature flag ready)  
**Phase 3**: Prompt promotion (kill switch ready)

🚀 **Ready to test!** Start by running fresh audits and monitoring the health dashboard.

