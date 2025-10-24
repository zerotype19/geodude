# Industry Taxonomy V2: Hierarchical Implementation Plan

## 🎯 Goal
Replace flat industry classification (`saas_b2b`, `pharmaceutical`) with **hierarchical dot-slugs** (`software.saas`, `health.pharma.brand`) to enable:
1. **Surgical prompt routing** (pharma-specific vs. general health queries)
2. **Cascading template fallbacks** (health.pharma.brand → health.pharma → health → default)
3. **Scalable sub-industry expansion** (add `health.pharma.generic` without restructuring)

---

## 📊 Current State (Flat)

**Problem**: 1 flat label = 1 set of prompts

```
pharmaceutical → [12 pharmaceutical queries]
healthcare_provider → [12 hospital/clinic queries]
```

**If Pfizer gets classified as `healthcare_provider`:**
- ❌ Gets "emergency room hours?" (wrong)
- ❌ Gets "find a doctor near me" (wrong)
- ❌ Misses "drug side effects" (missing)

---

## 🎯 New State (Hierarchical)

**Solution**: Hierarchical slugs + cascading templates

```
health.pharma.brand
  → health.pharma.* template (if exists)
  → health.* template (if pharma-specific missing)
  → default template (fallback)
```

**Example Cascade for Pfizer:**

1. Check `health.pharma.brand` templates → **FOUND**: "side effects", "efficacy", "patient assistance"
2. Check `health.pharma` templates → **FOUND**: "clinical trials", "pipeline", "FDA approval"
3. Check `health` templates → **SKIP** (already have pharma-specific)
4. Use templates from steps 1+2

**Example Cascade for Mayo Clinic:**

1. Check `health.providers` templates → **FOUND**: "find a doctor", "appointments", "patient portal"
2. Check `health` templates → **FOUND**: "insurance accepted", "services", "locations"
3. Use templates from steps 1+2

---

## 🏗️ Implementation Architecture

### 1. **Taxonomy Storage** (`industry-taxonomy-v2.ts`)

```typescript
export const INDUSTRY_TAXONOMY_V2: Record<string, IndustryNode> = {
  'health.pharma.brand': {
    slug: 'health.pharma.brand',
    name: 'Pharma (Brand Sites)',
    parent: 'health',
    keywords: ['prescription', 'drug', 'fda approved', 'clinical trial'],
    antiKeywords: ['hospital', 'clinic', 'appointment', 'emergency room'],
    schemaTypes: ['Drug', 'MedicalTherapy'],
    navPatterns: ['/products', '/pipeline', '/patient-resources'],
    queryTypes: ['drug information', 'side effects', 'dosage', 'patient assistance']
  },
  'health.providers': {
    slug: 'health.providers',
    name: 'Health Systems & Providers',
    parent: 'health',
    keywords: ['hospital', 'clinic', 'medical center'],
    antiKeywords: ['prescription', 'drug', 'medication', 'pharmaceutical'],
    schemaTypes: ['Hospital', 'MedicalClinic'],
    navPatterns: ['/find-a-doctor', '/services', '/patient-portal'],
    queryTypes: ['find a doctor', 'services', 'insurance accepted', 'appointment']
  }
};
```

### 2. **Prompt Templates** (Cascading by Industry)

**File**: `src/prompts/templates-v2.ts`

