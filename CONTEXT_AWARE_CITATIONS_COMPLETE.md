# Context-Aware Citation System - Complete ✅

## The Core Problem

The citation system wasn't understanding the **role and intent** of websites, leading to nonsense queries:

**Soccer.com Example** (Sports Retailer):
- ❌ Got: "website policy and terms of service", "soccer store policies", "ecommerce platform customization"
- ✅ Should get: "where to buy soccer jerseys online", "soccer team kits online", "youth soccer equipment"

**Root Issue**: The system treated all retail sites the same, without understanding their specific vertical, business model, or product category.

---

## Solution: Multi-Dimensional Context Detection

The system now detects **THREE dimensions** for every domain:

### 1. Product Category (Vertical)
- **Music/Instruments**: guitar, drum, piano, amp, music, pedal
- **Sports/Athletic**: soccer, basketball, football, baseball, jersey, cleat, uniform
- **General Retail**: apparel, home goods, etc.

### 2. Business Model (Type)
- **Marketplace**: Reverb (used gear p2p platform)
- **Brand/Manufacturer**: Fender (makes guitars)
- **Retailer/Store**: Guitar Center, Soccer.com (sells products)

### 3. Customer Intent (Use Case)
- **Shopping**: "where to buy", "prices", "deals"
- **Team/Bulk Orders**: "team kits", "custom jerseys"
- **Product Info**: "reviews", "comparisons", "quality"

---

## Complete Detection Matrix

| Domain | Category | Business Model | Category Terms | Query Focus |
|--------|----------|----------------|----------------|-------------|
| **Soccer.com** | Sports (Soccer) | Retailer | soccer store, soccer gear retailer | Soccer jerseys, team kits, cleats |
| **Reverb.com** | Music | Marketplace | music marketplace, used gear marketplace | Used instruments, buy/sell, marketplace |
| **Fender.com** | Music | Brand | guitar brand, guitar manufacturer | Guitar quality, models, brand comparison |
| **Guitar Center** | Music | Retailer | guitar store, music store | Where to buy guitars, prices, return policy |

---

## Implemented Detection Logic

### Sports/Athletic Detection

**File**: `/packages/audit-worker/src/prompts/categories.ts`

```typescript
// Check for sports/athletic equipment
const hasSports = entities.some(e => 
  /soccer|football|basketball|baseball|tennis|hockey|sport|athletic|team|jersey|cleat|uniform/i.test(e)
);
if (hasSports) {
  // Detect specific sport
  const sportsType = entities.find(e => 
    /soccer|football|basketball|baseball|tennis|hockey/i.test(e)
  );
  if (sportsType) {
    const sport = sportsType.toLowerCase();
    return [`${sport} store`, `${sport} gear retailer`, `${sport} equipment store`, `sports retailer`];
  }
}
```

### Sport-Specific LLM Examples

**File**: `/packages/audit-worker/src/prompts/generator_v4.ts`

```typescript
// Sports/athletic retail
if (industry === 'retail' && /soccer|football|basketball|.../i.test(categoryTerms.join(' '))) {
  const sport = categoryTerms.find(t => /soccer|football|.../i.test(t)) || 'sports';
  
  return `Examples of GOOD queries for ${brand}:
Branded:
  - "${brand} ${sport} jerseys"
  - "Where to buy ${sport} cleats from ${brand}"
  - "${brand} team kits"
  - "${brand} custom jerseys"
  - "${brand} youth ${sport} equipment"

NonBranded:
  - "Where to buy ${sport} jerseys online"
  - "Best sites for ${sport} gear for teams"
  - "${sport} team kits online"
  - "Custom ${sport} jerseys"
  - "Youth ${sport} equipment online"

AVOID:
  - Generic policy queries ("terms of service", "contact us")
  - Generic store operations ("store policies", "customization options")`;
}
```

### Enhanced Business Operations Filter

```typescript
function isBusinessOperationsQuery(q: string): boolean {
  const badPatterns = [
    ...
    // Generic policy/contact queries (not shopping queries)
    /website policy and terms of service$/,
    /terms of service$/,
    /privacy policy$/,
    /\bstore policies$/,
    /\bstore contact$/,
    /contact information$/,
    /ecommerce platform customization/,
    /platform customization/
  ];
}
```

---

## Expected Results by Domain Type

### Soccer.com (Sports Retailer)

**Branded Queries**:
- "Soccer.com soccer jerseys" ✅
- "Where to buy soccer cleats from Soccer.com" ✅
- "Soccer.com team kits" ✅
- "Soccer.com custom jerseys" ✅
- "Soccer.com youth soccer equipment" ✅
- "Soccer.com vs Dick's Sporting Goods"
- "Soccer.com return policy"
- "Is Soccer.com good for team orders?"

