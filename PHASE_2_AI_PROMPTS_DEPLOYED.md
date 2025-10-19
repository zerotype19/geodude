# 🚀 Phase 2: AI Prompt Generation - DEPLOYED

**Status**: ✅ Live in Shadow Mode  
**Date**: 2025-10-18  
**Worker Version**: `59b4a077-2d0d-41a7-8f70-04f3d0cd7a77`

---

## ✅ What Was Deployed

### **New Files Created**

1. **`/packages/audit-worker/src/prompts/promptGeneratorAI.ts`**
   - Workers AI integration (Llama 3.1-8b-instruct)
   - Context-aware prompt engineering
   - Branded/non-branded query generation
   - KV caching (7-day TTL)
   - Shadow-safe fallback (returns `[]` on failure)

2. **`/packages/audit-worker/src/prompts/promptBlender.ts`**
   - Fuzzy deduplication (Jaccard similarity)
   - AI + rule-based prompt merging
   - Realism scoring heuristic
   - Intent variety detection

3. **`/packages/audit-worker/src/routes/llm-prompts.ts` (Updated)**
   - Added `?mode=rules|ai|blended` parameter
   - Integrated AI generation with circuit breaker
   - Backward-compatible (defaults to `rules`)
   - Shadow mode ready

---

## 🎯 API Usage

### **Endpoint**: `GET /api/llm/prompts`

#### **Parameters**:
- `domain` (required): Domain to generate prompts for
- `mode` (optional): `rules` | `ai` | `blended` (default: `rules`)
- `refresh` (optional): `true` to force cache refresh

#### **Examples**:

```bash
# Rules-only (existing behavior)
curl "https://api.optiview.ai/api/llm/prompts?domain=americanexpress.com"

# AI-generated prompts
curl "https://api.optiview.ai/api/llm/prompts?domain=americanexpress.com&mode=ai"

# Blended (AI + rules, best quality)
curl "https://api.optiview.ai/api/llm/prompts?domain=americanexpress.com&mode=blended"
```

---

## 📊 Response Format

```json
{
  "source": "blended",
  "branded": [
    "Is American Express safe for online purchases?",
    "Does Amex charge foreign transaction fees?",
    "Amex Platinum vs Chase Sapphire Reserve",
    "What credit score do I need for Amex Gold?",
    ...
  ],
  "nonBranded": [
    "Best credit cards for international travel with no FX fees",
    "How to dispute a fraudulent charge on my card",
    "Are credit card rewards worth the annual fee?",
    ...
  ],
  "meta": {
    "brand": "American Express",
    "site_type": "financial",
    "industry": "finance",
    "purpose": "convert",
    "category_terms": ["credit card", "payment platform"],
    "nav_terms": ["rewards", "travel", "membership"],
    ...
  },
  "realism_score": 0.82,
  "model": "@cf/meta/llama-3.1-8b-instruct",
  "ai_cached": false
}
```

---

## 🛡️ Safety & Cost Controls

### **Circuit Breaker**
- Threshold: 5 consecutive failures
- Reset: Every 5 minutes
- Behavior: Auto-disable AI on high error rate, fallback to rules

### **Caching**
- **KV Key**: `optiview:ai_prompts:v1:${domain}`
- **TTL**: 7 days
- **Namespace**: `PROMPT_CACHE`

### **Cost**
- **Model**: Llama 3.1-8b-instruct (Workers AI)
- **Per domain**: ~$0.002-0.005
- **Tokens**: ~600 max (20 queries @ 30 tokens each)
- **Temperature**: 0.6 (balanced creativity)

---

## 🧪 Testing Guide

### **1. Test Rules-Only (Baseline)**
```bash
curl "https://api.optiview.ai/api/llm/prompts?domain=nike.com" | jq
```

Expected: Template-based queries (existing behavior)

### **2. Test AI Generation**
```bash
curl "https://api.optiview.ai/api/llm/prompts?domain=nike.com&mode=ai" | jq
```

Expected: Natural language queries with human phrasing

### **3. Test Blended (Recommended)**
```bash
curl "https://api.optiview.ai/api/llm/prompts?domain=nike.com&mode=blended" | jq
```

Expected: Best of both (AI + rules, deduplicated)

### **4. Test Domains to Try**