```typescript
export const PROMPT_TEMPLATES_V2 = {
  // Top-level health template (fallback)
  'health': {
    branded: [
      'Does {brand} accept my insurance?',
      'What services does {brand} offer?',
      'How do I contact {brand}?'
    ],
    nonBranded: [
      'Best healthcare options for {condition}',
      'How to choose a healthcare provider'
    ]
  },
  
  // Pharma-specific template (highest priority)
  'health.pharma.brand': {
    branded: [
      'What are the side effects of {brand} {product}?',
      'Is {brand} {product} right for me?',
      '{brand} {product} vs {competitor}',
      'How effective is {brand} {product}?',
      'Does {brand} offer patient assistance programs?',
      '{brand} {product} dosage and administration',
      'What conditions does {brand} {product} treat?',
      '{brand} {product} FDA approval status',
      'How do I get a prescription for {brand} {product}?'
    ],
    nonBranded: [
      'What are the best treatments for {condition}?',
      'Comparing prescription medications for {condition}',
      'Side effects of {drug class} medications',
      'Patient assistance programs for expensive medications'
    ]
  },
  
  // Hospital/clinic template (highest priority)
  'health.providers': {
    branded: [
      'How do I find a doctor at {brand}?',
      'Does {brand} accept {insurance}?',
      '{brand} emergency room wait times',
      'How to schedule an appointment at {brand}',
      '{brand} patient portal login',
      'What specialties does {brand} offer?',
      '{brand} vs {competitor} for {procedure}',
      '{brand} hospital reviews and ratings'
    ],
    nonBranded: [
      'Best hospitals for {procedure}',
      'How to find a specialist for {condition}',
      'What to expect at urgent care',
      'Hospital patient rights and billing'
    ]
  }
};
```

### 3. **Template Resolution** (Cascading Logic)

**File**: `src/prompts/templateResolver.ts`

```typescript
import { getAncestorSlugs } from '../config/industry-taxonomy-v2';
import { PROMPT_TEMPLATES_V2 } from './templates-v2';

export function resolveTemplates(industrySlug: string, type: 'branded' | 'nonBranded'): string[] {
  const ancestors = getAncestorSlugs(industrySlug); // e.g., ["health.pharma.brand", "health.pharma", "health"]
  const templates: string[] = [];
  
  for (const ancestor of ancestors) {
    const template = PROMPT_TEMPLATES_V2[ancestor];
    if (template && template[type]) {
      templates.push(...template[type]);
    }
  }
  
  // Fallback to generic if no matches
  if (templates.length === 0 && PROMPT_TEMPLATES_V2['generic_consumer']) {
    templates.push(...PROMPT_TEMPLATES_V2['generic_consumer'][type]);
  }
  
  // De-duplicate
  return [...new Set(templates)];
}

// Example usage:
// resolveTemplates('health.pharma.brand', 'branded')
// → Returns: [
//     "What are the side effects of {brand} {product}?",
//     "Is {brand} {product} right for me?",
//     ... (9 pharma-specific templates),
//     "Does {brand} accept my insurance?", (from health.*)
//     "What services does {brand} offer?" (from health.*)
//   ]
```

### 4. **Domain Mapping** (Migration Script)

**File**: `scripts/migrate-domains-to-v2.ts`

```typescript
import { INDUSTRY_TAXONOMY_V2, mapLegacyToV2 } from '../src/config/industry-taxonomy-v2';
import industryPacks from '../src/config/industry-packs.default.json';

// Read current flat domains
const currentDomains = industryPacks.industry_rules.domains;

// Map to new slugs
const migratedDomains: Record<string, string> = {};

for (const [domain, legacyIndustry] of Object.entries(currentDomains)) {
  // Automatic mapping via legacy map
  const newSlug = mapLegacyToV2(legacyIndustry);
  
  // Manual overrides for surgical classification
  if (domain === 'pfizer.com' || domain === 'moderna.com') {
    migratedDomains[domain] = 'health.pharma.brand';
  } else if (domain === 'mayoclinic.org' || domain === 'clevelandclinic.org') {
    migratedDomains[domain] = 'health.providers';
  } else if (domain === 'cvs.com' || domain === 'walgreens.com') {
    migratedDomains[domain] = 'health.pharmacy'; // More specific than retail.pharmacy
  } else if (domain === 'salesforce.com' || domain === 'hubspot.com') {
    migratedDomains[domain] = 'software.cdp_crm';
  } else if (domain === 'github.com' || domain === 'gitlab.com') {
    migratedDomains[domain] = 'software.devtools';
  } else if (domain === 'tableau.com' || domain === 'looker.com') {
    migratedDomains[domain] = 'software.analytics_bi';
  } else if (domain === 'harvard.edu' || domain === 'stanford.edu') {
    migratedDomains[domain] = 'education.higher.private';
  } else if (domain === 'umich.edu' || domain === 'berkeley.edu') {
    migratedDomains[domain] = 'education.higher.public';
  } else if (domain === 'mcdonalds.com' || domain === 'subway.com') {
    migratedDomains[domain] = 'food_restaurant.qsr';
  } else if (domain === 'chipotle.com' || domain === 'panera.com') {
    migratedDomains[domain] = 'food_restaurant.fast_casual';
  } else if (domain === 'cheesecake factory.com' || domain === 'olive garden.com') {
    migratedDomains[domain] = 'food_restaurant.casual';
  } else if (domain === 'amazon.com') {
    migratedDomains[domain] = 'retail.marketplace.horizontal';
  } else if (domain === 'walmart.com' || domain === 'target.com') {
    migratedDomains[domain] = 'retail.mass_merch';
  } else if (domain === 'wholefoodsmarket.com' || domain === 'kroger.com') {
    migratedDomains[domain] = 'retail.grocery';
  } else if (domain === 'costco.com' || domain === 'samsclub.com') {
    migratedDomains[domain] = 'retail.wholesale_club';
  } else {
    // Use automatic mapping
    migratedDomains[domain] = newSlug;
  }
}

console.log(`Migrated ${Object.keys(migratedDomains).length} domains to V2 slugs`);
// Export to JSON
```

