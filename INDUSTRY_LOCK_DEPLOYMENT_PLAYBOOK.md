# 🚀 Industry Lock - Deployment Playbook

**Target**: Staging → Production  
**Duration**: 45-60 minutes  
**Reversible**: Yes (3 rollback methods)

> **Instruction to Cursor:**
> *Execute the steps below in order for **staging**, then **production**. Paste command outputs into the PR comment.*

---

## 📋 Pre-Flight Checklist

### 0.1 Pull Latest + Build

```bash
cd /Users/kevinmcgovern/geodude/geodude
git fetch --all && git checkout main && git pull
pnpm install
pnpm -w build
```

**Expected:** Clean build, no errors

---

### 0.2 Run Tests

```bash
pnpm test -w
```

**Expected:** All tests pass (or skip if no tests yet)

---

### 0.3 Verify Implementation Files Exist

```bash
# Check all required files present
ls -la packages/audit-worker/src/lib/industry.ts
ls -la packages/audit-worker/src/lib/guards.ts
ls -la packages/audit-worker/src/lib/intent-guards.ts
ls -la packages/audit-worker/src/lib/source-client.ts
ls -la packages/audit-worker/src/config/industry-packs.schema.ts
ls -la packages/audit-worker/src/config/industry-packs.default.json
ls -la packages/audit-worker/src/config/loader.ts
ls -la packages/audit-worker/scripts/test_toyota.ts
ls -la packages/audit-worker/scripts/test_industries.ts
ls -la packages/audit-worker/migrations/*industry_lock*.sql

# Check documentation
ls -la CURSOR_INDUSTRY_LOCK_INSTRUCTIONS.md
ls -la INDUSTRY_LOCK_IMPLEMENTATION.md
ls -la INDUSTRY_LOCK_GO_LIVE_CHECKLIST.md
ls -la INDUSTRY_LOCK_DEPLOYMENT_PLAYBOOK.md
```

**Expected:** All files exist

**If any missing:** Stop and report. Implementation not complete.

---

## 🧪 STAGING DEPLOYMENT

### 1.1 Check KV Bindings (Staging)

```bash
# Check wrangler.toml for KV binding
grep -A 3 "kv_namespaces" packages/audit-worker/wrangler.toml

# List available KV namespaces
npx wrangler kv:namespace list
```

**Expected in wrangler.toml:**
```toml
[[kv_namespaces]]
binding = "DOMAIN_RULES_KV"
id = "<STAGING_KV_NAMESPACE_ID>"
```

**If missing:** Create KV namespace:
```bash
npx wrangler kv:namespace create "DOMAIN_RULES_KV" --env staging
# Copy the ID into wrangler.toml
```

---

### 1.2 Upload Industry Packs to KV (Staging)

```bash
# Navigate to audit worker
cd packages/audit-worker

# Get KV namespace ID from wrangler.toml
KV_ID=$(grep -A 2 "binding = \"DOMAIN_RULES_KV\"" wrangler.toml | grep "id =" | head -1 | cut -d'"' -f2)

echo "Using KV Namespace ID: $KV_ID"

# Upload industry packs to KV
npx wrangler kv:key put \
  --namespace-id="$KV_ID" \
  industry_packs_json \
  --path=src/config/industry-packs.default.json

# Verify upload
npx wrangler kv:key get \
  --namespace-id="$KV_ID" \
  industry_packs_json | jq '.industry_rules.domains | length'
```

**Expected:** Returns number of domains (should be ~14)

---

### 1.3 Apply Database Migration (Staging)

```bash
# Check migration file exists
ls -la migrations/*industry_lock*.sql

# Apply migration to staging
npx wrangler d1 migrations apply optiview --remote --env staging

# Verify columns added
npx wrangler d1 execute optiview --remote --env staging \
  --command="PRAGMA table_info(audits)" | grep -E "industry"
```

**Expected output:**
```
industry|TEXT
industry_source|TEXT
industry_locked|INTEGER
```

---

### 1.4 Set Feature Flags (Staging)

**Option A: Via wrangler.toml (Recommended)**

Add to `wrangler.toml` under `[env.staging.vars]`:
```toml
[env.staging.vars]
FEATURE_INDUSTRY_LOCK = "1"
FEATURE_INTENT_GUARDS = "1"
FEATURE_SOURCE_CIRCUIT = "1"
```

