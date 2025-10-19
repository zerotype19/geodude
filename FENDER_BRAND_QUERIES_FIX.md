# Fender Brand Query Improvements ✅

## Problem

Fender citations were missing brand-focused queries:
- ❌ Should have: "best guitar brands", "fender guitar quality", "fender guitar models", "fender vs gibson"
- ❌ Got instead: "Best guitars for small businesses" (business operations query)
- ❌ Generic product queries instead of brand comparison queries

---

## Root Cause

The system wasn't distinguishing between:
1. **Guitar BRANDS** (Fender, Gibson, Martin) - manufacturers
2. **Guitar STORES** (Guitar Center, Sweetwater) - retailers

Both were treated the same, getting generic retail queries.

---

## Fixes Implemented

### Fix #1: Brand vs Retailer Detection

**File**: `/packages/audit-worker/src/prompts/generator_v4.ts`

Added logic to detect if a music/guitar company is a manufacturer or retailer:

```typescript
// Check if this is a guitar BRAND (Fender, Gibson, etc.) vs a RETAILER (Guitar Center, Sweetwater)
const isManufacturer = !/(center|shop|store|warehouse|depot|music|retailer|outlet)/i.test(brand);

if (isManufacturer) {
  // Guitar brand/manufacturer examples
  return `Examples of GOOD queries for ${brand}:
Branded (focus on product quality, models, comparisons):
  - "${brand} guitar quality"
  - "${brand} vs Gibson comparison"
  - "${brand} guitar models"
  - "Best ${brand} guitars for beginners"
  - "${brand} Stratocaster review"
  - "${brand} acoustic guitars"
  - "${brand} electric guitars"
  - "Are ${brand} guitars good quality?"
  - "${brand} guitar prices"
  - "${brand} guitar reviews"

NonBranded (CUSTOMER perspective - guitar shoppers):
  - "Best guitar brands"
  - "Guitar brand comparison"
  - "Which guitar brand is best for beginners"
  - "Electric guitar brands"
  - "Acoustic guitar brands"
  - "Guitar brand quality comparison"
  - "Top guitar manufacturers"
  - "Guitar brand reviews"`;
}
```

---

### Fix #2: Enhanced Category Terms

**File**: `/packages/audit-worker/src/prompts/categories.ts`

Added differentiation for guitar brands vs stores:

```typescript
if (hasMusic) {
  const isStore = entities.some(e => 
    /store|shop|center|retailer|warehouse|outlet/i.test(e)
  );
  if (isStore) {
    return ['guitar store', 'music store', 'instrument retailer', 'music shop'];
  } else {
    // Guitar brand/manufacturer
    return ['guitar brand', 'guitar manufacturer', 'instrument brand', 'music brand'];
  }
}
```

---

### Fix #3: Brand-Focused Padding

**File**: `/packages/audit-worker/src/prompts/generator_v4.ts`

```typescript
function padNonBranded(cat: string): string[] {
  if (/guitar|instrument/i.test(cat)) {
    const isStore = /store|shop|retailer/i.test(cat);
    if (isStore) {
      // Guitar store queries
      return [
        `Where to buy guitars online`,
        `Best music stores for beginners`,
        `Guitar store price comparison`,
        ...
      ];
    } else {
      // Guitar brand queries
      return [
        `Best guitar brands`,
        `Guitar brand comparison`,
        `Top guitar manufacturers`,
        `Which guitar brand is best`,
        `Electric guitar brands`,
        `Acoustic guitar brands`
      ];
    }
  }
}
```

---

### Fix #4: Improved Industry Detection

**File**: `/packages/audit-worker/src/prompts/infer.ts`

Expanded "retail" industry to include guitar/music manufacturers:

```typescript
['retail', /\b(retail|ecommerce|SKU|cart|checkout|store|merch|apparel|guitar|instrument|music|drum|piano|bass|amp|pedal|product|buy|shop|purchase)\b/],
```

**Why**: Fender wasn't being classified as "retail" because they don't use keywords like "store" or "cart" - they're a manufacturer, not a retailer.

---

### Fix #5: Tightened Business Operations Filter

Added patterns to catch "for small businesses":

```typescript
function isBusinessOperationsQuery(q: string): boolean {
  const badPatterns = [
    ...
    /for small businesses$/,  // Catch "Best X for small businesses"
    /for (startups|enterprises|companies|businesses)/
  ];
}
```

---

## Expected Results

### For Fender (Guitar Brand):

**Branded Queries**:
- "Fender guitar quality"
- "Fender vs Gibson comparison"
- "Fender guitar models"
- "Best Fender guitars for beginners"
- "Fender Stratocaster review"
- "Fender acoustic guitars"
- "Fender electric guitars"
- "Are Fender guitars good quality?"
- "Fender guitar prices"
- "Fender guitar reviews"

**Non-Branded Queries**:
- "Best guitar brands"
- "Guitar brand comparison"
- "Which guitar brand is best for beginners"
- "Electric guitar brands"
- "Acoustic guitar brands"
- "Guitar brand quality comparison"
- "Top guitar manufacturers"
- "Guitar brand reviews"

### For Guitar Center (Guitar Retailer):

**Branded Queries**:
- "Guitar Center guitar prices"
- "Where to buy guitars from Guitar Center"
- "Guitar Center return policy"
- "Guitar Center customer reviews"
- "Guitar Center vs Sweetwater comparison"
- "Guitar Center used guitar inventory"

**Non-Branded Queries**:
- "Where to buy guitars online"
- "Best music stores for beginners"
- "Guitar store price comparison"
- "Music store return policies"
- "Online guitar retailers"

---

## Deployment

**Worker Version**: `2a0f9106-cd1c-47a8-8e80-4f00a3b67026`  
**Deployed**: 2025-10-18 17:00 UTC  
**Status**: ✅ Live in production

---

## Cache Note

Existing citations will use old queries until:
1. **New audits** - get new queries immediately
2. **Re-audited domains** - regenerate prompts on next audit
3. **7-day cache expiry** - automatic refresh
4. **Hourly cron** - 100 least-recently-updated domains

To see improved Fender queries, wait for cache expiry or re-run the audit.

---

## Testing

```bash
# Check Fender query generation
curl -s "https://api.optiview.ai/api/llm/prompts?domain=fender.com" | jq '{brand, industry, categoryTerms, branded, nonBranded}'

# Expected output:
# - brand: "Fender"
# - industry: "retail"
# - categoryTerms: ["guitar brand", "guitar manufacturer", "instrument brand"]
# - branded: [...brand quality/model queries...]
# - nonBranded: ["Best guitar brands", "Guitar brand comparison", ...]
```

---

## Summary

**Fixed**: Guitar brands now get brand-focused queries (quality, models, comparisons)  
**Fixed**: Guitar stores get store-focused queries (where to buy, prices, return policies)  
**Fixed**: Removed business operations queries ("for small businesses")  
**Result**: Higher-quality, more relevant citations for both manufacturers and retailers  

The system now intelligently differentiates between **brands** and **stores** in the music/guitar industry! 🎸

