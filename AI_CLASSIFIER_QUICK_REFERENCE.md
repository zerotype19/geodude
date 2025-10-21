# AI Industry Classifier - Quick Reference

**Version:** ind-v1.1-heuristic  
**Deployed:** 753e5038-7c8e-4c2b-861c-25f788f7b784  
**Status:** ✅ LIVE

---

## 🚀 Quick Commands

### Test the Classifier API
```bash
curl -X POST https://api.optiview.ai/industry/classify \
  -H 'Content-Type: application/json' \
  -d '{
    "domain": "seabourn.com",
    "root_url": "https://www.seabourn.com/",
    "site_description": "Luxury cruise line",
    "crawl_budget": {"homepage": true, "timeout_ms": 5000}
  }' | jq .
```

### Monitor Live Classification
```bash
npx wrangler tail --env production | grep -E "(INDUSTRY_AI|resolved:)"
```

### Run Backfill (All Existing Audits)
```bash
# WARNING: This will classify up to 100 audits at a time
curl "https://api.optiview.ai/scripts/backfill-ai-industries?confirm=yes"
```

### Check Industry Distribution
```bash
npx wrangler d1 execute optiview --remote --command \
  "SELECT industry, industry_source, COUNT(*) as count 
   FROM audits 
   GROUP BY industry, industry_source 
   ORDER BY count DESC"
```

### View Recent Classifications
```bash
npx wrangler d1 execute optiview --remote --command \
  "SELECT root_url, industry, industry_source, industry_locked, started_at 
   FROM audits 
   WHERE industry_source IN ('ai_worker', 'ai_worker_low_conf') 
   ORDER BY started_at DESC 
   LIMIT 20"
```

---

## 🎯 How It Works (TL;DR)

```
New Audit → Domain in KV? 
  ├─ Yes → Use KV mapping ✅
  └─ No → Call AI Classifier 🤖
           ├─ Confidence ≥ 0.80 → Lock + Update KV
           └─ Confidence < 0.80 → Use generic_consumer
```

**Key Points:**
- AI only runs for **unmapped** domains
- 3-second timeout (non-blocking)
- Auto-updates KV after high-confidence (≥0.80) classifications
- System learns and gets faster over time

---

## 📊 Current Coverage

**31 Domains Mapped:**
- 11 Automotive OEM
- 8 Travel - Cruise ⭐ NEW
- 4 Retail
- 3 Financial Services
- 2 Healthcare
- 2 Travel - Air
- 1 Travel - Hotels

**Infinite domains learnable via AI!**

---

## 🔧 Configuration

### Feature Flags (wrangler.toml)
```toml
FEATURE_INDUSTRY_LOCK = "1"
FEATURE_INTENT_GUARDS = "1"
FEATURE_SOURCE_CIRCUIT = "1"
FEATURE_INDUSTRY_AI_CLASSIFY = "1"  ← NEW
```

### Lock Policy
```typescript
confidence >= 0.80  → Lock + Update KV
confidence <  0.80  → Use generic_consumer (safe fallback)
```

### Heuristic Weights
```typescript
[0.5, 0.3, 0.2]  // heuristics, domain, embeddings/LLM
```

---

## 🐛 Troubleshooting

### AI Not Running?
```bash
# Check feature flag
npx wrangler tail | grep "FEATURE_INDUSTRY_AI_CLASSIFY"

# Should see: FEATURE_INDUSTRY_AI_CLASSIFY: "1"
```

### Low Confidence Scores?
```bash
# View evidence from last classification
curl -X POST https://api.optiview.ai/industry/classify \
  -d '{"domain":"example.com","root_url":"https://example.com/"}' \
  | jq '.evidence'
```

**Common Causes:**
- Homepage has little text
- Missing industry-specific terms
- Generic title/description

**Solutions:**
- Add more heuristic patterns
- Lower confidence threshold to 0.70
- Enhance site_description in audit form

### KV Not Updating?
```bash
# Check KV manually
npx wrangler kv:key get --namespace-id="0247b816db7b4540ada69dd9f842f543" \
  industry_packs_json | jq '.industry_rules.domains'
```

---

## 🎯 Success Metrics

✅ **Before:** nissan.com → generic_consumer  
✅ **After:** nissan.com → automotive_oem

✅ **Before:** Manual SQL for every new domain  
✅ **After:** Auto-classify + auto-learn (zero-touch)

✅ **Before:** 403 errors blocked classification  
✅ **After:** Falls back to site_description + domain tokens

✅ **Before:** 23 domains mapped  
✅ **After:** 31 domains mapped (+ infinite learnable)

---

## 🔄 Rollback Plan

### Disable AI Classification
```bash
printf "0" | npx wrangler secret put FEATURE_INDUSTRY_AI_CLASSIFY --env production
cd packages/audit-worker && npx wrangler deploy
```

**Impact:** System reverts to domain rules + basic heuristics only.

### Re-enable
```bash
printf "1" | npx wrangler secret put FEATURE_INDUSTRY_AI_CLASSIFY --env production
cd packages/audit-worker && npx wrangler deploy
```

---

## 📈 Tuning Guide

### Lower Threshold (More Aggressive)
```typescript
// src/index.ts, line ~2130
if (classifyResult.primary.confidence >= 0.70) {  // was 0.80
  // Lock and update KV
}
```

### Add Industry Pattern
```typescript
// src/lib/industry-classifier.ts
const HEURISTICS: Record<IndustryKey, RegExp[]> = {
  automotive_oem: [
    // Add new pattern:
    /\b(new\s*cars|used\s*cars|trade-in|lease)\b/i,
  ],
}
```

### Adjust Weights
```typescript
// src/lib/industry-classifier.ts, fuseScores()
const weights = [0.6, 0.3, 0.1];  // More weight on heuristics
```

---

## 📚 Files

**Core:**
- `src/lib/industry-classifier.ts` - Classifier logic
- `src/routes/industry-classify.ts` - API endpoint
- `src/index.ts` - Integration (lines 2114-2155)

**Config:**
- `src/config/industry-packs.default.json` - Domain mappings (31 domains)
- `wrangler.toml` - Feature flags

**Scripts:**
- `scripts/backfill-ai-industries.ts` - Backfill worker
- `backfill-cruise-domains.sh` - SQL backfill helper

**Docs:**
- `AI_INDUSTRY_CLASSIFIER_READY.md` - Full documentation
- `AI_CLASSIFIER_QUICK_REFERENCE.md` - This file

---

## 🎉 What's Next?

1. **Run backfill** to classify existing audits
2. **Monitor logs** to see AI in action
3. **Create test audits** for unmapped domains
4. **Tune patterns** based on real-world results
5. **Watch KV grow** as system learns

---

**Questions?** Check logs or test the API directly! 🚀