### 5. **Prompt Generation Integration**

**File**: `src/prompts/generator_v4.ts` (modified)

```typescript
import { resolveTemplates } from './templateResolver';
import { INDUSTRY_TAXONOMY_V2 } from '../config/industry-taxonomy-v2';

export async function generatePromptsV2(ctx: {
  domain: string;
  industrySlug: string; // NEW: hierarchical slug instead of flat
  brand: string;
  products?: string[];
  targetCount: number;
}) {
  // Resolve templates via cascading
  const brandedTemplates = resolveTemplates(ctx.industrySlug, 'branded');
  const nonBrandedTemplates = resolveTemplates(ctx.industrySlug, 'nonBranded');
  
  // Generate prompts (existing LLM logic)
  const prompts = await generateWithLLM({
    templates: {
      branded: brandedTemplates,
      nonBranded: nonBrandedTemplates
    },
    brand: ctx.brand,
    products: ctx.products,
    count: ctx.targetCount
  });
  
  // Filter by industry appropriateness (uses taxonomy keywords)
  const taxonomy = INDUSTRY_TAXONOMY_V2[ctx.industrySlug];
  const filtered = prompts.filter(q => isAppropriateForIndustry(q, taxonomy));
  
  return filtered;
}

function isAppropriateForIndustry(query: string, taxonomy: IndustryNode): boolean {
  const lower = query.toLowerCase();
  
  // Check anti-keywords (reject if present)
  if (taxonomy.antiKeywords) {
    for (const antiKeyword of taxonomy.antiKeywords) {
      if (lower.includes(antiKeyword.toLowerCase())) {
        return false; // Query contains forbidden term
      }
    }
  }
  
  // Check keywords (accept if at least one present)
  if (taxonomy.keywords && taxonomy.keywords.length > 0) {
    const hasKeyword = taxonomy.keywords.some(kw => 
      lower.includes(kw.toLowerCase())
    );
    if (!hasKeyword) {
      return false; // Query doesn't match industry
    }
  }
  
  return true;
}
```

---

## 📋 Migration Checklist

### Phase 1: Add V2 Taxonomy (Non-Breaking)
- [x] Create `industry-taxonomy-v2.ts` with hierarchical slugs
- [ ] Add `mapLegacyToV2()` function for backward compatibility
- [ ] Add `resolveTemplates()` cascading logic
- [ ] Create `templates-v2.ts` with hierarchical templates

### Phase 2: Migrate Domains (Surgical Mapping)
- [ ] Run migration script to map 1,244 domains to V2 slugs
- [ ] Manual review of top 100 domains for accuracy
- [ ] Export new `industry-packs-v2.json`

### Phase 3: Update Prompt Generation
- [ ] Modify `generator_v4.ts` to use `resolveTemplates()`
- [ ] Add `isAppropriateForIndustry()` filter using anti-keywords
- [ ] Test with 10 sample audits (Pfizer, Mayo, Adobe, etc.)

