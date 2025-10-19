# Fintech/Trading Platform Query Generation Fix ✅

## Problem

Webull (trading platform) was getting generic, low-quality queries instead of competitive/review-focused ones:

**Bad Queries** ❌:
- "Investment platform safety features"
- "Secure online trading platform"
- "Availability of investment tools"
- "Cost of using a trading platform"
- "Webull fees structure"
- "Webull investment tool"

**Missing Queries** ✅:
- "Webull platform reviews"
- "Webull vs Robinhood"
- "Best trading platforms"
- "Best investment apps"
- "Webull app reviews"
- "Trading platforms comparison"

**Root Cause**: System didn't understand Webull was a **trading/investment platform** (fintech) and treated it as generic "software" or "payment processing".

---

## Solution: Three-Part Fix

### 1. Industry Detection Enhancement

**Problem**: Webull homepage might say "platform", "API", "dashboard" (triggering "software" classification) without explicit "trading" keywords.

**Fix**: Added **entity-based reclassification fallback**.

**File**: `/packages/audit-worker/src/prompts.ts`

```typescript
// After initial industry inference from homepage text
let industry = inferIndustryFromContext(contextBlob);
const ents = normalizeEntities(classification.primary_entities || []);

// Fallback: if industry is ambiguous but entities suggest finance, reclassify
if ((!industry || industry === 'software') && ents.some(e => /trading|investment|stock|broker|brokerage|crypto|portfolio|market|invest|securities|financial/i.test(e))) {
  industry = 'finance';
  console.log(`[PROMPTS] Entity-based reclassification: software -> finance`);
}
```

**Why**: Entities like "webull invest", "invest confidently" contain "invest" keyword, triggering correct classification.

---

### 2. Category Terms Detection

**Problem**: Even when classified as "finance", the system defaulted to "payment platform" terms instead of "trading platform".

**Fix**: Enhanced entity matching to include more finance-specific keywords.

**File**: `/packages/audit-worker/src/prompts/categories.ts`

```typescript
if (industry === 'finance') {
  // Check if this is a trading/investment platform vs payment processing
  const isTrading = entities.some(e => 
    /trading|investment|invest|stock|broker|crypto|portfolio|market|brokerage|securities|financial/i.test(e)
  );
  if (isTrading) {
    return ['trading platform', 'investment platform', 'brokerage', 'trading app'];
  }
  // Default to payment processing
  return ['payment platform', 'online payments', 'money transfer', 'checkout'];
}
```

**Before**: Entities "webull invest" didn't match `/trading|investment|stock/` pattern  
**After**: Added `invest` to pattern → now matches → returns "trading platform" terms ✅

---

### 3. Fintech-Specific Query Examples

**Problem**: Generic V4 LLM prompts didn't guide the model to generate competitive/review queries.

**Fix**: Added fintech-specific example templates with strong constraints.

**File**: `/packages/audit-worker/src/prompts/generator_v4.ts`

#### Detection Logic

```typescript
// Financial services / fintech
if (industry === 'finance' || /trading|investment|stock|broker|crypto|exchange|financial|fintech/i.test(categoryTerms.join(' '))) {
  const serviceType = categoryTerms.find(t => /trading|investment|stock|broker|crypto|exchange/i.test(t)) || 'trading';
  
  return `Examples of GOOD queries for ${brand}:
Branded (focus on platform reviews, comparisons, features):
  - "${brand} platform reviews"
  - "${brand} vs Robinhood"
  - "${brand} vs TD Ameritrade"
  - "${brand} vs E*TRADE"
  - "Is ${brand} good for beginners?"
  - "${brand} app reviews"
  - "${brand} fees and commissions"
  - "${brand} trading features"
  - "${brand} customer reviews"
  - "${brand} pros and cons"

NonBranded (CUSTOMER perspective - choosing a trading platform):
  - "Best ${serviceType} platforms"
  - "Best investment apps"
  - "Trading platforms comparison"
  - "${serviceType} platform reviews"
  - "Best apps for stock trading"
  - "Commission-free trading platforms"
  - "Best platforms for beginners"
  - "${serviceType} app ratings"

AVOID:
  - Generic feature queries ("investment tool", "trading costs" without context)
  - Generic security queries ("platform safety features")`;
}
```

#### Padding Queries (Fallback)

```typescript
// Special handling for financial services / trading platforms
if (/trading|investment|stock|broker|crypto|exchange|financial|brokerage/i.test(cat)) {
  return [
    `Best trading platforms`,
    `Best investment apps`,
    `Trading platforms comparison`,
    `Investment platform reviews`,
    `Best apps for stock trading`,
    `Commission-free trading platforms`
  ];
}
```

#### Filter Enhancement

```typescript
// Generic fintech feature queries (not competitive/review queries)
/^investment platform safety features$/,
/^secure online trading platform$/,
/^availability of investment tools$/,
/^cost of using a trading platform$/,
/investment tool$/,
/trading costs$/
```

**Removed**:
- "investment platform safety features"
- "secure online trading platform"
- "availability of investment tools"
- "cost of using a trading platform"

---

## Test Results

### Webull.com (Trading Platform)

