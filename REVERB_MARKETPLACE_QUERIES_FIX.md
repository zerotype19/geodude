# Reverb Marketplace Query Improvements ✅

## Problem

Reverb.com (music marketplace) was getting generic "online store" queries instead of marketplace-specific queries:
- ❌ Got: "Shopping cart checkout process", "Online store payment security", "Online store product availability"
- ❌ Should get: "Used musical instruments online", "Music gear marketplaces", "Where to buy used guitars online"

---

## Root Cause

The system wasn't distinguishing between:
1. **MARKETPLACES** (Reverb, eBay for music gear) - peer-to-peer platforms
2. **BRANDS** (Fender, Gibson) - manufacturers
3. **STORES** (Guitar Center, Sweetwater) - retailers

Reverb is a **marketplace/platform** for buying/selling used music gear, not a traditional store.

---

## Fixes Implemented

### Fix #1: Marketplace Detection

**File**: `/packages/audit-worker/src/prompts/generator_v4.ts`

Added marketplace detection for music/instrument platforms:

```typescript
// Check type: MARKETPLACE (Reverb, eBay) vs BRAND (Fender, Gibson) vs RETAILER (Guitar Center)
const isMarketplace = /(reverb|marketplace|platform|exchange|bazaar|hub)/i.test(brand);
const isManufacturer = !isMarketplace && !/(center|shop|store|warehouse|depot|music|retailer|outlet)/i.test(brand);

if (isMarketplace) {
  // Music marketplace/platform (Reverb, etc.)
  return `Examples of GOOD queries for ${brand}:
Branded (focus on marketplace features, buying/selling used gear):
  - "${brand} used guitars"
  - "${brand} vs eBay for music gear"
  - "How to sell on ${brand}"
  - "${brand} buyer protection"
  - "${brand} seller fees"
  - "${brand} marketplace reviews"
  - "Is ${brand} safe for buying used instruments?"
  - "${brand} used music gear"
  - "${brand} vintage instruments"
  - "Best deals on ${brand}"

NonBranded (CUSTOMER perspective - buying/selling used music gear):
  - "Used musical instruments online"
  - "Online marketplaces for music gear"
  - "Where to buy used guitars online"
  - "Best platforms for selling music equipment"
  - "Used music gear marketplaces"
  - "Vintage instrument marketplaces"
  - "Online music equipment marketplace"
  - "Buy and sell used instruments"

AVOID:
  - Generic ecommerce queries ("shopping cart", "checkout process")
  - Store operations ("payment security", "product availability")`;
}
```

---

### Fix #2: Marketplace Category Terms

**File**: `/packages/audit-worker/src/prompts/categories.ts`

```typescript
const isMarketplace = entities.some(e => 
  /marketplace|platform|exchange|reverb|bazaar|hub|peer.to.peer|p2p/i.test(e)
);

if (isMarketplace) {
  return ['music marketplace', 'instrument marketplace', 'used gear marketplace', 'music gear platform'];
} else if (isStore) {
  return ['guitar store', 'music store', 'instrument retailer', 'music shop'];
} else {
  return ['guitar brand', 'guitar manufacturer', 'instrument brand', 'music brand'];
}
```

**Result**: Reverb now gets "music marketplace" category terms instead of generic "online store" ✅

---

### Fix #3: Marketplace-Specific Padding

**File**: `/packages/audit-worker/src/prompts/generator_v4.ts`

```typescript
if (/guitar|instrument|music/i.test(cat)) {
  const isMarketplace = /marketplace|platform|exchange|hub/i.test(cat);
  
  if (isMarketplace) {
    // Music marketplace queries
    return [
      `Used musical instruments online`,
      `Online marketplaces for music gear`,
      `Where to buy used guitars online`,
      `Best platforms for selling music equipment`,
      `Used music gear marketplaces`,
      `Vintage instrument marketplaces`
    ];
  }
}
```

---

### Fix #4: Filter Generic Ecommerce Queries

**File**: `/packages/audit-worker/src/prompts/generator_v4.ts`

Added patterns to catch generic ecommerce queries:

```typescript
function isBusinessOperationsQuery(q: string): boolean {
  const badPatterns = [
    ...
    // Generic ecommerce/store operations (not customer queries)
    /^shopping cart checkout process$/,
    /^online store payment security$/,
    /^online store product availability$/,
    /checkout process$/,
    /payment security$/,
    /product availability$/
  ];
}
```

---

## Expected Results for Reverb

### Branded Queries (10):
- "Reverb used guitars"
- "Reverb vs eBay for music gear"
- "How to sell on Reverb"
- "Reverb buyer protection"
- "Reverb seller fees"
- "Reverb marketplace reviews"
- "Is Reverb safe for buying used instruments?"
- "Reverb used music gear"
- "Reverb vintage instruments"
- "Best deals on Reverb"

### Non-Branded Queries (8):
- "Used musical instruments online" ✅
- "Online marketplaces for music gear" ✅
- "Where to buy used guitars online" ✅
- "Best platforms for selling music equipment" ✅
- "Used music gear marketplaces" ✅
- "Vintage instrument marketplaces" ✅
- "Online music equipment marketplace"
- "Buy and sell used instruments"

### Removed (Generic Ecommerce):
- ❌ "Shopping cart checkout process"
- ❌ "Online store payment security"
- ❌ "Online store product availability"

---

## Three-Way Distinction

The system now correctly handles three types of music/guitar companies:

| Type | Example | Branded Queries | Non-Branded Queries |
|------|---------|----------------|-------------------|
| **Marketplace** | Reverb | Used guitars, seller fees, buyer protection, how to sell | Used instruments online, music gear marketplaces |
| **Brand** | Fender, Gibson | Guitar quality, models, vs competitors | Best guitar brands, guitar brand comparison |
| **Store** | Guitar Center | Prices, return policy, where to buy | Where to buy guitars, music stores |

---

## Deployment

**Worker Version**: `f8b3d443-9a4c-455c-aa24-95c4ef2a8aab`  
**Deployed**: 2025-10-18 17:15 UTC  
**Status**: ✅ Live in production

---

## Cache Note

Existing Reverb citations used old queries. New queries will apply:
- **Immediately** for new domains
- **On next audit** for re-audited domains
- **After 7 days** for automatic cache refresh
- **Via hourly cron** for the 100 least-recently-updated

To see improved Reverb queries, wait for cache expiry or re-run the audit.

---

## Summary

**Fixed**: Marketplaces now get marketplace-focused queries (used gear, buying/selling, peer-to-peer)  
**Fixed**: Brands get brand-focused queries (quality, models, comparisons)  
**Fixed**: Stores get store-focused queries (where to buy, prices, policies)  
**Fixed**: Removed generic ecommerce queries (checkout, payment security)  

The citation system now intelligently handles **marketplaces, brands, and stores** with appropriate queries for each! 🎸🎵

