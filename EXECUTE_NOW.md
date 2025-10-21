# 🚀 EXECUTE NOW - Industry Lock Deployment

**Single-file execution guide for Cursor**  
**Duration**: 90 minutes (staging + production)  
**Reversible**: Yes (instant rollback available)

> **Instruction to Cursor:**
> Execute each section in order. Paste command outputs as you go.

---

## 📋 SECTION 0: Pre-Flight (5 min)

### 0.1 Pull & Build

```bash
cd /Users/kevinmcgovern/geodude/geodude
git fetch --all && git checkout main && git pull
pnpm install
pnpm -w build
```

**Expected**: Clean build, no errors

---

### 0.2 Run Tests

```bash
pnpm -w test
```

**Expected**: All tests pass (or skip if none)

---

### 0.3 Verify Files Exist

```bash
ls -1 \
  CURSOR_INDUSTRY_LOCK_INSTRUCTIONS.md \
  INDUSTRY_LOCK_IMPLEMENTATION.md \
  INDUSTRY_LOCK_GO_LIVE_CHECKLIST.md \
  INDUSTRY_LOCK_DEPLOYMENT_PLAYBOOK.md \
  packages/audit-worker/src/lib/industry.ts \
  packages/audit-worker/src/lib/guards.ts \
  packages/audit-worker/src/lib/intent-guards.ts \
  packages/audit-worker/src/lib/source-client.ts \
  packages/audit-worker/src/config/industry-packs.schema.ts \
  packages/audit-worker/src/config/industry-packs.default.json \
  packages/audit-worker/src/config/loader.ts \
  packages/audit-worker/scripts/test_toyota.ts \
  packages/audit-worker/scripts/test_industries.ts \
  packages/audit-worker/migrations/*industry_lock*.sql
```

**Expected**: All files listed without errors

**If any missing**: STOP. Implementation incomplete. Review CURSOR_INDUSTRY_LOCK_INSTRUCTIONS.md

---

## 🧪 SECTION 1: Configure Staging (10 min)

### 1.1 Check KV Binding

```bash
cd packages/audit-worker
grep -A 3 "kv_namespaces" wrangler.toml
npx wrangler kv:namespace list
```

**Expected**: `DOMAIN_RULES_KV` binding present with staging namespace ID

**If missing**: 
```bash
npx wrangler kv:namespace create "DOMAIN_RULES_KV" --env staging
# Add the ID to wrangler.toml
```

---

### 1.2 Get KV Namespace ID (Staging)

```bash
# Extract staging KV namespace ID from wrangler.toml
STAGING_KV_ID=$(grep -A 5 "env.staging" wrangler.toml | grep -A 2 "kv_namespaces" | grep "id =" | cut -d'"' -f2)

# If not found in env.staging, try default
if [ -z "$STAGING_KV_ID" ]; then
  STAGING_KV_ID=$(grep -A 2 "binding = \"DOMAIN_RULES_KV\"" wrangler.toml | grep "id =" | head -1 | cut -d'"' -f2)
fi

echo "Staging KV Namespace ID: $STAGING_KV_ID"

# If still empty, manually set it
# STAGING_KV_ID="your_staging_kv_id_here"
```

---

### 1.3 Upload Industry Packs (Staging)

```bash
# Upload packs to staging KV
npx wrangler kv:key put \
  --namespace-id="$STAGING_KV_ID" \
  industry_packs_json \
  --path=src/config/industry-packs.default.json

# Verify upload
npx wrangler kv:key get \
  --namespace-id="$STAGING_KV_ID" \
  industry_packs_json | jq '.industry_rules.domains | length'
```

**Expected**: Returns number (should be ~14)

---

### 1.4 Apply Database Migration (Staging)

```bash
# Check migration exists
ls -la migrations/*industry_lock*.sql

# Apply to staging
npx wrangler d1 migrations apply optiview --remote --env staging

# Verify columns added
npx wrangler d1 execute optiview --remote --env staging \
  --command="PRAGMA table_info(audits)" | grep -E "industry"
```

**Expected output includes**:
```
industry|TEXT
industry_source|TEXT
industry_locked|INTEGER
```

---

### 1.5 Set Feature Flags (Staging)

```bash
# Set via secrets (recommended)
echo "1" | npx wrangler secret put FEATURE_INDUSTRY_LOCK --env staging
echo "1" | npx wrangler secret put FEATURE_INTENT_GUARDS --env staging
echo "1" | npx wrangler secret put FEATURE_SOURCE_CIRCUIT --env staging
```

**Alternative**: Add to `wrangler.toml` under `[env.staging.vars]`

