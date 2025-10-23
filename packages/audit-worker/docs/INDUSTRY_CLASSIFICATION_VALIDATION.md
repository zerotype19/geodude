# Industry Classification Validation & Monitoring

## 🎯 Summary

This document describes the validation and monitoring system for industry classification after the **AI-first priority reordering** fix.

---

## ✅ What Was Fixed

### Before (BROKEN):
```
Priority Order:
1. Explicit override
2. Project override
3. Already locked
4. Domain rules
5. Heuristics (score ≥ 0.6) ← BLOCKED AI
6. AI Classifier ← NEVER REACHED
7. Default (generic_consumer)
```

**Problem**: Adobe at 35% AI confidence was rejected (threshold 40%), and heuristics prevented AI from running at all if they found any match.

### After (FIXED):
```
Priority Order:
1. Explicit override
2. Project override
3. Already locked
4. Domain rules (whitelist)
5. AI Classifier (PRIMARY) ← ALWAYS RUNS
   - Threshold: 0.35 (was 0.40)
   - Schema boost: +5% if schema.org matches
   - Fusion boost: +15% if heuristics agrees
6. Heuristics (fallback only)
7. Default (generic_consumer)
```

**Result**: Adobe now gets 35% + 5% (schema) + 15% (heuristics) = **55% confidence** → `saas_b2b` ✅

---

## 🧪 Canary Test

### Endpoint
```
GET /api/admin/canary-test
Requires: Admin authentication
```

### What It Tests
14 representative domains across industries:
- **SaaS B2B**: adobe.com, salesforce.com, workday.com, intuit.com
- **Automotive**: toyota.com, tesla.com
- **Retail**: costco.com, bestbuy.com
- **Media**: cnn.com, nytimes.com
- **Travel Air**: southwest.com, delta.com
- **Healthcare**: mayoclinic.org, clevelandclinic.org

### Success Criteria
- ✅ **95%+ pass rate** (correct industry match)
- ✅ **0% generic_consumer** (no fallbacks)
- ✅ **Average confidence ≥ 0.40** (after fusion)

### Example Response
```json
{
  "pass": true,
  "passRate": 100,
  "genericRate": 0,
  "avgConfidence": 0.527,
  "passCount": 14,
  "totalCount": 14,
  "assertions": {
    "pass_rate_95pct": "✅ PASS",
    "no_generic_consumer": "✅ PASS",
    "avg_confidence_40pct": "✅ PASS"
  },
  "results": [
    {
      "domain": "adobe.com",
      "status": "✅ PASS",
      "expected": "saas_b2b",
      "actual": "saas_b2b",
      "confidence": 0.550,
      "source": "ai_worker_medium_conf"
    },
    ...
  ]
}
```

### How to Run
```bash
# Via curl (with admin cookie)
curl -H "Cookie: ov_sess=YOUR_ADMIN_COOKIE" \
  https://api.optiview.ai/api/admin/canary-test | jq '.'

# Via admin panel (future)
# https://app.optiview.ai/admin → "Run Canary Tests"
```

### When to Run
- ✅ Before deploying classification changes
- ✅ After modifying AI prompts or confidence thresholds
- ✅ Daily as part of health monitoring
- ✅ After adding new domain rules to whitelist
- ✅ When investigating classification regressions

---

## 📊 SQL Monitoring Queries

Location: `packages/audit-worker/docs/industry-monitoring-queries.sql`

### Key Queries

#### 1. Generic Consumer Rate (Alert if > 20%)
```sql
SELECT 
  COUNT(*) AS total_audits,
  SUM(CASE WHEN industry = 'generic_consumer' THEN 1 ELSE 0 END) AS generic_count,
  ROUND(100.0 * SUM(...) / COUNT(*), 1) AS pct_generic
FROM audits
WHERE started_at >= datetime('now', '-3 days');
```