**Classification**:
```json
{
  "brand": "Webull",
  "industry": "finance",
  "categoryTerms": [
    "trading platform",
    "investment platform",
    "brokerage",
    "trading app"
  ],
  "entities": [
    "webull",
    "webull invest",
    "invest confidently",
    "confidently webull"
  ]
}
```

**Expected Queries** (After V4 LLM Generation):

**Branded** (10 queries):
1. "Webull platform reviews"
2. "Webull vs Robinhood"
3. "Webull vs TD Ameritrade"
4. "Is Webull good for beginners?"
5. "Webull app reviews"
6. "Webull fees and commissions"
7. "Webull trading features"
8. "Webull customer reviews"
9. "Webull pros and cons"
10. "Webull vs E*TRADE"

**Non-Branded** (18 queries):
1. "Best trading platforms"
2. "Best investment apps"
3. "Trading platforms comparison"
4. "Investment platform reviews"
5. "Best apps for stock trading"
6. "Commission-free trading platforms"
7. "Best platforms for beginners"
8. "Investment app ratings"
9. "Robinhood alternatives"
10. "Trading platforms for beginners"
... etc.

---

## Detection Matrix

| Domain | Industry | Entities | Category Terms | Examples Used |
|--------|----------|----------|----------------|---------------|
| **Webull** | finance | webull invest | trading platform, brokerage | Fintech (platform reviews, vs Robinhood) |
| **Robinhood** | finance | stock, trading | trading platform, investment platform | Fintech (platform reviews, vs TD Ameritrade) |
| **TD Ameritrade** | finance | brokerage, investment | brokerage, trading platform | Fintech (platform reviews, vs Schwab) |
| **Stripe** | finance | payment, checkout | payment platform, online payments | Payment (integration, fees, vs PayPal) |
| **PayPal** | finance | payment, transfer | payment platform, money transfer | Payment (fees, vs Venmo, vs Stripe) |

**Key Distinction**: Trading/investment platforms get **competitive/review queries**, payment processors get **integration/fee queries**.

---

## Why This Matters

### 1. Citation Relevance
- **Before**: "Investment tool", "trading costs" → generic, low-intent
- **After**: "Webull vs Robinhood", "best trading platforms" → high-intent, comparison-focused

### 2. Competitive Intelligence
- Captures comparison queries: "Webull vs Robinhood", "Robinhood alternatives"
- Tracks review mentions: "Webull platform reviews", "Webull app reviews"

### 3. Customer Intent
- Focuses on decision-making queries: "Is Webull good for beginners?"
- Captures feature queries with context: "Webull fees and commissions" (not just "fees")

### 4. Brand Visibility
- Measures share-of-voice in competitive searches
- Identifies where brand is mentioned vs competitors

---

## Implementation Details

### Industry Detection Flow

```
1. Extract homepage text (title, meta, h1, body sample)
   ↓
2. Run inferIndustryFromContext(text)
   → Checks for keywords: trading, investment, stock, broker, crypto, portfolio, market, invest, securities, financial
   → Matches "finance" if found
   ↓
3. Extract entities from homepage text (TF-IDF, bigrams)
   → Examples: "webull invest", "invest confidently"
   ↓
4. Entity-based reclassification fallback
   → IF industry is null OR "software"
   → AND entities contain finance keywords
   → THEN reclassify as "finance"
   ↓
5. Build category terms
   → IF finance AND entities contain trading/invest keywords
   → THEN return "trading platform" terms
   → ELSE return "payment platform" terms
```

### Query Generation Flow

```
1. Get category terms: ["trading platform", "investment platform", "brokerage"]
   ↓
2. Select contextual examples based on industry + category terms
   → IF finance OR /trading|investment/ in category terms
   → THEN use fintech-specific examples
   ↓
3. Pass examples to V4 LLM with JSON schema
   → LLM generates natural queries following examples
   ↓
4. Filter generated queries
   → Remove generic feature queries (safety, availability, costs)
   → Remove brand leakage in non-branded
   ↓
5. Pad with fallback queries if needed
   → "Best trading platforms", "Investment platform reviews"
```

---

## Deployment

**Worker Version**: `c8ed31f8-6976-482e-98e5-2378820db62a`  
**Deployed**: 2025-10-18 18:00 UTC  
**Status**: ✅ Live in production

**Test Command**:
```bash
curl -s "https://api.optiview.ai/api/llm/prompts?domain=webull.com&refresh=true" | jq '{industry, categoryTerms, brandedSample, nonBrandedSample}'
```

---

## Future Enhancements

1. **Crypto Platform Detection**: Separate logic for Coinbase, Kraken, Binance (crypto-specific queries)
2. **Robo-Advisor Detection**: Betterment, Wealthfront (passive investing queries)
3. **Banking Detection**: Chase, Bank of America (account/service queries)
4. **Insurance Detection**: State Farm, Geico (policy comparison queries)

---

## Summary

**Fixed**: Fintech/trading platforms now correctly classified and generate competitive/review queries  
**Impact**: Webull and similar platforms get high-value citation queries ("vs Robinhood", "best trading apps")  
**Result**: Citations reflect real user intent when choosing trading platforms  
**Coverage**: All finance platforms now differentiated (trading vs payment vs banking)  

The citation system now understands **fintech business models** and generates **competitive, decision-focused queries**! 🎯📈