**Option B: Via Secrets**

```bash
# Set via secrets (if not using vars)
echo "1" | npx wrangler secret put FEATURE_INDUSTRY_LOCK --env staging
echo "1" | npx wrangler secret put FEATURE_INTENT_GUARDS --env staging
echo "1" | npx wrangler secret put FEATURE_SOURCE_CIRCUIT --env staging
```

---

### 1.5 Deploy Worker (Staging)

```bash
# Deploy audit worker to staging
npx wrangler deploy --env staging

# Get worker URL
npx wrangler deployments list --env staging | head -5
```

**Expected:** Deployment succeeds, version ID shown

---

### 1.6 Verify Boot Logs (Staging)

```bash
# Tail logs and look for industry loader
npx wrangler tail --env staging --format=pretty &
TAIL_PID=$!

# Wait a few seconds for logs
sleep 3

# Trigger a simple request to warm up worker
curl -sS https://api-staging.optiview.ai/health || echo "Health endpoint not available, that's OK"

# Check logs
sleep 2
kill $TAIL_PID 2>/dev/null
```

**Expected log line:**
```
[INDUSTRY] Loaded from KV: packs=7 domain_rules=14
```

or

```
[INDUSTRY] Using default config
```

**If "Using default config":** KV not loading. Check binding name and namespace ID.

---

## 🧪 Staging Smoke Tests

### 2.1 Test Toyota (Automotive OEM)

```bash
# Trigger Toyota citations run
curl -sS -X POST "https://api-staging.optiview.ai/api/citations/run" \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_STAGING_TOKEN' \
  -d '{
    "project_id": "toyota_test",
    "domain": "toyota.com",
    "sources": 4
  }' | jq '.'
```

**Watch logs:**
```bash
npx wrangler tail --env staging --format=pretty | grep -E "(RUN|INDUSTRY|PROMPTS|GUARD|SRC)"
```

**Expected logs:**
```
[RUN] audit=aud_XXX domain=toyota.com industry=automotive_oem source=domain_rules locked
[INDUSTRY] resolved: automotive_oem (source=domain_rules) domain=toyota.com
[PROMPTS] intents filtered: industry=automotive_oem kept=25 dropped=6
[SOURCE] perplexity: success=18 errors=2 cited=14
[SOURCE] chatgpt: success=16 errors=4 cited=11
```

**Acceptance:**
- [ ] Industry = `automotive_oem`
- [ ] Source = `domain_rules`
- [ ] Kept > 20 intents
- [ ] Cited count > 0
- [ ] NO logs with "return policy", "shipping", "promo code"

---

### 2.2 Test Best Buy (Retail)

```bash
curl -sS -X POST "https://api-staging.optiview.ai/api/citations/run" \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_STAGING_TOKEN' \
  -d '{
    "project_id": "bestbuy_test",
    "domain": "bestbuy.com",
    "sources": 4
  }' | jq '.'
```

**Expected logs:**
```
[RUN] audit=aud_XXX domain=bestbuy.com industry=retail source=domain_rules locked
[PROMPTS] intents filtered: industry=retail kept=23 dropped=3
```

**Acceptance:**
- [ ] Industry = `retail`
- [ ] Retail queries OK (shipping, returns)
- [ ] NO automotive queries (IIHS, towing, dealer)

---

### 2.3 Test Delta (Travel Air)

```bash
curl -sS -X POST "https://api-staging.optiview.ai/api/citations/run" \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_STAGING_TOKEN' \
  -d '{
    "project_id": "delta_test",
    "domain": "delta.com",
    "sources": 4
  }' | jq '.'
```

**Expected logs:**
```
[RUN] audit=aud_XXX domain=delta.com industry=travel_air source=domain_rules locked
[PROMPTS] intents filtered: industry=travel_air kept=21 dropped=4
```

**Acceptance:**
- [ ] Industry = `travel_air`
- [ ] Travel queries (baggage, fares, routes)
- [ ] NO retail/automotive leakage

---

### 2.4 Test Chase (Financial Services)

```bash
curl -sS -X POST "https://api-staging.optiview.ai/api/citations/run" \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_STAGING_TOKEN' \
  -d '{
    "project_id": "chase_test",
    "domain": "chase.com",
    "sources": 4
  }' | jq '.'
```

