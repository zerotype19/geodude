# Insurance Query Generation Fix ✅

## Problem

Amica (insurance company) was getting generic "setup/customization" queries instead of competitive/review-focused ones:

**Bad Queries** ❌:
- "How do I customize my insurance policy"
- "What are the availability options for insurance policies"
- "What is the process for setting up an insurance policy"
- "How does Amica handle claims and disputes?"
- "How does Amica support small business owners?"

**Missing Queries** ✅:
- "Amica insurance reviews"
- "Amica vs State Farm"
- "Amica vs Geico"
- "Best auto insurance companies"
- "Auto insurance reviews"
- "Amica auto insurance rates"

**Root Cause**: System didn't recognize Amica as an **insurance company** and generated generic service queries instead of competitive insurance-shopping queries.

---

## Solution: Four-Part Fix

### 1. Insurance Industry Detection

**Problem**: "Insurance" was not a recognized industry category, defaulting to generic classification.

**Fix**: Added **insurance as a top-level industry** with comprehensive keyword detection.

**File**: `/packages/audit-worker/src/prompts/infer.ts`

```typescript
const map: [string, RegExp][] = [
  // Insurance: auto, home, life, health, property
  ['insurance', /\b(insurance|insurer|auto insurance|home insurance|life insurance|health insurance|property insurance|coverage|policy|premium|claim|underwriting|liability)\b/],
  // Finance: expanded to include trading/investment platforms
  ['finance', /\b(payments?|bank|wallet|...)\b/],
  // ... other industries
];
```

**Detection Keywords**:
- Insurance terms: `insurance`, `insurer`, `coverage`, `policy`, `premium`, `claim`, `underwriting`, `liability`
- Specific types: `auto insurance`, `home insurance`, `life insurance`, `health insurance`, `property insurance`

---

### 2. Insurance Type-Specific Category Terms

**Problem**: Generic "insurance company" terms instead of specific types like "auto insurance company".

**Fix**: Enhanced category term builder to detect insurance types from entities.

**File**: `/packages/audit-worker/src/prompts/categories.ts`

```typescript
if (industry === 'insurance') {
  // Check if auto, home, life, health, or general
  const insuranceType = entities.find(e => /auto|car|vehicle|home|property|life|health/i.test(e));
  if (insuranceType) {
    const type = insuranceType.match(/auto|car|vehicle/i) ? 'auto' :
                 insuranceType.match(/home|property/i) ? 'home' :
                 insuranceType.match(/life/i) ? 'life' :
                 insuranceType.match(/health/i) ? 'health' : 'insurance';
    return [`${type} insurance company`, `${type} insurance provider`, 'insurance company'];
  }
  return ['insurance company', 'insurance provider', 'insurer'];
}
```

**Type Detection**:
- Auto: `auto`, `car`, `vehicle` → "auto insurance company"
- Home: `home`, `property` → "home insurance company"
- Life: `life` → "life insurance company"
- Health: `health` → "health insurance company"

---

### 3. Insurance-Specific Query Examples

**Problem**: Generic V4 LLM prompts didn't guide the model to generate competitive/review queries for insurance.

**Fix**: Added insurance-specific example templates with strong focus on comparisons and reviews.

**File**: `/packages/audit-worker/src/prompts/generator_v4.ts`

#### Detection Logic

```typescript
// Insurance companies
if (industry === 'insurance' || /insurance|insurer|coverage|policy|premium|claim/i.test(categoryTerms.join(' '))) {
  const insuranceType = categoryTerms.find(t => /auto|home|life|health/i.test(t)) || 'insurance';
  const typeClean = insuranceType.replace(/\s+(insurance|company|provider).*$/i, '').trim() || 'insurance';
  
  return `Examples of GOOD queries for ${brand}:
Branded (focus on reviews, comparisons, products, pricing):
  - "${brand} insurance reviews"
  - "${brand} vs State Farm"
  - "${brand} vs Geico"
  - "${brand} vs Progressive"
  - "${brand} auto insurance rates"
  - "${brand} home insurance coverage"
  - "Is ${brand} insurance good?"
  - "${brand} customer reviews"
  - "${brand} insurance pricing"
  - "${brand} claims process"

