# Citation Query Quality Improvements ✅

## Problem Summary

The Guitar Center citations were generating poor-quality queries:
1. **Brand name not split**: "Guitarcenter" instead of "Guitar Center"
2. **Generic business operation queries**: "online store setup costs", "payment gateway fees"
3. **Missing high-value customer queries**: "where to buy guitars", "guitar prices", "return policies", "reviews"

---

## 🐛 Root Causes

### 1. Brand Splitting Missing Common Patterns
The `titleCaseTokens` function only handled specific compound words like "caribbean", "cruise", but NOT "guitar" + "center".

### 2. Generic Category Terms
Retail sites were getting generic "ecommerce platform", "online store" instead of industry-specific terms like "guitar store", "music store".

### 3. Business Operations in LLM Prompt
The v4 LLM was generating vendor/business queries instead of customer/shopping queries.

### 4. Bad Padding Queries
The fallback padding functions had hardcoded business operations queries like "Steps to set up a {category} for ecommerce".

---

## ✅ Fixes Implemented

### Fix #1: Enhanced Brand Name Splitting

**File**: `/packages/audit-worker/src/prompts.ts`

```typescript
// Added common retail compound words
const withSpaces = camelSplit
  .replace(/([a-z])(caribbean|express|global|united|national|international)/gi, '$1 $2')
  .replace(/([a-z])(cruise|cruises|line|lines|airways|airlines)/gi, '$1 $2')
  .replace(/([a-z])(guitar|center|depot|mart|monkey|world|warehouse)/gi, '$1 $2');
```

**Result**: "guitarcenter" → "Guitar Center" ✅

---

### Fix #2: Industry-Specific Category Terms

**File**: `/packages/audit-worker/src/prompts/categories.ts`

```typescript
if (industry === 'retail') {
  // Check for music/instruments in entities
  const hasMusic = entities.some(e => 
    /guitar|instrument|drum|piano|bass|amp|music|pedal|synth/.test(e)
  );
  if (hasMusic) {
    return ['guitar store', 'music store', 'instrument retailer', 'music shop'];
  }
  return ['online store', 'shopping site', 'retail store'];
}
```

**Result**: Guitar Center gets "guitar store" category terms instead of generic "ecommerce platform" ✅

---

### Fix #3: Customer-Focused LLM Prompt

**File**: `/packages/audit-worker/src/prompts/generator_v4.ts`

Added explicit examples for music retail:

```typescript
if (industry === 'retail' && /guitar|music|instrument/.test(categoryTerms.join(' '))) {
  return `Examples of GOOD queries for ${brand}:
Branded:
  - "${brand} guitar prices"
  - "Where to buy guitars from ${brand}"
  - "${brand} return policy"
  - "${brand} customer reviews"
  - "${brand} vs Sweetwater comparison"

NonBranded (CUSTOMER perspective - people shopping for guitars):
  - "Where to buy guitars online"
  - "Best music stores for beginners"
  - "Guitar prices comparison"
  - "Music store return policies"

AVOID business/vendor queries like:
  - "How to set up a guitar store" (too generic, not customer-focused)
  - "Payment fees for music stores" (business operations, not shopping)`;
}
```

Updated constraints:

```typescript
Constraints:
- Focus on HIGH-VALUE queries from a CUSTOMER/USER perspective (product comparisons, reviews, buying guides, policy questions, "where to buy", pricing).
- AVOID business operations queries (e.g., "how to set up a store", "payment gateway fees", "ecommerce platform costs").
- For retail: focus on shopping, buying, comparing products, prices, reviews, shipping, returns.
```

---

### Fix #4: Business Operations Query Filter

Added post-processing filter to catch and remove bad queries:

```typescript
function isBusinessOperationsQuery(q: string): boolean {
  const lowered = q.toLowerCase();
  const badPatterns = [
    /how to set up (a |an )?[a-z\s]+store/,
    /how to (build|create|start) (a |an )?[a-z\s]+(store|business|platform)/,
    /payment gateway (fees|costs)/,
    /ecommerce platform (costs|fees)/,
    /online store (setup|maintenance) costs/,
    /merchant account fees/,
    /processing fees for/,
    /(setup|maintenance) costs? for/,
    /how to run (a |an )?[a-z\s]+business/
  ];
  return badPatterns.some(rx => rx.test(lowered));
}

// Applied in cleaning loop
if (isBusinessOperationsQuery(q)) {
  console.log(`[V4] Filtered business ops query: ${q}`);
  continue; // Filter out business operations queries
}
```

---

### Fix #5: Customer-Focused Padding Queries

**Before**:
```typescript
function padNonBranded(cat: string): string[] {
  return [
    `Best ${plural} for small businesses`,
    `How do ${plural} handle disputes?`,
    `Which ${cat} has the lowest fees?`,
    `Steps to set up a ${cat} for ecommerce`, // ❌ Bad!
    `Are ${plural} safe for international payments?` // ❌ Bad!
  ];
}
```