**Expected logs:**
```
[RUN] audit=aud_XXX domain=chase.com industry=financial_services source=domain_rules locked
[PROMPTS] intents filtered: industry=financial_services kept=22 dropped=5
```

**Acceptance:**
- [ ] Industry = `financial_services`
- [ ] Financial queries (APR, rates, mortgage)
- [ ] NO e-commerce queries

---

### 2.5 Test Mayo Clinic (Healthcare)

```bash
curl -sS -X POST "https://api-staging.optiview.ai/api/citations/run" \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_STAGING_TOKEN' \
  -d '{
    "project_id": "mayo_test",
    "domain": "mayoclinic.org",
    "sources": 4
  }' | jq '.'
```

**Expected logs:**
```
[RUN] audit=aud_XXX domain=mayoclinic.org industry=healthcare_provider source=domain_rules locked
[PROMPTS] intents filtered: industry=healthcare_provider kept=20 dropped=3
```

**Acceptance:**
- [ ] Industry = `healthcare_provider`
- [ ] Medical queries (conditions, doctors, appointments)
- [ ] NO retail queries

---

### 2.6 Database Verification (Staging)

```bash
# Check industry distribution
npx wrangler d1 execute optiview --remote --env staging --command="
SELECT 
  industry, 
  industry_source, 
  COUNT(*) as count
FROM audits 
WHERE created_at >= datetime('now', '-1 hour')
GROUP BY industry, industry_source
ORDER BY count DESC
"

# Check last 10 audits
npx wrangler d1 execute optiview --remote --env staging --command="
SELECT 
  id,
  root_url,
  industry,
  industry_source,
  industry_locked,
  created_at
FROM audits
ORDER BY created_at DESC
LIMIT 10
"
```

**Expected:**
- toyota.com → automotive_oem | domain_rules | 1
- bestbuy.com → retail | domain_rules | 1
- delta.com → travel_air | domain_rules | 1
- chase.com → financial_services | domain_rules | 1
- mayoclinic.org → healthcare_provider | domain_rules | 1

---

### 2.7 Check for Mutation Warnings

```bash
# Should be empty or very rare
npx wrangler tail --env staging --format=pretty | grep "industry_mutation_blocked"
```

**Expected:** No output (or very rare)

**If frequent:** A module is trying to change industry. Needs investigation.

---

## ✅ Staging Success Criteria

Before proceeding to production, verify:

- [ ] All 5 smoke tests completed
- [ ] Industries resolved correctly
- [ ] No cross-vertical leakage
- [ ] Cited counts > 0
- [ ] No mutation warnings
- [ ] Database shows expected data
- [ ] Source budgets respected (no excessive 429s)

**If any fail:** Debug staging before production deployment.

---

## 🚀 PRODUCTION DEPLOYMENT

### 3.1 Check KV Bindings (Production)

```bash
# Check production KV namespace
grep -A 3 "env.production" packages/audit-worker/wrangler.toml | grep -A 2 "kv_namespaces"

# Or check default/production section
grep -A 3 "kv_namespaces" packages/audit-worker/wrangler.toml | head -10
```

**Expected:**
```toml
[[env.production.kv_namespaces]]
binding = "DOMAIN_RULES_KV"
id = "<PROD_KV_NAMESPACE_ID>"
```

---

### 3.2 Upload Industry Packs to KV (Production)

```bash
cd packages/audit-worker

# Get production KV namespace ID
PROD_KV_ID=$(grep -A 2 "env.production" wrangler.toml | grep "id =" | head -1 | cut -d'"' -f2)

# If not in env.production, get default
if [ -z "$PROD_KV_ID" ]; then
  PROD_KV_ID=$(grep -A 2 "binding = \"DOMAIN_RULES_KV\"" wrangler.toml | grep "id =" | head -1 | cut -d'"' -f2)
fi

echo "Using Production KV Namespace ID: $PROD_KV_ID"

# Upload to production
npx wrangler kv:key put \
  --namespace-id="$PROD_KV_ID" \
  industry_packs_json \
  --path=src/config/industry-packs.default.json

# Verify
npx wrangler kv:key get \
  --namespace-id="$PROD_KV_ID" \
  industry_packs_json | jq '.industry_rules.domains | length'
```

