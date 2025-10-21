# Industry Lock - Go-Live Checklist & Smoke Tests

**Priority**: P0  
**Duration**: 15-30 minutes  
**Purpose**: Verify industry lock works across all industries, not just Toyota

---

## ✅ Pre-Deployment Checklist

### 1. Feature Flags

**Required Environment Variables:**

```bash
# In wrangler.toml or Worker secrets
FEATURE_INDUSTRY_LOCK=1
FEATURE_INTENT_GUARDS=1
FEATURE_SOURCE_CIRCUIT=1
```

**Verify:**
```bash
# Check wrangler.toml
grep -E "FEATURE_(INDUSTRY_LOCK|INTENT_GUARDS|SOURCE_CIRCUIT)" wrangler.toml

# Or check deployed worker
curl https://api.optiview.ai/api/config | jq '.features'
```

---

### 2. KV Bindings

**Required in `wrangler.toml`:**

```toml
[[kv_namespaces]]
binding = "DOMAIN_RULES_KV"
id = "<your_kv_namespace_id>"
```

**Verify binding exists:**
```bash
npx wrangler kv:namespace list
```

**Set initial KV data:**
```bash
# Create KV payload file
cat > industry_packs.json << 'EOF'
{
  "industry_rules": {
    "default_industry": "generic_consumer",
    "domains": {
      "toyota.com": "automotive_oem",
      "ford.com": "automotive_oem",
      "gm.com": "automotive_oem",
      "bestbuy.com": "retail",
      "target.com": "retail",
      "delta.com": "travel_air",
      "united.com": "travel_air",
      "chase.com": "financial_services",
      "wellsfargo.com": "financial_services",
      "mayoclinic.org": "healthcare_provider",
      "clevelandclinic.org": "healthcare_provider",
      "salesforce.com": "saas",
      "slack.com": "saas",
      "zara.com": "retail"
    }
  },
  "packs": {
    "generic_consumer": {
      "allow_tags": ["pricing", "reviews", "reliability", "warranty", "safety_ratings", "customer_service"]
    },
    "automotive_oem": {
      "allow_tags": [
        "msrp", "build_price", "trim_compare", "dealer_locator", 
        "financing", "lease", "warranty", "maintenance", 
        "reliability", "safety_ratings", "iihs", "nhtsa", 
        "towing", "cargo", "range", "mpg", "cpo", 
        "certified_preowned", "owners_manual", "recalls", 
        "test_drive", "trade_in"
      ],
      "deny_phrases": [
        "return policy", "free returns", "promo code", 
        "store credit", "shipping", "exchange policy", 
        "gift card", "add to cart"
      ],
      "inherits": ["generic_consumer"]
    },
    "retail": {
      "allow_tags": [
        "price", "discounts", "sales", "availability", 
        "store_locator", "shipping", "returns", "in_stock", 
        "pickup", "delivery"
      ],
      "deny_phrases": [
        "iihs", "nhtsa", "towing capacity", "mpg", 
        "trim levels", "dealer"
      ],
      "inherits": ["generic_consumer"]
    },
    "financial_services": {
      "allow_tags": [
        "rates", "apr", "eligibility", "prequalify", 
        "fees", "coverage", "claims", "branch_locator", 
        "atm_locator", "mortgage", "credit_score"
      ],
      "deny_phrases": [
        "shipping", "return policy", "in stock"
      ],
      "inherits": ["generic_consumer"]
    },
    "travel_air": {
      "allow_tags": [
        "baggage", "fare_classes", "loyalty_miles", 
        "status_benefits", "change_policy", "cancellation", 
        "on_time", "route_map", "check_in", "seat_selection"
      ],
      "deny_phrases": [
        "return policy", "shipping", "towing capacity"
      ],
      "inherits": ["generic_consumer"]
    },
    "healthcare_provider": {
      "allow_tags": [
        "conditions", "treatments", "specialties", 
        "find_a_doctor", "locations", "insurance", 
        "appointments", "patient_portal", "emergency"
      ],
      "deny_phrases": [
        "shipping", "return policy", "gift card"
      ],
      "inherits": ["generic_consumer"]
    },
    "saas": {
      "allow_tags": [
        "pricing_tiers", "plans", "security", "compliance", 
        "sla", "integrations", "api_docs", "status_page", 
        "case_studies", "support", "enterprise"
      ],
      "deny_phrases": [
        "shipping", "return policy", "in stock"
      ],
      "inherits": ["generic_consumer"]
    }
  }
}
EOF

# Upload to KV
npx wrangler kv:key put --namespace-id=<YOUR_KV_ID> \
  "industry_packs_json" \
  --path=industry_packs.json
```

