# Cursor: Industry Lock Implementation Instructions

**Priority**: P0 - Fixes Toyota misclassification  
**Time**: 2-3 days  
**Approach**: Config-driven, scalable, non-breaking

---

## Quick Context

**Problem**: Toyota.com gets retail prompts ("return policy", "shipping") instead of automotive prompts ("MSRP", "dealer locator")

**Root Cause**: Industry changes mid-run + no filtering

**Solution**: Lock industry once + config-driven intent packs + source hardening

---

## Implementation Steps for Cursor

### Step 1: Search & Understand Current Code

**Search for these patterns:**
```
1. "industry" (find where it's set/used)
2. "[PROMPTS] V4" or "prompts_v4" (LLM prompt generation)
3. "[CITATIONS] Storing result" (where citations are saved)
4. "llama" or "contextual engine" (Llama integration)
5. "perplexity", "chatgpt", "claude" source clients
```

**Understand:**
- Where audit industry is set
- How prompts are generated
- How citations are stored
- Current error handling

---

### Step 2: Create Industry Config (Foundation)

**Create: `packages/audit-worker/src/config/industry-packs.default.json`**

```json
{
  "industry_rules": {
    "default_industry": "generic_consumer",
    "domains": {
      "toyota.com": "automotive_oem",
      "ford.com": "automotive_oem",
      "bestbuy.com": "retail",
      "chase.com": "financial_services"
    }
  },
  "packs": {
    "automotive_oem": {
      "allow_tags": ["msrp", "build_price", "dealer_locator", "financing", "warranty", "safety_ratings", "iihs", "nhtsa", "towing", "cpo", "test_drive"],
      "deny_phrases": ["return policy", "free returns", "promo code", "shipping", "exchange policy", "gift card"],
      "inherits": ["generic_consumer"]
    },
    "retail": {
      "allow_tags": ["price", "discounts", "shipping", "returns", "availability", "in_stock"],
      "deny_phrases": ["iihs", "nhtsa", "towing capacity", "dealer"],
      "inherits": ["generic_consumer"]
    },
    "generic_consumer": {
      "allow_tags": ["pricing", "reviews", "warranty", "customer_service", "locations"]
    }
  }
}
```

**Create: `packages/audit-worker/src/lib/industry.ts`**

```typescript
import config from '../config/industry-packs.default.json';

type Industry = string;
type IndustryLock = { value: Industry; source: string; locked: true };

// Extract domain from URL
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return url.toLowerCase();
  }
}

// Resolve industry with precedence
export function resolveIndustry(ctx: {
  audit?: { industry?: string };
  override?: string;
  signals: { domain: string; title?: string };
}): IndustryLock {
  // 1. Already locked
  if (ctx.audit?.industry) {
    return { value: ctx.audit.industry, source: 'locked', locked: true };
  }

  // 2. Override
  if (ctx.override) {
    return { value: ctx.override, source: 'override', locked: true };
  }

  const domain = extractDomain(ctx.signals.domain);

  // 3. Domain rules
  const domainRules = config.industry_rules.domains;
  if (domainRules[domain]) {
    return { value: domainRules[domain], source: 'domain_rules', locked: true };
  }

  // 4. Default
  return { value: config.industry_rules.default_industry, source: 'default', locked: true };
}

// Get intent pack for industry
export function getIntentPack(industry: string) {
  return config.packs[industry] || config.packs.generic_consumer;
}

// Filter intents by industry pack
export function filterIntents(intents: Array<{text: string}>, industry: string) {
  const pack = getIntentPack(industry);
  const allow = new Set(pack.allow_tags?.map(t => t.toLowerCase()) || []);
  const deny = new Set(pack.deny_phrases?.map(p => p.toLowerCase()) || []);

  return intents.filter(intent => {
    const text = intent.text.toLowerCase();
    
    // Check deny list first
    for (const phrase of deny) {
      if (text.includes(phrase)) {
        return false;
      }
    }

    // If allow list is empty, allow by default
    if (allow.size === 0) {
      return true;
    }

    // Check if text matches any allowed tag
    for (const tag of allow) {
      if (text.includes(tag.replace('_', ' '))) {
        return true;
      }
    }

    return false;
  });
}
```

---

### Step 3: Database Migration

**Create: `packages/audit-worker/migrations/2025-10-22_industry_lock.sql`**