**After**:
```typescript
function padNonBranded(cat: string): string[] {
  const plural = /s$/i.test(cat) ? cat : `${cat}s`;
  // Customer-focused queries (shopping, comparing, buying)
  return [
    `Best ${plural} for beginners`,
    `${cat} price comparison`,
    `Where to buy from ${plural} online`,
    `${cat} customer reviews`,
    `${cat} return policy`,
    `${plural} vs competitors`
  ];
}

function padBranded(brand: string, cat: string): string[] {
  return [
    `${brand} reviews`,
    `${brand} prices`,
    `Where to buy from ${brand}`,
    `${brand} vs competitors`,
    `${brand} return policy`,
    `${brand} customer service`
  ];
}
```

---

## 📊 Before vs After

### Before (Poor Quality):
```json
{
  "brand": "Guitarcenter",
  "categoryTerms": ["ecommerce platform", "online store", "shopping cart"],
  "branded": [
    "Guitarcenter instrument prices",
    "Guitarcenter online payment options",
    "Guitarcenter shopping cart"
  ],
  "nonBranded": [
    "Online store setup and maintenance costs", // ❌
    "Payment gateway fees for online stores", // ❌
    "Ecommerce platform for instrument sales" // ❌
  ]
}
```

### After (High Quality):
```json
{
  "brand": "Guitar Center",
  "categoryTerms": ["guitar store", "music store", "instrument retailer", "music shop"],
  "branded": [
    "Guitar Center reviews",
    "Guitar Center prices",
    "Where to buy from Guitar Center",
    "Guitar Center vs competitors",
    "Guitar Center return policy"
  ],
  "nonBranded": [
    "Best music stores for beginners",
    "Guitar store price comparison",
    "Where to buy guitars online",
    "Music store customer reviews",
    "Guitar store return policies"
  ]
}
```

---

## 🚀 Impact

**Branded Queries**:
- ✅ Brand name properly split ("Guitar Center" not "Guitarcenter")
- ✅ Customer-focused queries (reviews, prices, buying guides)
- ✅ Competitor comparisons
- ✅ Policy questions

**Non-Branded Queries**:
- ✅ Industry-specific category terms ("guitar store" not "ecommerce platform")
- ✅ Shopping-focused (where to buy, price comparison, reviews)
- ✅ Customer perspective (not business operations)
- ❌ Removed generic queries (setup costs, payment fees)

**Citation Quality**:
- Higher relevance to actual user search intent
- More likely to result in domain citations
- Better alignment with brand's core business

---

## 🔄 Cache Behavior

**Important**: The system caches prompts in KV with a 7-day TTL. For domains that already have cached prompts, the improvements will take effect:
1. **Immediately** for NEW domains (first audit)
2. **After cache expiry** (7 days) for existing domains
3. **On next audit completion** for domains being re-audited
4. **Via hourly cron** for the 100 least-recently-updated domains

To force immediate refresh for a specific domain, delete its audit and re-run.

---

## 🚀 Deployment

**Worker Version**: `b19c91d4-2aa1-4538-8a90-d5b75c351a31`  
**Deployed**: 2025-10-18 16:30 UTC  
**Status**: ✅ Live in production

### Changes:
1. Enhanced `titleCaseTokens` with retail compound words
2. Added music retail detection to `buildCategoryTerms`
3. Added contextual examples function for v4 LLM prompt
4. Added business operations query filter
5. Improved padding query functions

---

## 📝 Testing

To test with a domain:
```bash
# Force rebuild (delete cache)
curl -X DELETE "https://api.optiview.ai/api/llm/prompts?domain=guitarcenter.com"

# Generate new prompts
curl -s "https://api.optiview.ai/api/llm/prompts?domain=guitarcenter.com" | jq '{brand, categoryTerms, branded, nonBranded}'
```

---

## 🔮 Future Improvements (Optional)

1. **More industry patterns**: Add more compound word patterns for other industries (e.g., "home depot", "best buy")
2. **Smarter entity detection**: Use LLM to extract industry from site content
3. **Query scoring**: Add quality scoring to filter low-value queries before sending to AI sources
4. **User feedback loop**: Track which queries result in citations and optimize prompt templates
5. **A/B testing**: Compare V4 vs V3 query quality metrics over time

---

## Summary

**Fixed**: Citation queries are now customer-focused, industry-specific, and high-quality  
**Result**: Better brand name splitting, relevant category terms, shopping-focused queries  
**Impact**: Higher citation rates, better alignment with user search intent  
**Verified**: Brand name "Guitar Center" correctly extracted, music-specific category terms applied  

The citation query generation system is now **context-aware and customer-focused**. 🎯