| Domain | Industry | Expected AI Quality |
|--------|----------|---------------------|
| `americanexpress.com` | Finance | High (clear brand, strong intent) |
| `fender.com` | Retail | High (music/instruments) |
| `lexus.com` | Automotive | High (build & price, models) |
| `nike.com` | Retail | High (sportswear, apparel) |
| `openai.com` | Software | Medium (docs/API focus) |
| `nytimes.com` | Media | Medium (articles, news) |

### **5. Quality Indicators**

✅ **Good AI Output**:
- Natural conversational phrasing
- Mix of question types (what, how, vs, best)
- Specific intent (trust, cost, features, comparison)
- 10-12 branded + 12-16 non-branded queries
- `realism_score` > 0.7

❌ **Poor AI Output** (fallback working):
- Empty arrays (`branded: []`, `nonBranded: []`)
- Circuit breaker triggered
- Falls back to rules automatically
- `realism_score` = 0.4

---

## 📈 Monitoring & Telemetry

### **Logs to Watch**

```bash
# AI prompt generation
grep "AI_PROMPTS" logs

# Circuit breaker events
grep "Circuit breaker" logs

# Cache hits/misses
grep "ai_cached" logs
```

### **Key Metrics**

- **Cache hit rate**: Target ≥80% after warmup
- **AI success rate**: Target ≥95%
- **Circuit breaker trips**: Should be rare (<1%)
- **Realism score**: Average ≥0.75 for AI/blended

---

## 🔄 Rollout Plan

### **Phase 1: Shadow Mode (Current) - Week 1**
- ✅ AI generation live, **not used for scoring**
- ✅ All citations continue using `mode=rules`
- ✅ Admin can test `mode=ai` and `mode=blended` manually
- ✅ Collect metrics on quality, cost, performance

### **Phase 2: A/B Test - Week 2**
- [ ] 50% of domains use `mode=blended` for citations
- [ ] 50% continue with `mode=rules`
- [ ] Compare citation coverage, query quality, LLM response rates
- [ ] Track cost per domain

### **Phase 3: Promote to Default - Week 3**
- [ ] If AI-blended shows ≥20% improvement in coverage or realism
- [ ] Make `mode=blended` default for all new audits
- [ ] Keep `mode=rules` as fallback

---

## 🧩 Admin Tools (Coming Next)

### **Prompts Compare View** (Optional)
- Route: `/admin/prompts-compare?domain=X`
- Side-by-side: Rules | AI | Blended
- Quality metrics per mode
- Copy-to-clipboard buttons
- Realism score comparison

*Note: This is optional for now. You can test via API directly.*

---

## 🎯 Expected Improvements

| Metric | Rules-Only | AI-Blended | Delta |
|--------|-----------|------------|-------|
| Realism Score | 0.4 | 0.75+ | +88% |
| Query Diversity | Low | High | ++ |
| Intent Coverage | Narrow | Broad | ++ |
| Brand Voice | Generic | Specific | ++ |
| Cost per Domain | $0 | $0.003 | +$0.003 |

---

## 🚨 Rollback Procedure

If issues arise:

### **1. Disable AI Completely**
Update the circuit breaker threshold to 0:
```typescript
// In llm-prompts.ts, line 14:
threshold: 0  // Forces circuit open
```

### **2. Force Rules-Only for All**
Remove `mode` parameter support, always return rules.

### **3. Clear KV Cache**
```bash
# Delete all AI prompt caches
wrangler kv:key list --binding=PROMPT_CACHE --prefix="optiview:ai_prompts:v1:"
# Then delete manually via dashboard
```

---

## ✅ Success Criteria

After 7 days of shadow mode:

- [ ] Cache hit rate ≥80%
- [ ] AI success rate ≥95%
- [ ] Circuit breaker trips <1%
- [ ] Average realism score ≥0.75
- [ ] Cost per domain <$0.01
- [ ] No performance regressions
- [ ] Qualitative review: 5+ domains show clearly better prompts

---

## 🎉 Summary

**Phase 2 AI Prompt Generation is LIVE in shadow mode!**

- ✅ Workers AI integrated (Llama 3.1-8b)
- ✅ Three modes: rules, ai, blended
- ✅ Circuit breaker protection
- ✅ 7-day KV caching
- ✅ Backward-compatible
- ✅ Shadow-safe (no breaking changes)

**Test it now:**
```bash
curl "https://api.optiview.ai/api/llm/prompts?domain=americanexpress.com&mode=blended" | jq
```

**Ready for production testing!** 🚀