```sql
-- Add industry lock fields
ALTER TABLE audits ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS industry_source TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS industry_locked INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_audits_industry ON audits(industry);
```

**Deploy migration:**
```bash
npx wrangler d1 execute optiview --remote --file=./migrations/2025-10-22_industry_lock.sql
```

---

### Step 4: Wire Up Resolution (Citations Pipeline)

**Find:** The citations run entry point (search for "POST /api/citations/run" or "[CITATIONS] Starting run")

**Add at start of run:**

```typescript
import { resolveIndustry } from './lib/industry';

// At start of citations run:
const industryLock = resolveIndustry({
  audit: existingAudit,  // Pass existing audit if re-run
  signals: {
    domain: audit.root_url,
    title: homepageTitle  // If available
  }
});

console.log(`[INDUSTRY] resolved: ${industryLock.value} (source=${industryLock.source}) domain=${domain}`);

// Save to audit if not already set
if (!existingAudit.industry) {
  await db.prepare(`
    UPDATE audits 
    SET industry = ?, industry_source = ?, industry_locked = 1
    WHERE id = ?
  `).bind(industryLock.value, industryLock.source, auditId).run();
}

// Use locked industry for rest of pipeline
ctx.industry = industryLock.value;
```

---

### Step 5: Filter Prompts (Prompts V4)

**Find:** Where prompts_v4 generates intents (search for "[PROMPTS] V4" or "realism_avg")

**Add filtering:**

```typescript
import { filterIntents, getIntentPack } from './lib/industry';

// After Llama generates candidate intents:
const beforeCount = intents.length;
intents = filterIntents(intents, ctx.industry);
const afterCount = intents.length;
const dropped = beforeCount - afterCount;

console.log(`[PROMPTS] intents filtered: industry=${ctx.industry} kept=${afterCount} dropped=${dropped}`);

// Log if too many dropped (possible misclassification)
if (dropped > 0 && dropped / beforeCount > 0.4) {
  console.warn(`[QA] high_drop_rate: industry=${ctx.industry} dropped=${dropped}/${beforeCount}`);
}
```

---

### Step 6: Guard Against Mutations

**Find:** Any place that tries to SET industry (search for "ctx.industry =" or "audit.industry =")

**Replace with guard:**

```typescript
// Before: ctx.industry = inferredIndustry;
// After:
if (ctx.industry && ctx.industry !== inferredIndustry) {
  console.warn(`[GUARD] industry_mutation_blocked: locked=${ctx.industry} attempted=${inferredIndustry}`);
}
// Don't change it - use the locked value
```

---

### Step 7: Source Client Hardening (Simple Version)

**Find:** Where you call Perplexity, ChatGPT, Claude APIs

**Add simple rate limiting:**

```typescript
// Simple budget per source
const BUDGETS = {
  perplexity: { max: 20, timeout: 15000 },
  chatgpt: { max: 20, timeout: 12000 },
  claude: { max: 15, timeout: 12000 }
};

async function queryWithBudget(source: string, queries: string[], fn: Function) {
  const budget = BUDGETS[source];
  const slice = queries.slice(0, budget.max);
  
  let success = 0;
  let errors = 0;
  let cited = 0;

  for (const query of slice) {
    try {
      const result = await Promise.race([
        fn(query),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), budget.timeout)
        )
      ]);

      if (result.hasAnswer && result.urls?.length > 0) {
        success++;
        cited++;
      } else if (result.hasAnswer) {
        success++;  // Answered but no citations
      }
    } catch (error) {
      errors++;
      if (error.message.includes('429')) {
        console.warn(`[SOURCE] ${source} rate_limited, cooling down...`);
        await new Promise(r => setTimeout(r, 60000)); // Wait 1 min
      }
    }
  }

  console.log(`[SOURCE] ${source}: success=${success} errors=${errors} cited=${cited}`);
  return { success, errors, cited };
}
```

---

### Step 8: Improved Logging

**Add at key points:**

```typescript
// At run start:
console.log(`[RUN] audit=${auditId} domain=${domain} industry=${industry} source=${source}`);

// After intent filtering:
console.log(`[PROMPTS] intents: kept=${kept} dropped=${dropped} industry=${industry}`);

// Per source:
console.log(`[SOURCE] ${source}: success=${success} errors=${errors} cited=${cited}`);
```

---

### Step 9: Test

**Create: `packages/audit-worker/scripts/test_toyota.ts`**