**Target**: < 20%
**Action**: If > 20%, check if AI is running (see query #3)

#### 2. AI Invocation Rate (Alert if < 60%)
```sql
SELECT 
  CASE WHEN industry_source LIKE '%ai%' THEN 'AI' ... END AS source,
  ROUND(100.0 * COUNT(*) / ..., 1) AS pct
FROM audits
WHERE started_at >= datetime('now', '-3 days')
GROUP BY source;
```

**Target**: AI > 60%
**Action**: If < 60%, AI might be blocked again

#### 3. Alert Thresholds Summary
```sql
-- Returns pass/fail for all thresholds at once
-- See industry-monitoring-queries.sql, Query #10
```

**Output**:
```
Generic Consumer Rate  | 15.3%  | < 20%  | ✅ PASS
AI Invocation Rate     | 72.1%  | > 60%  | ✅ PASS
Heuristics Override    |  8.2%  | < 15%  | ✅ PASS
```

#### 4. Time Series Trending (Detect Regressions)
```sql
-- Shows generic_consumer rate by day (last 14 days)
-- Use to spot sudden spikes
SELECT DATE(started_at), pct_generic, ai_used
FROM audits
GROUP BY DATE(started_at);
```

**Action**: If generic rate spikes suddenly, check recent deployments

---

## 🔍 Schema Boost Feature

### How It Works
When the AI classifies a site, we check if schema.org types match the predicted industry:

```typescript
// Example: AI predicts saas_b2b at 38% confidence
// Site has schema: ["Organization", "SoftwareApplication"]
// Schema boost: +5% → 43% final confidence ✅
```

### Schema Mappings
| Industry | Schema Types |
|----------|--------------|
| `saas_b2b` | SoftwareApplication, SaaSApplication |
| `automotive_oem` | Car, Vehicle, AutomobileDealer |
| `retail` | Store, Product, OnlineStore |
| `financial_services` | FinancialService, BankAccount |
| `healthcare_provider` | Physician, Hospital, Clinic |
| `travel_air` | Airline, Flight |
| `media_entertainment` | NewsArticle, NewsMediaOrganization |
| ... | (see calculateSchemaBoost() for full list) |

### Impact
- Boosts borderline AI predictions (35-40%) over the threshold
- Reduces false negatives for sites with clear structured data
- Works in combination with heuristics fusion (+15%)

---

## 🚨 Guardrails & Alerts

### Recommended Alert Setup

```yaml
# Generic Consumer Rate
- Metric: pct_generic_consumer
  Threshold: > 20%
  Severity: WARNING
  Action: Investigate AI invocation rate

# AI Invocation Rate
- Metric: pct_ai_invoked
  Threshold: < 60%
  Severity: CRITICAL
  Action: Check if AI classifier is running

# Heuristics Override Rate
- Metric: pct_heuristics_overruled_ai
  Threshold: > 15%
  Severity: WARNING
  Action: Check if priority order reverted
```

### How to Monitor
1. **Run SQL Query #10** daily (Alert Thresholds Summary)
2. **Check Canary Tests** before each deployment
3. **Review Time Series** (Query #7) weekly for trends
4. **Spot-Check Audits**: Randomly sample 10-20 recent audits

---

## 📈 Expected Baseline Metrics (Post-Fix)

Based on the fix deployment:

| Metric | Target | Acceptable Range |
|--------|--------|------------------|
| Generic Consumer Rate | < 15% | 10-20% |
| AI Invocation Rate | > 70% | 60-85% |
| Domain Rules (Whitelist) | 10-15% | 5-20% |
| Heuristics Fallback | < 10% | 5-15% |
| Average AI Confidence | > 0.50 | 0.45-0.70 |
| Canary Pass Rate | 100% | ≥ 95% |

---

## 🛠️ Troubleshooting

### Issue: High Generic Consumer Rate (> 25%)

**Symptoms**:
- Many audits classified as `generic_consumer`
- Low AI invocation rate

**Diagnosis**:
1. Run Query #3 (AI vs Heuristics)
2. Check if `pct_ai_invoked < 60%`

**Possible Causes**:
- AI classifier disabled (`FEATURE_INDUSTRY_AI_CLASSIFY=0`)
- Heuristics gate re-introduced (check `industry.ts` line 169)
- AI timeout increased (check line 184, should be 8000ms)

**Fix**:
```typescript
// Verify this line exists:
const shouldCallAI = ctx.env?.FEATURE_INDUSTRY_AI_CLASSIFY !== '0' && ctx.root_url;

// NOT this:
const shouldCallAI = !heuristicsResult && ...  // ← WRONG!
```

---

### Issue: Canary Tests Failing (< 95% pass)

**Symptoms**:
- Known domains (adobe.com, cnn.com) returning wrong industry
- Confidence scores < 0.35

**Diagnosis**:
1. Run `/api/admin/canary-test`
2. Check which domains failed
3. Review logs for those domains

**Possible Causes**:
- Confidence threshold raised back to 0.40 (check line 193)
- Schema boost removed (check line 197-199)
- Fusion logic disabled (check line 203-205)

**Fix**:
```typescript
// Verify threshold is 0.35:
if (result.primary.confidence >= 0.35) {  // NOT 0.40!

// Verify schema boost exists:
const schemaBoost = calculateSchemaBoost(...);
const boostedAI = Math.min(1.0, result.primary.confidence + schemaBoost);

// Verify fusion exists:
const finalConfidence = heuristicsAgrees 
  ? Math.min(1.0, boostedAI + 0.15)
  : boostedAI;
```

---

### Issue: Sudden Spike in Generic Rate

**Symptoms**:
- Query #7 (Time Series) shows sudden jump
- Was 15%, now 40% overnight

**Diagnosis**:
1. Check recent deployments (within 24h)
2. Run canary tests
3. Compare logs before/after

**Possible Causes**:
- Code regression (AI-first logic reverted)
- KV domain rules cleared
- AI model endpoint changed

**Fix**:
1. Roll back deployment
2. Run canary tests on previous version
3. Identify code change that caused regression
4. Add test coverage for that scenario

---

## 🎯 Next Steps

### Immediate (Week 1)
- [ ] Run canary tests daily
- [ ] Monitor SQL Query #10 (Alert Thresholds)
- [ ] Add `industry_confidence` column to audits table
- [ ] Spot-check 20 random recent audits

### Short-term (Week 2-4)
- [ ] Expand domain whitelist (Fortune 500)
- [ ] Add automated alerting (Slack/email)
- [ ] Create admin UI for canary tests
- [ ] Backfill `generic_consumer` audits from last 30 days

### Long-term (Month 2+)
- [ ] Collect AI confidence distribution data
- [ ] A/B test different confidence thresholds
- [ ] Train custom industry classifier model
- [ ] Auto-populate domain whitelist from high-conf AI results

---

## 📝 Log Examples

### Successful AI Classification (Post-Fix)
```
[INDUSTRY_AI] adobe.com → saas_b2b (conf: 0.350, schema: +0.05, final: 0.550, heuristics: agrees, source: ai_worker_medium_conf)
```

**What This Shows**:
- AI ran ✅
- Confidence: 35% (at threshold)
- Schema boost: +5% (SoftwareApplication found)
- Heuristics agreed: +15% boost
- Final: 55% → Classified as `saas_b2b` ✅

### Before Fix (AI Blocked)
```
[INDUSTRY_AI] adobe.com → saas_b2b (conf: 0.350) - TOO LOW, using default
[INDUSTRY_DEFAULT] adobe.com → generic_consumer
```

**Problem**: 35% rejected, no fusion, no schema boost.

---

## 🔗 Related Files

- `src/lib/industry.ts` - Main classification logic
- `src/routes/canary-test.ts` - Canary test endpoint
- `docs/industry-monitoring-queries.sql` - SQL queries
- `src/config/industry-packs.default.json` - Domain whitelist

---

**Last Updated**: Oct 23, 2025
**Version**: 1.0 (Post AI-First Fix)
**Worker Version**: 1bda47ce-8a35-42f9-b7eb-3ef522df2508

