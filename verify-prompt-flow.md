# Prompt Generation Flow Verification

## How It Should Work

```
1. UI creates audit with domain
   ↓
2. Worker calls resolveIndustry()
   ├→ Check whitelist (1,257 domains) → instant
   ├→ Check AI classifier (if not in whitelist) → 70%+ confidence
   └→ Fallback to heuristics
   ↓
3. Store industry in audits table (industry, industry_source, industry_confidence)
   ↓
4. Citations cron runs (every 5 min)
   ├→ Reads audit.industry
   ├→ Calls generateQueriesV4() with industry context
   └→ V4 uses industry-specific templates via templateResolver.ts
   ↓
5. Prompts are:
   ✅ Industry-specific (uses V2 taxonomy)
   ✅ Human-sounding (via humanization pass)
   ✅ Factually grounded (no hallucinations)
   ✅ Quality-filtered (no offensive/stupid queries)
```

## Verification Checklist

### ✅ Step 1: Audit Creation
- [ ] UI calls `POST /api/audits`
- [ ] Worker receives `root_url`, `site_description`, `max_pages`
- [ ] Worker calls `resolveIndustry()` with env.AI binding
- [ ] Industry is stored in D1 `audits` table

**How to verify:**
```sql
SELECT audit_id, root_url, industry, industry_source, industry_confidence, industry_metadata
FROM audits
WHERE root_url LIKE '%nordstrom%'
ORDER BY created_at DESC
LIMIT 5;
```

Expected:
- `industry`: `retail.fashion` or similar
- `industry_source`: `ai_worker` or `domain_rules`
- `industry_confidence`: 0.70+ for AI, 1.0 for whitelist

---

### ✅ Step 2: Industry Classification
- [ ] AI classifier is called (if not in whitelist)
- [ ] Llama-3.1-8b receives rich context (domain, title, nav, schema)
- [ ] AI returns V2 taxonomy slug (e.g., `retail.fashion`)
- [ ] Confidence is ≥ 0.70

**How to verify:**
Check worker logs for:
```
[AI_CLASSIFY] nordstrom.com → retail.fashion (0.92) - High-end department store
[AI_CLASSIFY] delta.com → travel.air (0.95) - Major airline
```

---

### ✅ Step 3: Template Resolution
- [ ] Citations cron reads audit.industry
- [ ] Calls `generateQueriesV4()` with industry slug
- [ ] V4 calls `resolveTemplates(industry)` from `templateResolver.ts`
- [ ] Templates cascade from specific → general (e.g., `retail.fashion` → `retail` → fallback)

**How to verify:**
```bash
# Check prompt cache for recent entries
wrangler kv:key list --binding PROMPT_CACHE --prefix "prompts:nordstrom.com"
```

Expected:
- Templates include fashion-specific terms (brands, styles, sizing)
- Not generic "ecommerce" terms

---

### ✅ Step 4: Prompt Generation
- [ ] V4 generates 30-50 queries
- [ ] Uses industry-specific personas and contexts
- [ ] Applies humanization pass (if `FEATURE_PROMPT_HUMANIZE=1`)
- [ ] Quality filter rejects bad queries

**How to verify:**
```sql
SELECT audit_id, query, ai_source, search_intent
FROM ai_citations
WHERE audit_id IN (
  SELECT audit_id FROM audits WHERE root_url LIKE '%nordstrom%'
)
LIMIT 20;
```

Expected prompts (nordstrom.com):
- ❌ "What is Nordstrom Competitor A like?"
- ❌ "How does Nordstrom ecommerce checkout work?"
- ✅ "Nordstrom vs Macy's for designer handbags"
- ✅ "Nordstrom Anniversary Sale early access tips"
- ✅ "Best department stores for luxury brands"

---

### ✅ Step 5: Quality Verification
- [ ] No offensive queries
- [ ] No placeholder names ("Competitor A")
- [ ] No wrong industry context ("ecommerce" for airlines)
- [ ] Human-sounding (not robotic)