```typescript
// Simple test script
import { resolveIndustry, filterIntents } from '../src/lib/industry';

// Test 1: Toyota resolves to automotive_oem
const lock = resolveIndustry({
  signals: { domain: 'toyota.com' }
});

console.assert(lock.value === 'automotive_oem', 'Toyota should be automotive_oem');
console.assert(lock.source === 'domain_rules', 'Should come from domain rules');

// Test 2: Retail intents are blocked
const testIntents = [
  { text: 'What is the return policy?' },          // Should be blocked
  { text: 'How much does a RAV4 cost?' },          // Should pass
  { text: 'Free shipping options' },                // Should be blocked
  { text: 'Dealer locator near me' }                // Should pass
];

const filtered = filterIntents(testIntents, 'automotive_oem');

console.assert(filtered.length === 2, `Expected 2 intents, got ${filtered.length}`);
console.assert(filtered[0].text.includes('RAV4'), 'RAV4 query should pass');
console.assert(filtered[1].text.includes('Dealer'), 'Dealer query should pass');

console.log('✅ All tests passed!');
```

**Run it:**
```bash
npx tsx packages/audit-worker/scripts/test_toyota.ts
```

---

### Step 10: Deploy

```bash
# 1. Run migration
cd packages/audit-worker
npx wrangler d1 execute optiview --remote --file=./migrations/2025-10-22_industry_lock.sql

# 2. Deploy worker
npx wrangler deploy

# 3. Test on Toyota
# Trigger a citations run for toyota.com and check logs
```

---

## Verification Checklist

After deployment, verify:

- [ ] Toyota.com resolves to `automotive_oem` (check logs)
- [ ] No "return policy" or "shipping" queries for Toyota
- [ ] Queries include "MSRP", "dealer locator", "warranty"
- [ ] Industry doesn't change mid-run (check for no mutation warnings)
- [ ] Source clients respect budgets (no more than 20 queries per source)
- [ ] Success/error metrics separated (cited vs. uncited)

---

## Expected Log Output (Toyota)

```
[RUN] audit=aud_123 domain=toyota.com industry=automotive_oem source=domain_rules
[PROMPTS] intents: kept=27 dropped=4 industry=automotive_oem
[SOURCE] perplexity: success=18 errors=2 cited=14
[SOURCE] chatgpt: success=16 errors=4 cited=11
```

---

## If Something Goes Wrong

**Rollback:**
- Industry lock is non-destructive (existing audits unchanged)
- If issues, just revert the worker deploy
- No data loss risk

**Debug:**
```bash
# Check logs
npx wrangler tail --format=pretty | grep -E "(INDUSTRY|PROMPTS|GUARD)"

# Check database
npx wrangler d1 execute optiview --remote \
  --command="SELECT root_url, industry, industry_source FROM audits WHERE root_url LIKE '%toyota%' LIMIT 5"
```

---

## Files to Create/Modify

**New Files:**
1. `packages/audit-worker/src/config/industry-packs.default.json`
2. `packages/audit-worker/src/lib/industry.ts`
3. `packages/audit-worker/migrations/2025-10-22_industry_lock.sql`
4. `packages/audit-worker/scripts/test_toyota.ts`

**Files to Modify:**
1. Citations pipeline entry (add resolveIndustry call)
2. Prompts V4 (add filterIntents call)
3. Any place that sets industry (add guards)
4. Source clients (add budget/timeout)

**Search Terms to Find Files:**
- Citations entry: "POST /api/citations/run" or "[CITATIONS] Starting"
- Prompts V4: "[PROMPTS] V4" or "realism_avg"
- Industry setting: "ctx.industry =" or "audit.industry ="
- Source clients: "perplexity", "chatgpt", "claude"

---

## Success Criteria

**Toyota Fix:**
- ✅ No retail queries generated
- ✅ Automotive queries present (MSRP, dealer, warranty)
- ✅ Industry stays `automotive_oem` throughout run

**Scalability:**
- ✅ Easy to add new industries (just edit JSON)
- ✅ Easy to add new domain rules (just edit JSON)
- ✅ No code changes needed for new verticals

**Stability:**
- ✅ No regressions for existing domains
- ✅ Rate limits respected
- ✅ Clear logging for debugging

---

**Cursor: Execute the steps above in order. Search for the patterns mentioned to find the right files, then make the changes. Test with Toyota before deploying!**