**Expected:** Returns ~14 domains

---

### 3.3 Apply Database Migration (Production)

```bash
# Backup first (optional but recommended)
npx wrangler d1 execute optiview --remote --command="
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
" > production_tables_backup.txt

# Apply migration
npx wrangler d1 migrations apply optiview --remote

# Verify columns
npx wrangler d1 execute optiview --remote \
  --command="PRAGMA table_info(audits)" | grep -E "industry"
```

**Expected:**
```
industry|TEXT
industry_source|TEXT
industry_locked|INTEGER
```

---

### 3.4 Set Feature Flags (Production)

**Update wrangler.toml:**

```toml
[env.production.vars]
FEATURE_INDUSTRY_LOCK = "1"
FEATURE_INTENT_GUARDS = "1"
FEATURE_SOURCE_CIRCUIT = "1"
```

Or via secrets:

```bash
echo "1" | npx wrangler secret put FEATURE_INDUSTRY_LOCK --env production
echo "1" | npx wrangler secret put FEATURE_INTENT_GUARDS --env production
echo "1" | npx wrangler secret put FEATURE_SOURCE_CIRCUIT --env production
```

---

### 3.5 Deploy Worker (Production)

```bash
# Deploy to production
npx wrangler deploy --env production

# Verify deployment
npx wrangler deployments list --env production | head -5
```

**Expected:** New version deployed successfully

---

### 3.6 Verify Boot Logs (Production)

```bash
# Tail production logs
npx wrangler tail --env production --format=pretty | grep -E "INDUSTRY"
```

**Expected:**
```
[INDUSTRY] Loaded from KV: packs=7 domain_rules=14
```

---

## 🧪 Production Smoke Tests

### 4.1 Run All 5 Domain Tests (Production)

```bash
# Toyota
curl -sS -X POST "https://api.optiview.ai/api/citations/run" \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_PROD_TOKEN' \
  -d '{"project_id":"toyota_prod","domain":"toyota.com","sources":4}' | jq '.'

# Best Buy
curl -sS -X POST "https://api.optiview.ai/api/citations/run" \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_PROD_TOKEN' \
  -d '{"project_id":"bestbuy_prod","domain":"bestbuy.com","sources":4}' | jq '.'

# Delta
curl -sS -X POST "https://api.optiview.ai/api/citations/run" \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_PROD_TOKEN' \
  -d '{"project_id":"delta_prod","domain":"delta.com","sources":4}' | jq '.'

# Chase
curl -sS -X POST "https://api.optiview.ai/api/citations/run" \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_PROD_TOKEN' \
  -d '{"project_id":"chase_prod","domain":"chase.com","sources":4}' | jq '.'

# Mayo Clinic
curl -sS -X POST "https://api.optiview.ai/api/citations/run" \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_PROD_TOKEN' \
  -d '{"project_id":"mayo_prod","domain":"mayoclinic.org","sources":4}' | jq '.'
```

---

### 4.2 Monitor Production Logs

```bash
# Watch all runs
npx wrangler tail --env production --format=pretty | grep -E "(RUN|INDUSTRY|PROMPTS|GUARD|SRC)"
```

**Verify same patterns as staging:**
- Industry locked correctly per domain
- Intent filtering working
- No mutation warnings
- Source budgets respected

---

### 4.3 Database Verification (Production)

```bash
# Industry distribution
npx wrangler d1 execute optiview --remote --command="
SELECT 
  industry, 
  industry_source, 
  COUNT(*) as count
FROM audits 
WHERE created_at >= datetime('now', '-1 hour')
GROUP BY industry, industry_source
ORDER BY count DESC
"

# Recent audits
npx wrangler d1 execute optiview --remote --command="
SELECT 
  root_url,
  industry,
  industry_source,
  industry_locked
FROM audits
ORDER BY created_at DESC
LIMIT 20
"
```

---

## 🎯 Final Success Criteria

**Production Checklist:**

- [ ] All 5 domains tested
- [ ] Industry locked correctly (no mutations)
- [ ] No cross-vertical leakage in queries
- [ ] Cited answers > 0 per domain
- [ ] Source budgets respected (< 20 queries per source)
- [ ] No excessive errors in logs
- [ ] Database shows correct industry distribution

---

## 🔄 Rollback Procedures