**How to verify:**
1. Read 20 random prompts
2. Score each for:
   - Natural language (1-5)
   - Industry relevance (1-5)
   - Human likelihood (1-5)
3. Average should be 4.0+

---

## Quick Test Script

```bash
# 1. Create test audit
curl -X POST https://api.optiview.ai/api/audits \
  -H "Content-Type: application/json" \
  --cookie "ov_sess=YOUR_COOKIE" \
  -d '{
    "project_id": "test",
    "root_url": "https://nordstrom.com",
    "max_pages": 5
  }'

# 2. Get audit ID from response
AUDIT_ID="..."

# 3. Wait 40 seconds for processing
sleep 40

# 4. Check industry classification
curl https://api.optiview.ai/api/audits/$AUDIT_ID \
  --cookie "ov_sess=YOUR_COOKIE" \
  | jq '.industry, .industry_source, .industry_confidence'

# 5. Wait 5-10 min for citations cron

# 6. Check prompts
curl https://api.optiview.ai/api/citations/prompts/$AUDIT_ID \
  --cookie "ov_sess=YOUR_COOKIE" \
  | jq '.prompts[0:5]'
```

---

## Expected Results

### Good Prompts (nordstrom.com)
```
✅ "Nordstrom vs Bloomingdale's price comparison"
✅ "Best department stores for designer shoes"
✅ "Nordstrom Rack clearance sale schedule"
✅ "How to use Nordstrom rewards program"
✅ "Nordstrom return policy for online orders"
```

### Good Prompts (delta.com)
```
✅ "Delta SkyMiles redemption best practices"
✅ "Delta vs United for international flights"
✅ "How to upgrade to Delta One"
✅ "Delta SkyClub lounge access rules"
✅ "Best credit cards for Delta frequent flyers"
```

### Good Prompts (marriott.com)
```
✅ "Marriott Bonvoy points value calculator"
✅ "Best Marriott hotels for business travel"
✅ "Marriott vs Hilton loyalty programs"
✅ "How to book Marriott with points"
✅ "Marriott category 5 hotel list"
```

---

## Red Flags

### ❌ Bad Prompts (would indicate failure)
```
❌ "What is Nordstrom Competitor A?"
❌ "How does Delta ecommerce checkout work?"
❌ "Marriott mexicans policy"
❌ "What is a hotel and how does it work?"
❌ "nordstrom.com technical SEO analysis"
```

### ❌ Wrong Industry Context
```
❌ Airline getting "ecommerce" prompts
❌ Bank getting "restaurant menu" prompts
❌ Hospital getting "product catalog" prompts
```

---

## Success Criteria

- [x] Worker deployed with AI classifier
- [x] App deployed
- [ ] 5 test audits created
- [ ] All 5 classified correctly (exact or partial match)
- [ ] 80%+ used AI classifier or whitelist
- [ ] Prompts are human-sounding (4.0+ avg score)
- [ ] No offensive/stupid queries
- [ ] Industry-specific templates used
- [ ] No hallucinated product names

**If all green:** ✅ System is ready for demo
**If any red:** ❌ Need to debug that specific component

---

## Debugging Commands

### Check worker logs
```bash
wrangler tail --name optiview-audit-worker
```

### Query D1 for audits
```bash
wrangler d1 execute optiview --command \
  "SELECT audit_id, root_url, industry, industry_source FROM audits ORDER BY created_at DESC LIMIT 10"
```

### Check prompt cache
```bash
wrangler kv:key list --binding PROMPT_CACHE
```

### Check citations
```bash
wrangler d1 execute optiview --command \
  "SELECT COUNT(*) as total, audit_id FROM ai_citations GROUP BY audit_id ORDER BY total DESC LIMIT 10"
```

---

## Timeline

- **T+0s**: Create audit via UI
- **T+40s**: Audit should be classified and have pages
- **T+5-10min**: Citations cron runs, prompts generated
- **T+15-20min**: Prompts fully populated, ready to review

**Total time to full verification: ~20 minutes**