**Verify KV upload:**
```bash
npx wrangler kv:key get --namespace-id=<YOUR_KV_ID> "industry_packs_json"
```

---

### 3. Database Migration

**Verify columns exist:**

```bash
npx wrangler d1 execute optiview --remote \
  --command="PRAGMA table_info(audits)"
```

**Expected columns:**
- `industry` (TEXT)
- `industry_source` (TEXT)
- `industry_locked` (INTEGER, DEFAULT 1)

**If missing, run migration:**
```bash
npx wrangler d1 execute optiview --remote \
  --file=./migrations/2025-10-22_industry_lock.sql
```

---

### 4. Code Wiring Verification

**Check these patterns exist in code:**

#### A. Industry Resolution (Citations Entry Point)
```bash
# Search for industry resolution
grep -r "resolveIndustry" packages/audit-worker/src/
```

**Expected:** Called at start of citations run

#### B. Intent Filtering (Prompts V4)
```bash
# Search for intent filtering
grep -r "filterIntents" packages/audit-worker/src/
```

**Expected:** Called after Llama, before final query list

#### C. Mutation Guards
```bash
# Search for guards
grep -r "guardIndustryMutation\|industry_mutation_blocked" packages/audit-worker/src/
```

**Expected:** Guards in place where industry could be set

#### D. Source Client Wrapper
```bash
# Search for budget wrapper
grep -r "queryWithBudget\|SOURCE.*budget" packages/audit-worker/src/
```

**Expected:** All source calls go through budget wrapper

---

### 5. Logging Verification

**Check for log lines:**

```bash
# Deploy and tail logs
npx wrangler tail --format=pretty
```

**Expected log patterns:**
- `[INDUSTRY] resolved: <industry> (source=<source>) domain=<domain>`
- `[INDUSTRY] Loaded from KV: packs=<N> domain_rules=<N>`
- `[PROMPTS] intents filtered: industry=<industry> kept=<N> dropped=<N>`
- `[GUARD] industry_mutation_blocked` (should be rare/none)
- `[SOURCE] <source>: success=<N> errors=<N> cited=<N>`

---

## 🧪 Smoke Tests (5 Industries)

### Test 1: Toyota (Automotive OEM)

**Run citations for:** `toyota.com`

**Expected Logs:**
```
[INDUSTRY] resolved: automotive_oem (source=domain_rules) domain=toyota.com
[PROMPTS] intents filtered: industry=automotive_oem kept=25 dropped=6
[SOURCE] perplexity: success=18 errors=2 cited=14
```

**Expected Queries (Sample):**
- ✅ "What is the MSRP for a 2024 Toyota RAV4?"
- ✅ "Find Toyota dealers near me"
- ✅ "Toyota RAV4 warranty coverage"
- ✅ "RAV4 safety ratings from IIHS"
- ✅ "Toyota Tacoma towing capacity"

**Denied Queries (Should NOT Appear):**
- ❌ "Toyota return policy"
- ❌ "Free shipping on Toyota parts"
- ❌ "Toyota promo codes"
- ❌ "Gift cards for Toyota store"

**Database Verification:**
```sql
SELECT industry, industry_source, industry_locked 
FROM audits 
WHERE root_url LIKE '%toyota%' 
ORDER BY created_at DESC 
LIMIT 1;

-- Expected: automotive_oem | domain_rules | 1
```

**Acceptance Criteria:**
- [ ] Industry locked to `automotive_oem`
- [ ] No retail queries generated
- [ ] At least 6 queries contain automotive tags
- [ ] Cited count > 0

---

### Test 2: Best Buy (Retail)

**Run citations for:** `bestbuy.com`

**Expected Logs:**
```
[INDUSTRY] resolved: retail (source=domain_rules) domain=bestbuy.com
[PROMPTS] intents filtered: industry=retail kept=23 dropped=3
```

**Expected Queries (Sample):**
- ✅ "Best Buy store locations"
- ✅ "Best Buy shipping options"
- ✅ "Best Buy return policy"
- ✅ "Check product availability"
- ✅ "Best Buy price match"

**Denied Queries (Should NOT Appear):**
- ❌ "IIHS safety ratings"
- ❌ "Towing capacity"
- ❌ "Dealer locator"
- ❌ "Test drive"