NonBranded (CUSTOMER perspective - shopping for insurance):
  - "Best ${typeClean} insurance companies"
  - "${typeClean} insurance reviews"
  - "${typeClean} insurance comparison"
  - "Cheapest ${typeClean} insurance"
  - "Best rated ${typeClean} insurance"
  - "${typeClean} insurance for good drivers"
  - "Top ${typeClean} insurance providers"
  - "${typeClean} insurance quotes"

AVOID:
  - Generic setup queries ("How do I customize my policy", "setup process")
  - Generic availability queries ("availability options")
  - Business operations ("support small business owners")`;
}
```

#### Padding Queries (Fallback)

```typescript
// Special handling for insurance companies
if (/insurance|insurer|coverage|policy|premium/i.test(cat)) {
  const type = cat.match(/auto|home|life|health/i)?.[0] || 'insurance';
  return [
    `Best ${type} insurance companies`,
    `${type} insurance reviews`,
    `${type} insurance comparison`,
    `Cheapest ${type} insurance`,
    `Top ${type} insurance providers`,
    `${type} insurance ratings`
  ];
}
```

#### Filter Enhancement

```typescript
// Generic insurance setup/customization queries (not shopping queries)
/^how do i customize my insurance policy$/,
/^what are the availability options for insurance policies$/,
/^what is the process for setting up an insurance policy$/,
/^what is the setup process for.*insurance\??$/,
/^how does.*handle claims and disputes\??$/,
/^how does.*support small business owners\??$/,
/customize my.*insurance policy$/,
/availability options for.*insurance$/,
/fees associated with.*insurance$/
```

**Removed Queries**:
- "How do I customize my insurance policy"
- "What are the availability options for insurance policies"
- "What is the process for setting up an insurance policy"
- "What is the setup process for [Brand] insurance?"
- "How does [Brand] handle claims and disputes?"
- "How does [Brand] support small business owners?"
- "Can I customize my [Brand] insurance policy?"
- "What are the availability options for [Brand] insurance?"
- "What are the fees associated with [Brand] insurance?"

---

## Expected Results

### Amica.com (Auto/Home Insurance)

**Classification**:
```json
{
  "brand": "Amica",
  "industry": "insurance",
  "categoryTerms": [
    "auto insurance company",
    "insurance provider",
    "insurer"
  ],
  "entities": [
    "insurance",
    "amica",
    "amica insurance",
    "auto"
  ]
}
```

**Expected Queries** (After V4 LLM Generation or Padding):

**Branded** (10 queries):
1. "Amica insurance reviews"
2. "Amica vs State Farm"
3. "Amica vs Geico"
4. "Amica vs Progressive"
5. "Amica auto insurance rates"
6. "Amica home insurance coverage"
7. "Is Amica insurance good?"
8. "Amica customer reviews"
9. "Amica insurance pricing"
10. "Amica claims process"

**Non-Branded** (18 queries):
1. "Best auto insurance companies"
2. "Auto insurance reviews"
3. "Auto insurance comparison"
4. "Cheapest auto insurance"
5. "Best rated auto insurance"
6. "Auto insurance for good drivers"
7. "Top auto insurance providers"
8. "Auto insurance quotes"
9. "State Farm alternatives"
10. "Geico vs Progressive"
... etc.

---

## Detection Matrix

| Domain | Industry | Type | Category Terms | Competitors |
|--------|----------|------|----------------|-------------|
| **Amica** | insurance | auto, home | auto insurance company | State Farm, Geico, Progressive |
| **State Farm** | insurance | auto, home, life | auto insurance company | Amica, Geico, Allstate |
| **Geico** | insurance | auto | auto insurance company | State Farm, Progressive, Allstate |
| **Progressive** | insurance | auto, home | auto insurance company | Geico, State Farm, Allstate |
| **Nationwide** | insurance | auto, home, life | auto insurance company | State Farm, Allstate, Geico |

**Key Competitors**:
- Auto: State Farm, Geico, Progressive, Allstate, USAA
- Home: State Farm, Allstate, Liberty Mutual
- Life: Northwestern Mutual, MassMutual, New York Life