---

## 🚀 SECTION 2: Deploy Staging (5 min)

### 2.1 Deploy Worker

```bash
npx wrangler deploy --env staging
```

**Expected**: Deployment succeeds with version ID

---

### 2.2 Verify Boot Logs

```bash
# Tail logs briefly to check loader
timeout 10s npx wrangler tail --env staging --format=pretty | grep -E "INDUSTRY"
```

**Expected log**:
```
[INDUSTRY] Loaded from KV: packs=7 domain_rules=14
```

OR

```
[INDUSTRY] Using default config
```

**If "Using default config"**: KV may not be loading. Check binding name matches exactly `DOMAIN_RULES_KV`

---

## 🧪 SECTION 3: Staging Smoke Tests (20 min)

### 3.1 Trigger 5 Test Audits

**Note**: Replace with your actual staging API URL and auth if needed

```bash
# Set API URL
STAGING_API="https://api-staging.optiview.ai"
# STAGING_API="http://localhost:8787" # If testing locally

# Toyota (automotive_oem)
echo "Testing Toyota..."
curl -sS -X POST "$STAGING_API/api/citations/run" \
  -H 'content-type: application/json' \
  -d '{"project_id":"toyota_test","domain":"toyota.com","sources":4}' | jq '.'

# Best Buy (retail)
echo "Testing Best Buy..."
curl -sS -X POST "$STAGING_API/api/citations/run" \
  -H 'content-type: application/json' \
  -d '{"project_id":"bestbuy_test","domain":"bestbuy.com","sources":4}' | jq '.'

# Delta (travel_air)
echo "Testing Delta..."
curl -sS -X POST "$STAGING_API/api/citations/run" \
  -H 'content-type: application/json' \
  -d '{"project_id":"delta_test","domain":"delta.com","sources":4}' | jq '.'

# Chase (financial_services)
echo "Testing Chase..."
curl -sS -X POST "$STAGING_API/api/citations/run" \
  -H 'content-type: application/json' \
  -d '{"project_id":"chase_test","domain":"chase.com","sources":4}' | jq '.'

# Mayo Clinic (healthcare_provider)
echo "Testing Mayo Clinic..."
curl -sS -X POST "$STAGING_API/api/citations/run" \
  -H 'content-type: application/json' \
  -d '{"project_id":"mayo_test","domain":"mayoclinic.org","sources":4}' | jq '.'
```

---

### 3.2 Monitor Logs

```bash
# Watch logs for all runs (run in separate terminal or background)
npx wrangler tail --env staging --format=pretty | grep -E "(RUN|INDUSTRY|PROMPTS|GUARD|SRC)"
```

**Expected patterns for each domain**:

**Toyota**:
```
[RUN] audit=aud_XXX domain=toyota.com industry=automotive_oem source=domain_rules locked
[PROMPTS] intents filtered: industry=automotive_oem kept=25 dropped=6
[SOURCE] perplexity: success=18 errors=2 cited=14
```

**Best Buy**:
```
[RUN] audit=aud_XXX domain=bestbuy.com industry=retail source=domain_rules locked
[PROMPTS] intents filtered: industry=retail kept=23 dropped=3
```

**Delta**:
```
[RUN] audit=aud_XXX domain=delta.com industry=travel_air source=domain_rules locked
```

**Chase**:
```
[RUN] audit=aud_XXX domain=chase.com industry=financial_services source=domain_rules locked
```

**Mayo**:
```
[RUN] audit=aud_XXX domain=mayoclinic.org industry=healthcare_provider source=domain_rules locked
```

---

### 3.3 Database Verification (Staging)

```bash
# Check table structure
npx wrangler d1 execute optiview --remote --env staging \
  --command="PRAGMA table_info(audits)" | grep -E "industry"

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

**Expected**:
- toyota.com → automotive_oem | domain_rules | 1
- bestbuy.com → retail | domain_rules | 1
- delta.com → travel_air | domain_rules | 1
- chase.com → financial_services | domain_rules | 1
- mayoclinic.org → healthcare_provider | domain_rules | 1

---

### 3.4 Check for Mutation Warnings

```bash
# Should be empty
npx wrangler tail --env staging --format=pretty | grep "industry_mutation_blocked"
```

**Expected**: No output (or very rare)

---

### 3.5 Staging Success Checklist

- [ ] All 5 smoke tests completed
- [ ] Industries resolved correctly per domain
- [ ] No cross-vertical leakage (Toyota has no retail queries)
- [ ] Cited counts > 0
- [ ] No frequent mutation warnings
- [ ] Database shows expected industry distribution
- [ ] Source budgets respected (no excessive 429s)

**If any fail**: Debug staging before proceeding to production

---

## 🚀 SECTION 4: Production Deployment (15 min)

### 4.1 Get Production KV Namespace ID

```bash
cd packages/audit-worker