**Acceptance Criteria:**
- [ ] Industry locked to `retail`
- [ ] No automotive queries
- [ ] Retail-specific queries present
- [ ] Shipping/returns allowed

---

### Test 3: Delta Airlines (Travel - Air)

**Run citations for:** `delta.com`

**Expected Logs:**
```
[INDUSTRY] resolved: travel_air (source=domain_rules) domain=delta.com
[PROMPTS] intents filtered: industry=travel_air kept=21 dropped=4
```

**Expected Queries (Sample):**
- ✅ "Delta baggage fees"
- ✅ "Delta SkyMiles program"
- ✅ "Flight change policy"
- ✅ "Delta route map"
- ✅ "Seat selection options"

**Denied Queries (Should NOT Appear):**
- ❌ "Return policy"
- ❌ "Towing capacity"
- ❌ "Shipping options"

**Acceptance Criteria:**
- [ ] Industry locked to `travel_air`
- [ ] Travel-specific queries
- [ ] No retail/automotive leakage

---

### Test 4: Chase Bank (Financial Services)

**Run citations for:** `chase.com`

**Expected Logs:**
```
[INDUSTRY] resolved: financial_services (source=domain_rules) domain=chase.com
[PROMPTS] intents filtered: industry=financial_services kept=22 dropped=5
```

**Expected Queries (Sample):**
- ✅ "Chase credit card APR rates"
- ✅ "Mortgage prequalification"
- ✅ "Chase branch locations"
- ✅ "Account fees"
- ✅ "Credit score impact"

**Denied Queries (Should NOT Appear):**
- ❌ "Shipping options"
- ❌ "Return policy"
- ❌ "In stock availability"

**Acceptance Criteria:**
- [ ] Industry locked to `financial_services`
- [ ] Financial queries present
- [ ] No e-commerce leakage

---

### Test 5: Mayo Clinic (Healthcare Provider)

**Run citations for:** `mayoclinic.org`

**Expected Logs:**
```
[INDUSTRY] resolved: healthcare_provider (source=domain_rules) domain=mayoclinic.org
[PROMPTS] intents filtered: industry=healthcare_provider kept=20 dropped=3
```

**Expected Queries (Sample):**
- ✅ "Conditions treated at Mayo Clinic"
- ✅ "Find a doctor"
- ✅ "Insurance accepted"
- ✅ "Appointment scheduling"
- ✅ "Patient portal"

**Denied Queries (Should NOT Appear):**
- ❌ "Shipping"
- ❌ "Return policy"
- ❌ "Gift cards"

**Acceptance Criteria:**
- [ ] Industry locked to `healthcare_provider`
- [ ] Medical queries present
- [ ] No retail leakage

---

## 📊 Verification Commands

### Check Industry Resolution

```bash
# Verify all test domains resolved correctly
npx wrangler d1 execute optiview --remote --command="
SELECT 
  root_url,
  industry,
  industry_source,
  industry_locked,
  created_at
FROM audits
WHERE root_url IN ('toyota.com', 'bestbuy.com', 'delta.com', 'chase.com', 'mayoclinic.org')
ORDER BY created_at DESC
LIMIT 10
"
```

**Expected:**
- toyota.com → automotive_oem
- bestbuy.com → retail
- delta.com → travel_air
- chase.com → financial_services
- mayoclinic.org → healthcare_provider

### Check for Mutation Attempts

```bash
# Search logs for blocked mutations
npx wrangler tail | grep "industry_mutation_blocked"
```

**Expected:** Empty or very rare (indicates guards working)

### Check Source Metrics

```bash
# Look for source metrics in logs
npx wrangler tail | grep -E "SOURCE.*success.*cited"
```

**Expected format:**
```
[SOURCE] perplexity: success=18 errors=2 cited=14
[SOURCE] chatgpt: success=16 errors=4 cited=11
```

**Verify:**
- `cited` count ≤ `success` count (only answers with URLs counted as cited)
- Errors are logged separately, not stored as results

---

## 🚨 Common Issues & Fixes

### Issue 1: KV Not Loading

**Symptom:**
```
[INDUSTRY] Using default config
```

**Fixes:**
1. Check KV binding name in `wrangler.toml`
2. Verify KV namespace ID is correct
3. Check KV key is exactly `industry_packs_json`
4. Verify JSON is valid (run through `jq`)

**Test:**
```bash
npx wrangler kv:key get --namespace-id=<ID> "industry_packs_json" | jq '.'
```

---

### Issue 2: Prompts Not Filtered