### Phase 4: Deploy & Validate
- [ ] Deploy with feature flag `TAXONOMY_V2_ENABLED=0` (off by default)
- [ ] Run A/B test: 10% traffic gets V2, 90% gets V1
- [ ] Compare prompt quality metrics (human score, diversity, relevance)
- [ ] Flip to `TAXONOMY_V2_ENABLED=1` if metrics improve

---

## 🎯 Expected Improvements

### Prompt Quality

**Before (Flat):**
- Pfizer classified as `pharmaceutical` → 12 generic pharma queries
- Mayo Clinic classified as `healthcare_provider` → 12 generic hospital queries
- **Overlap**: Both get similar "insurance accepted?" queries

**After (Hierarchical):**
- Pfizer classified as `health.pharma.brand` → **9 pharma-specific + 3 health-generic = 12 unique**
- Mayo Clinic classified as `health.providers` → **8 provider-specific + 4 health-generic = 12 unique**
- **No overlap**: Each gets industry-appropriate queries

### Scalability

**Before**: Adding "urgent care" = new flat industry = duplicate all health templates

**After**: Adding "urgent care" = `health.providers.urgent_care` = inherits `health.providers.*` + `health.*` + add 3 urgent-care-specific overrides

---

## 🚀 Quick Start (for Implementation)

```bash
# 1. Create taxonomy file (already done)
# packages/audit-worker/src/config/industry-taxonomy-v2.ts

# 2. Create template file
# packages/audit-worker/src/prompts/templates-v2.ts

# 3. Create resolver
# packages/audit-worker/src/prompts/templateResolver.ts

# 4. Run migration script
cd packages/audit-worker
npx tsx scripts/migrate-domains-to-v2.ts

# 5. Test with sample audit
npx tsx test/validate-taxonomy-v2.ts --domain=pfizer.com

# 6. Deploy with feature flag
TAXONOMY_V2_ENABLED=0 npx wrangler deploy
```

---

## 💡 Key Benefits

1. **Surgical Precision**: `health.pharma.brand` gets pharma-specific queries, not generic health
2. **DRY Principle**: Shared templates cascade from parent slugs (no duplication)
3. **Easy Expansion**: Add `health.pharma.generic` without touching `health.pharma.brand`
4. **Anti-Keywords**: Prevent "emergency room hours?" for pharma sites
5. **Template Override**: Sub-industries can override parent templates selectively

---

## 📊 Migration Stats (Projected)

| Category | Before (Flat) | After (V2) | Change |
|----------|---------------|------------|--------|
| **Industry Labels** | 25 | 200+ | +700% granularity |
| **Template Files** | 1 flat file | 1 hierarchical file | Organized by vertical |
| **Domains Migrated** | 1,244 | 1,244 | 100% coverage |
| **Prompt Accuracy** | ~70% | ~95% | +25% improvement (est.) |
| **Maintainability** | Hard (duplicate templates) | Easy (cascade + override) | Scalable |

---

## ❓ FAQ

**Q: Do I have to migrate all 1,244 domains at once?**
A: No. You can migrate incrementally by slug. Start with `health.*`, then `software.*`, etc.

**Q: What if a domain doesn't fit any V2 slug?**
A: Falls back to `generic_consumer` or `generic_b2b` (same as before).

**Q: Can I use both V1 (flat) and V2 (hierarchical) during migration?**
A: Yes. Use `mapLegacyToV2()` to translate old slugs on-the-fly.

**Q: How do I test prompt quality?**
A: Use the existing `test/validate-industry-whitelist.ts` + new `test/validate-taxonomy-v2.ts` to compare V1 vs V2 output.

---

## 🎯 Next Steps

Let me know if you want me to:
1. ✅ **Build out the full implementation** (templates-v2.ts, templateResolver.ts, migration script)
2. ✅ **Create a CSV/JSON export** of the 200+ taxonomy for D1 import
3. ✅ **Run the migration** for your 1,244 domains with surgical mapping
4. ✅ **Deploy with feature flag** and A/B test

Or would you like to review the approach first and suggest modifications?