# Extract production KV namespace ID
PROD_KV_ID=$(grep -A 5 "env.production" wrangler.toml | grep -A 2 "kv_namespaces" | grep "id =" | cut -d'"' -f2)

# If not found, try default
if [ -z "$PROD_KV_ID" ]; then
  PROD_KV_ID=$(grep -A 2 "binding = \"DOMAIN_RULES_KV\"" wrangler.toml | grep "id =" | head -1 | cut -d'"' -f2)
fi

echo "Production KV Namespace ID: $PROD_KV_ID"

# If still empty, manually set
# PROD_KV_ID="your_production_kv_id_here"
```

---

### 4.2 Upload Industry Packs (Production)

```bash
# Upload to production KV
npx wrangler kv:key put \
  --namespace-id="$PROD_KV_ID" \
  industry_packs_json \
  --path=src/config/industry-packs.default.json

# Verify
npx wrangler kv:key get \
  --namespace-id="$PROD_KV_ID" \
  industry_packs_json | jq '.industry_rules.domains | length'
```

**Expected**: Returns ~14

---

### 4.3 Apply Database Migration (Production)

```bash
# Optional: Backup check
npx wrangler d1 execute optiview --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table'" > prod_tables_backup.txt

# Apply migration
npx wrangler d1 migrations apply optiview --remote

# Verify
npx wrangler d1 execute optiview --remote \
  --command="PRAGMA table_info(audits)" | grep -E "industry"
```

**Expected**: industry, industry_source, industry_locked columns present

---

### 4.4 Set Feature Flags (Production)

```bash
# Set production flags
echo "1" | npx wrangler secret put FEATURE_INDUSTRY_LOCK --env production
echo "1" | npx wrangler secret put FEATURE_INTENT_GUARDS --env production
echo "1" | npx wrangler secret put FEATURE_SOURCE_CIRCUIT --env production
```

---

### 4.5 Deploy to Production

```bash
# Deploy
npx wrangler deploy --env production

# Verify deployment
npx wrangler deployments list --env production | head -5
```

**Expected**: New version deployed

---

### 4.6 Verify Boot Logs (Production)

```bash
# Check loader
timeout 10s npx wrangler tail --env production --format=pretty | grep -E "INDUSTRY"
```

**Expected**:
```
[INDUSTRY] Loaded from KV: packs=7 domain_rules=14
```

---

## 🧪 SECTION 5: Production Smoke Tests (20 min)

### 5.1 Trigger Production Tests

```bash
# Set production API URL
PROD_API="https://api.optiview.ai"

# Toyota
echo "Testing Toyota (production)..."
curl -sS -X POST "$PROD_API/api/citations/run" \
  -H 'content-type: application/json' \
  -d '{"project_id":"toyota_prod","domain":"toyota.com","sources":4}' | jq '.'

# Best Buy
echo "Testing Best Buy (production)..."
curl -sS -X POST "$PROD_API/api/citations/run" \
  -H 'content-type: application/json' \
  -d '{"project_id":"bestbuy_prod","domain":"bestbuy.com","sources":4}' | jq '.'

# Delta
echo "Testing Delta (production)..."
curl -sS -X POST "$PROD_API/api/citations/run" \
  -H 'content-type: application/json' \
  -d '{"project_id":"delta_prod","domain":"delta.com","sources":4}' | jq '.'

# Chase
echo "Testing Chase (production)..."
curl -sS -X POST "$PROD_API/api/citations/run" \
  -H 'content-type: application/json' \
  -d '{"project_id":"chase_prod","domain":"chase.com","sources":4}' | jq '.'

# Mayo Clinic
echo "Testing Mayo Clinic (production)..."
curl -sS -X POST "$PROD_API/api/citations/run" \
  -H 'content-type: application/json' \
  -d '{"project_id":"mayo_prod","domain":"mayoclinic.org","sources":4}' | jq '.'
```

---

### 5.2 Monitor Production Logs

```bash
# Watch logs
npx wrangler tail --env production --format=pretty | grep -E "(RUN|INDUSTRY|PROMPTS|GUARD|SRC)"
```

**Verify same patterns as staging**

---

### 5.3 Database Verification (Production)

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
  industry_locked,
  created_at
FROM audits
ORDER BY created_at DESC
LIMIT 20
"
```

---

### 5.4 Production Success Checklist