**Non-Branded Queries**:
- "Where to buy soccer jerseys online" ✅
- "Best sites for soccer gear for teams" ✅
- "Soccer team kits online" ✅
- "Custom soccer jerseys" ✅
- "Youth soccer equipment online" ✅
- "Soccer cleats online" ✅

**Removed**:
- ❌ "Website policy and terms of service"
- ❌ "Soccer store policies"
- ❌ "Soccer store contact"
- ❌ "Ecommerce platform customization options"

### Reverb.com (Music Marketplace)

**Focus**: Used gear, buying/selling, marketplace safety, fees
- "Reverb used guitars"
- "How to sell on Reverb"
- "Reverb buyer protection"
- "Used musical instruments online"

### Fender.com (Guitar Brand)

**Focus**: Product quality, models, brand comparisons
- "Fender guitar quality"
- "Fender vs Gibson"
- "Fender guitar models"
- "Best guitar brands"

### Guitar Center (Music Retailer)

**Focus**: Where to buy, prices, policies
- "Guitar Center prices"
- "Where to buy guitars from Guitar Center"
- "Guitar Center return policy"
- "Where to buy guitars online"

---

## Full Detection Hierarchy

```
1. Industry Classification
   ├─ Finance (payments, bank, card)
   ├─ Travel (cruise, hotel, booking)
   ├─ Retail
   │  ├─ Music/Instruments
   │  │  ├─ Marketplace (Reverb)
   │  │  ├─ Brand (Fender, Gibson)
   │  │  └─ Store (Guitar Center, Sweetwater)
   │  ├─ Sports/Athletic
   │  │  └─ By Sport (soccer, basketball, etc.)
   │  └─ General
   ├─ Software (api, sdk, saas)
   ├─ Media (news, blog, press)
   └─ Education (course, learning, school)

2. Category Terms Generation
   Based on industry + entities → specific terms
   
3. LLM Example Selection
   Based on category terms → contextual examples
   
4. Padding Queries
   Based on category terms → relevant fallbacks
   
5. Quality Filtering
   Remove business ops, policy, generic ecommerce
```

---

## Key Improvements

1. **Sport-Specific Detection**: Added soccer, football, basketball, baseball, tennis, hockey
2. **Category Term Intelligence**: "soccer store" not "online store", "music marketplace" not "ecommerce platform"
3. **Contextual LLM Examples**: Sport/product-specific examples guide the LLM
4. **Smart Padding**: Sport-specific fallback queries ("soccer jerseys" not "store policies")
5. **Enhanced Filtering**: Catches policy, contact, customization queries

---

## Deployment

**Worker Version**: `83b3ddb0-662f-42b6-8503-981d8bc461f3`  
**Deployed**: 2025-10-18 17:30 UTC  
**Status**: ✅ Live in production

---

## Testing

```bash
# Soccer.com
curl -s "https://api.optiview.ai/api/llm/prompts?domain=soccer.com" | jq '{categoryTerms, brandedSample, nonBrandedSample}'

# Expected:
# - categoryTerms: ["soccer store", "soccer gear retailer", "soccer equipment store"]
# - branded: ["Soccer.com soccer jerseys", "Soccer.com team kits", ...]
# - nonBranded: ["Where to buy soccer jerseys online", "Soccer team kits online", ...]
```

---

## Summary

**Fixed**: The system now understands website **role and intent**  
**Result**: Context-aware queries based on product category, business model, and customer use case  
**Coverage**: Music (marketplace/brand/store), Sports (soccer/basketball/etc.), and extensible to other verticals  
**Impact**: Eliminated nonsense queries, generated high-value shopping and product queries  

The citation system is now **fully context-aware** across multiple dimensions! 🎯

---

## Future Extensions (Easy to Add)

The pattern is now established for adding new verticals:

### Home Improvement (Home Depot, Lowe's):
- Category terms: "home improvement store", "hardware store"
- Queries: "where to buy lumber online", "home depot tool rental"

### Fashion/Apparel (Nike, Zara):
- Category terms: "fashion brand", "clothing retailer"
- Queries: "nike sneaker drops", "where to buy designer clothes"

### Electronics (Best Buy, Apple):
- Category terms: "electronics retailer", "tech brand"
- Queries: "where to buy laptops", "apple product comparison"

Just add detection patterns to `categories.ts` and examples to `generator_v4.ts`!