### Option 1: Disable Features (Instant)

```bash
# Turn off guards/circuit, keep lock
echo "0" | npx wrangler secret put FEATURE_INTENT_GUARDS --env production
echo "0" | npx wrangler secret put FEATURE_SOURCE_CIRCUIT --env production

# Redeploy
npx wrangler deploy --env production
```

**Effect:** Industry still locks, but no filtering or circuit breaking

---

### Option 2: Relax Packs via KV (No Deploy)

```bash
# Download current packs
npx wrangler kv:key get --namespace-id="$PROD_KV_ID" industry_packs_json > packs_backup.json

# Edit to relax (e.g., remove deny_phrases or add allow_tags)
# Then re-upload
npx wrangler kv:key put --namespace-id="$PROD_KV_ID" \
  industry_packs_json --path=packs_relaxed.json
```

**Effect:** Changes take effect immediately on next worker invocation

---

### Option 3: Full Revert (5 minutes)

```bash
# Find deployment commit
git log --oneline -10

# Revert
git revert <commit_sha>
npx wrangler deploy --env production

# Verify
npx wrangler deployments list --env production
```

**Effect:** Complete rollback to previous version

---

## 📊 Post-Deployment Monitoring (48 Hours)

### Day 1 (First 24 Hours)

```bash
# Monitor logs continuously
npx wrangler tail --env production | tee production_day1.log

# Check industry distribution every 4 hours
npx wrangler d1 execute optiview --remote --command="
SELECT industry, COUNT(*) as count 
FROM audits 
WHERE created_at >= datetime('now', '-4 hours')
GROUP BY industry
"

# Check for high drop rates
grep "high_drop_rate" production_day1.log
```

---

### Day 2 (24-48 Hours)

```bash
# Compare citation success rates
npx wrangler d1 execute optiview --remote --command="
SELECT 
  industry,
  COUNT(*) as audits,
  AVG(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_rate
FROM audits
WHERE created_at >= datetime('now', '-48 hours')
GROUP BY industry
"

# Check for any recurring errors
grep -E "(ERROR|WARN)" production_day1.log | sort | uniq -c | sort -rn | head -20
```

---

## 📝 Release Notes Template

Copy this into your release announcement:

```markdown
# Industry Lock System - Production Release

## ✅ Deployed
- **Date:** [DATE]
- **Version:** [VERSION]
- **Environments:** Staging ✅ Production ✅

## 🎯 What Changed
- Industry locked once per audit (prevents mid-run changes)
- Config-driven intent filtering (7 industries)
- Source client hardening (budgets + circuit breakers)
- Improved error handling (errors not stored as results)

## 🏭 Industries Supported
- Automotive OEM (Toyota, Ford, GM)
- Retail (Best Buy, Target)
- Travel - Air (Delta, United)
- Financial Services (Chase, Wells Fargo)
- Healthcare (Mayo Clinic, Cleveland Clinic)
- SaaS (Salesforce, Slack)
- Generic Consumer (fallback)

## ✅ Smoke Test Results
- [x] Toyota: automotive_oem ✅ No retail queries
- [x] Best Buy: retail ✅ No automotive queries
- [x] Delta: travel_air ✅ No retail leakage
- [x] Chase: financial_services ✅ No e-commerce queries
- [x] Mayo: healthcare_provider ✅ No retail queries

## 📊 Metrics (First 24h)
- Audits run: [COUNT]
- Industries resolved: [automotive_oem: X, retail: Y, ...]
- Average drop rate: [N%]
- Citation success: [N%]
- No mutation warnings observed ✅

## 🔧 Configuration
All changes are KV-configurable. To add new industries:
1. Edit `industry_packs_json` in KV
2. Changes take effect immediately (no deploy needed)

## 🛡️ Rollback
Three methods available:
1. Feature flag toggle (instant)
2. KV pack relaxation (instant)
3. Full revert (5 min)

## 📞 Support
Issues? Check logs first:
\`\`\`bash
npx wrangler tail --env production | grep -E "(INDUSTRY|GUARD)"
\`\`\`
```

---

## ✅ Deployment Complete!

**After both staging and production pass all checks:**

1. Update release notes
2. Post to team Slack/Discord
3. Monitor for 48 hours
4. Document any KV adjustments made

**All systems go! 🚀**