**Symptom:** Retail queries still appearing for Toyota

**Fixes:**
1. Verify `filterIntentsByPack` is called in prompts_v4
2. Check it's called AFTER Llama, BEFORE final query list
3. Verify logs show: `[PROMPTS] intents filtered`

**Debug:**
```bash
# Check if filtering code exists
grep -n "filterIntentsByPack" packages/audit-worker/src/**/*.ts
```

---

### Issue 3: Still Mislabeling Domains

**Symptom:** Wrong industry assigned to known domain

**Quick Fix (No Deploy Needed):**
```bash
# Update KV with corrected domain rule
# Edit industry_packs.json to add/fix domain
# Re-upload to KV
npx wrangler kv:key put --namespace-id=<ID> \
  "industry_packs_json" \
  --path=industry_packs.json
```

**Or force in database:**
```sql
UPDATE audits 
SET industry='automotive_oem', 
    industry_source='override', 
    industry_locked=1 
WHERE root_url='toyota.com';
```

---

### Issue 4: Errors Stored as Results

**Symptom:** `citations` table has entries with no URLs

**Fix:** Ensure storage is gated:
```typescript
// Only store if answered AND has citations
if (result.ok && result.hasUrls > 0) {
  await storeResult(result);
} else {
  // Log metrics separately
  await logErrorMetric(result);
}
```

---

### Issue 5: Too Many Intents Dropped

**Symptom:**
```
[QA] high_drop_rate: industry=automotive_oem dropped=18/25
```

**Fix:** Pack may be too strict
```bash
# Relax pack by:
# 1. Adding more allow_tags
# 2. Removing overly broad deny_phrases
# 3. Update KV (no deploy needed)
```

---

## 🔄 Rollback Plan

### Option 1: Feature Flag Toggle
```bash
# In wrangler.toml or secrets
FEATURE_INTENT_GUARDS=0
FEATURE_SOURCE_CIRCUIT=0

# Redeploy
npx wrangler deploy
```

### Option 2: Relax Packs via KV
```bash
# Edit industry_packs.json
# Remove deny_phrases that are too broad
# Upload new version
npx wrangler kv:key put --namespace-id=<ID> \
  "industry_packs_json" \
  --path=industry_packs_relaxed.json
```

### Option 3: Full Worker Rollback
```bash
# Revert to previous worker version
git revert HEAD
npx wrangler deploy
```

**Note:** Database changes are additive and safe to keep

---

## ✅ Final Acceptance Criteria

**Per Industry:**
- [ ] Industry locked once (never mutates mid-run)
- [ ] No deny phrase leakage for that industry
- [ ] At least 6 queries contain pack allow-tags
- [ ] Errors logged as metrics (not stored as results)
- [ ] Cited answers counted only when `hasUrls > 0`

**Overall System:**
- [ ] All 5 test domains resolve correctly
- [ ] KV loading confirmed (log shows packs loaded)
- [ ] No mutation warnings in logs
- [ ] Source budgets respected (max 20/15 queries)
- [ ] Performance acceptable (< 2 min per audit)

---

## 📝 Post-Go-Live Monitoring

**For First 48 Hours:**

1. **Watch Logs:**
```bash
npx wrangler tail | tee industry_lock_logs.txt
```

2. **Check Industry Distribution:**
```sql
SELECT 
  industry, 
  COUNT(*) as audit_count,
  AVG(CASE WHEN industry_source = 'domain_rules' THEN 1 ELSE 0 END) as domain_rule_rate
FROM audits
WHERE created_at >= datetime('now', '-48 hours')
GROUP BY industry;
```

3. **Monitor Drop Rates:**
```bash
# Look for high drop warnings
grep "high_drop_rate" industry_lock_logs.txt
```

4. **Check Citation Success Rates:**
```bash
# Compare before/after citation rates per industry
grep "SOURCE.*cited" industry_lock_logs.txt | \
  awk '{print $2, $NF}' | \
  sort | uniq -c
```

---

## 📞 Support

**If Issues Arise:**
- Check logs first: `npx wrangler tail`
- Verify KV loading: Look for `[INDUSTRY] Loaded from KV`
- Check database: Verify `industry` column populated
- Review this checklist step-by-step

**For Urgent Issues:**
- Toggle feature flags off
- Revert worker deploy
- All changes are non-destructive

---

**✅ Go-Live Checklist Complete!**

Run through all 5 smoke tests before declaring success. Each industry should show proper filtering and no cross-vertical leakage.