- [ ] All 5 domains tested in production
- [ ] Industries locked correctly
- [ ] No cross-vertical leakage
- [ ] Cited answers > 0
- [ ] Source budgets respected
- [ ] No excessive errors
- [ ] Database shows correct distribution

---

## 📊 SECTION 6: Post-Deployment Monitoring (48 hours)

### 6.1 Real-Time Monitoring

```bash
# Continuous log watch (run in background)
npx wrangler tail --env production --format=pretty | tee production_logs.txt

# Filter for key patterns
grep -E "(RUN|INDUSTRY|PROMPTS|GUARD|SRC)" production_logs.txt
```

---

### 6.2 Industry Distribution (Every 4 hours)

```bash
npx wrangler d1 execute optiview --remote --command="
SELECT 
  industry, 
  COUNT(*) as audits,
  AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) as success_rate
FROM audits
WHERE created_at >= datetime('now', '-4 hours')
GROUP BY industry
ORDER BY audits DESC
"
```

---

### 6.3 Check for Issues

```bash
# High drop rates
grep "high_drop_rate" production_logs.txt | tail -20

# Mutation warnings (should be rare)
grep "industry_mutation_blocked" production_logs.txt | tail -20

# Errors
grep -E "(ERROR|WARN)" production_logs.txt | sort | uniq -c | sort -rn | head -20
```

---

## 🔄 SECTION 7: Rollback Procedures (If Needed)

### Option 1: Disable Features (< 1 minute)

```bash
# Turn off guards/circuit, keep lock
echo "0" | npx wrangler secret put FEATURE_INTENT_GUARDS --env production
echo "0" | npx wrangler secret put FEATURE_SOURCE_CIRCUIT --env production

# Redeploy
cd packages/audit-worker
npx wrangler deploy --env production
```

**Effect**: Industry still locks, but no filtering or circuit breaking

---

### Option 2: Relax Packs via KV (< 30 seconds)

```bash
# Download current
npx wrangler kv:key get --namespace-id="$PROD_KV_ID" industry_packs_json > packs_backup.json

# Edit to relax (remove deny_phrases or add allow_tags)
# Then re-upload
npx wrangler kv:key put --namespace-id="$PROD_KV_ID" \
  industry_packs_json --path=packs_relaxed.json
```

**Effect**: Immediate (next worker invocation)

---

### Option 3: Full Revert (5 minutes)

```bash
# Find commit
git log --oneline -10

# Revert
git revert <commit_sha>
cd packages/audit-worker
npx wrangler deploy --env production

# Verify
npx wrangler deployments list --env production
```

**Effect**: Complete rollback

---

## ✅ SECTION 8: Success Criteria Summary

### Per Industry
- [ ] Industry locked once (no mutations)
- [ ] No deny phrase leakage
- [ ] 6+ queries with allow tags
- [ ] Errors logged separately
- [ ] Citations only when URLs present

### Overall System
- [ ] All 5 test domains resolved correctly
- [ ] KV loading confirmed
- [ ] No mutation warnings
- [ ] Source budgets respected
- [ ] Performance acceptable (< 2 min/audit)

---

## 📝 SECTION 9: Share Results

**After completion, share with team:**

1. **Staging Log Snippets** (one per domain):
   - `[RUN]` line
   - `[PROMPTS]` line
   - `[SRC]` lines

2. **Production Log Snippets** (same format)

3. **Database Stats**:
   - Industry distribution
   - Success rates
   - Any issues encountered

4. **Rollback Used** (if any):
   - Which option
   - Reason
   - Resolution

---

## 🎯 Quick Reference Commands

```bash
# Monitor logs
npx wrangler tail --env production | grep -E "(INDUSTRY|PROMPTS|SRC)"

# Check industry distribution
npx wrangler d1 execute optiview --remote --command="SELECT industry, COUNT(*) FROM audits WHERE created_at >= datetime('now', '-1 hour') GROUP BY industry"

# Check for issues
grep -E "high_drop_rate|mutation_blocked|ERROR" production_logs.txt

# Instant rollback (disable guards)
echo "0" | npx wrangler secret put FEATURE_INTENT_GUARDS --env production && npx wrangler deploy --env production
```

---

## ✅ EXECUTION COMPLETE!

**Final checklist:**
- [ ] Staging deployed and validated
- [ ] Production deployed and validated
- [ ] 5 industries tested in both environments
- [ ] No cross-vertical leakage observed
- [ ] Monitoring commands documented
- [ ] Team notified of deployment

**Next**: Monitor for 48 hours and make KV adjustments as needed.

---

**🎉 Industry Lock System is LIVE! 🎉**