---

## Why This Matters

### 1. Citation Relevance
- **Before**: "customize my policy", "availability options" → generic, low-intent
- **After**: "Amica vs Geico", "best auto insurance companies" → high-intent, comparison-focused

### 2. Competitive Intelligence
- Captures comparison queries: "Amica vs State Farm", "Geico alternatives"
- Tracks review mentions: "Amica insurance reviews", "Amica customer reviews"

### 3. Customer Intent
- Focuses on shopping queries: "Best auto insurance companies", "Cheapest auto insurance"
- Captures product queries: "Amica auto insurance rates", "Amica home insurance coverage"

### 4. Brand Visibility
- Measures share-of-voice in insurance shopping searches
- Identifies where brand is mentioned vs State Farm, Geico, Progressive

---

## Implementation Details

### Insurance Industry Detection Flow

```
1. Extract homepage text (title, meta, h1, body sample)
   ↓
2. Run inferIndustryFromContext(text)
   → Checks for keywords: insurance, insurer, coverage, policy, premium, claim, auto insurance, home insurance
   → Matches "insurance" if found
   ↓
3. Extract entities from homepage text
   → Examples: "insurance", "amica insurance", "auto", "home"
   ↓
4. Build category terms
   → IF insurance AND entities contain auto/car/vehicle
   → THEN return "auto insurance company" terms
   → ELSE IF entities contain home/property
   → THEN return "home insurance company" terms
   → ELSE return generic "insurance company" terms
```

### Query Generation Flow

```
1. Get category terms: ["auto insurance company", "insurance provider"]
   ↓
2. Select contextual examples based on industry
   → IF insurance OR /insurance|insurer/ in category terms
   → THEN use insurance-specific examples
   ↓
3. Pass examples to V4 LLM with JSON schema
   → LLM generates natural queries following examples
   ↓
4. Filter generated queries
   → Remove setup/customization queries
   → Remove availability/business operations queries
   ↓
5. Pad with fallback queries if needed
   → "Best auto insurance companies", "Auto insurance reviews"
```

---

## Deployment

**Worker Version**: `62aa4e72-32dc-41e9-ba09-83aefb82a4dd`  
**Deployed**: 2025-10-18 18:15 UTC  
**Status**: ✅ Live in production

**Test Command**:
```bash
curl -s "https://api.optiview.ai/api/llm/prompts?domain=amica.com&refresh=true" | jq '{industry, categoryTerms, brandedSample, nonBrandedSample}'
```

---

## Coverage Matrix

| Industry | Detection Keywords | Category Terms | Example Brands |
|----------|-------------------|----------------|----------------|
| **Insurance** | insurance, policy, coverage, claim, premium | auto/home/life insurance company | Amica, State Farm, Geico |
| **Fintech** | trading, investment, stock, broker, crypto | trading platform, brokerage | Webull, Robinhood, E*TRADE |
| **Music Retail** | guitar, instrument, music, drum | music store, instrument retailer | Guitar Center, Sweetwater |
| **Sports Retail** | soccer, basketball, jersey, cleat | soccer store, sports retailer | Soccer.com, Dick's Sporting Goods |
| **Travel** | cruise, hotel, flight, vacation | cruise line, travel booking | Royal Caribbean, Carnival |

---

## Future Enhancements

1. **Health Insurance Detection**: Separate logic for UnitedHealthcare, Aetna, Blue Cross (plan comparison queries)
2. **Life Insurance Detection**: Northwestern Mutual, MassMutual (policy type queries)
3. **Business Insurance**: Hiscox, The Hartford (commercial insurance queries)
4. **Pet Insurance**: Trupanion, Nationwide (pet coverage queries)

---

## Summary

**Fixed**: Insurance companies now correctly classified and generate competitive/review queries  
**Impact**: Amica and similar insurers get high-value citation queries ("vs Geico", "best auto insurance")  
**Result**: Citations reflect real user intent when shopping for insurance  
**Coverage**: All major insurance types differentiated (auto, home, life, health)  

The citation system now understands **insurance business models** and generates **competitive, shopping-focused queries**! 🎯🚗🏠

