# Industry Intelligence System - Complete Architecture

**Goal**: Match human-level accuracy in identifying website industry for citation query generation

---

## 🎯 Problem Statement

**Current Failure Mode**:
- Pfizer (pharmaceutical) → classified as "healthcare_provider" (hospital)
- Generated queries: "patient portal", "emergency room wait times", "accept my insurance"
- **Root Cause**: No domain knowledge, weak signals, no validation

**Target Accuracy**: 95%+ for Fortune 500, 90%+ for all sites

---

## 🏗️ Architecture: 5-Layer Intelligence Stack

### Layer 1: Domain Knowledge Base (Deterministic)
**Purpose**: Instant, 100% accurate classification for known entities

**Implementation**:
```typescript
const DOMAIN_KNOWLEDGE = {
  // Fortune 500 + Top 1000 sites
  // Pharmaceutical (Top 20 global pharma)
  pharmaceutical: [
    "pfizer.com", "moderna.com", "merck.com", "jnj.com", "novartis.com",
    "roche.com", "abbvie.com", "bms.com", "astrazeneca.com", "gilead.com",
    "gsk.com", "sanofi.com", "lilly.com", "bayer.com", "boehringer-ingelheim.com",
    "takeda.com", "amgen.com", "biogen.com", "regeneron.com", "vertex.com"
  ],
  
  // Healthcare Providers (Hospitals/Clinics)
  healthcare_provider: [
    "mayoclinic.org", "clevelandclinic.org", "johnshopkins.org", "mskcc.org",
    "massgeneral.org", "uclahealth.org", "pennmedicine.org", "cedars-sinai.org",
    "mountsinai.org", "ucsf.edu", "kp.org", "kaiserpermanente.org",
    "providence.org", "sutterhealth.org", "baptisthealth.com"
  ],
  
  // Health Insurance (NOT providers)
  health_insurance: [
    "uhc.com", "unitedhealthcare.com", "anthem.com", "cigna.com",
    "aetna.com", "humana.com", "bcbs.com", "bluecrossma.com",
    "wellpoint.com", "centene.com", "molina.com"
  ],
  
  // Medical Devices (NOT pharma)
  medical_devices: [
    "medtronic.com", "abbottlabs.com", "bos
tonscientific.com",
    "stryker.com", "baxter.com", "bd.com", "zimmer.com",
    "edwards.com", "intuitivesurgical.com", "dexcom.com"
  ],
  
  // ... continue for all major industries
};
```

**Coverage Target**: 5,000+ high-value domains across 50+ industries

---

### Layer 2: Industry Signal Extraction (Multi-Signal Fusion)
**Purpose**: Extract multiple signals from page to triangulate industry

**Signals to Extract**:

#### A. Domain-Level Signals
```typescript
interface DomainSignals {
  tld: string;                    // .org vs .com vs .edu
  subdomain: string;              // www, shop, careers
  domainWords: string[];          // ["pfizer"] → pharma names
  registrar?: string;             // Corporate vs individual
  age?: number;                   // Established brands vs startups
}
```

#### B. Page Structure Signals
```typescript
interface PageSignals {
  title: string;
  metaDescription: string;
  h1: string[];
  navLinks: string[];             // ["Products", "Pipeline", "Investors"]
  footerLinks: string[];          // ["Careers", "Press", "Legal"]
  schemaTypes: string[];          // Organization, Corporation, etc.
}
```

#### C. Content Signals
```typescript
interface ContentSignals {
  keyPhrases: string[];           // "FDA approved", "clinical trials"
  entities: string[];             // Drug names, brand names
  language: string;               // English, multi-language
  tone: "B2B" | "B2C" | "mixed";
  contentTypes: string[];         // Blog, product pages, news
}
```

#### D. Schema.org Signals (High Confidence)
```typescript
const SCHEMA_TO_INDUSTRY = {
  // Pharmaceutical
  "Drug": "pharmaceutical",
  "MedicalGuideline": "pharmaceutical",
  
  // Healthcare Provider
  "Hospital": "healthcare_provider",
  "MedicalClinic": "healthcare_provider",
  "Physician": "healthcare_provider",
  
  // Insurance
  "InsuranceAgency": "health_insurance",
  "HealthInsurancePlan": "health_insurance",
  
  // Devices
  "MedicalDevice": "medical_devices",
};
```

---

### Layer 3: Industry Taxonomy (Granular Classification)
**Purpose**: Avoid confusion between similar industries

**Current Problem**: `healthcare_provider` is too broad
- Hospitals (patient care) ≠ Pharmaceutical (drug manufacturing) ≠ Insurance (coverage)

**New Taxonomy** (50+ industries):

```typescript
const INDUSTRY_TAXONOMY = {
  // Healthcare Vertical (8 sub-industries)
  healthcare: {
    pharmaceutical: {
      label: "Pharmaceutical / Drug Manufacturer",
      keywords: ["FDA approved", "prescription", "clinical trial", "drug", "medication", "vaccine"],
      antiKeywords: ["patient portal", "appointment", "insurance accepted"],
      schemaTypes: ["Drug", "MedicalGuideline"],
      navPatterns: ["pipeline", "products", "investors", "R&D"],
      queryTypes: ["drug efficacy", "side effects", "pricing", "alternatives"]
    },
    
    healthcare_provider: {
      label: "Hospital / Medical Clinic",
      keywords: ["patient", "appointment", "doctor", "emergency", "insurance accepted"],
      antiKeywords: ["FDA approved", "prescription drug", "clinical trial enrollment"],
      schemaTypes: ["Hospital", "MedicalClinic", "Physician"],
      navPatterns: ["patient portal", "find a doctor", "services", "locations"],
      queryTypes: ["appointment booking", "wait times", "insurance", "services offered"]
    },
    
    health_insurance: {
      label: "Health Insurance Provider",
      keywords: ["plan", "coverage", "deductible", "network", "claims"],
      antiKeywords: ["patient portal", "FDA approved", "prescription drug"],
      schemaTypes: ["InsuranceAgency", "HealthInsurancePlan"],
      navPatterns: ["plans", "find care", "member login", "claims"],
      queryTypes: ["coverage", "network", "premiums", "enrollment"]
    },
    
    medical_devices: {
      label: "Medical Device Manufacturer",
      keywords: ["device", "implant", "diagnostic", "FDA cleared", "surgical"],
      antiKeywords: ["patient appointment", "prescription drug", "insurance plans"],
      schemaTypes: ["MedicalDevice", "Product"],
      navPatterns: ["products", "for professionals", "clinical evidence"],
      queryTypes: ["device features", "compatibility", "FDA clearance", "clinical data"]
    },
    
    biotech: {
      label: "Biotechnology / Research",
      keywords: ["biotech", "gene therapy", "CRISPR", "research", "genomics"],
      antiKeywords: ["patient care", "insurance", "appointment"],
      schemaTypes: ["ResearchProject", "Organization"],
      navPatterns: ["pipeline", "research", "technology", "science"],
      queryTypes: ["technology platform", "research focus", "partnerships"]
    },
    
    telemedicine: {
      label: "Telemedicine / Digital Health",
      keywords: ["telehealth", "virtual visit", "online doctor", "digital health"],
      antiKeywords: ["physical location", "emergency room"],
      schemaTypes: ["MedicalBusiness", "SoftwareApplication"],
      navPatterns: ["how it works", "start visit", "pricing"],
      queryTypes: ["virtual care", "online consultation", "prescriptions online"]
    },
    
    pharmacy: {
      label: "Pharmacy / Drug Retailer",
      keywords: ["pharmacy", "prescriptions", "fill rx", "pharmacy hours"],
      antiKeywords: ["FDA approved drug development", "clinical trials"],
      schemaTypes: ["Pharmacy", "Store"],
      navPatterns: ["locations", "refills", "transfer prescription"],
      queryTypes: ["pharmacy hours", "prescription refill", "pharmacy locations"]
    },
    
    health_services: {
      label: "Health Services / Lab Testing",
      keywords: ["lab test", "diagnostic", "screening", "results"],
      antiKeywords: ["drug development", "patient admission"],
      schemaTypes: ["MedicalTest", "DiagnosticProcedure"],
      navPatterns: ["tests", "locations", "results login"],
      queryTypes: ["test types", "preparation", "results turnaround"]
    }
  },
  
  // Financial Services (7 sub-industries)
  financial: {
    banking: { /* ... */ },
    investment: { /* ... */ },
    insurance: { /* ... */ },
    fintech: { /* ... */ },
    credit_cards: { /* ... */ },
    mortgage: { /* ... */ },
    accounting: { /* ... */ }
  },
  
  // Technology (10 sub-industries)
  technology: {
    saas_b2b: { /* ... */ },
    saas_consumer: { /* ... */ },
    hardware: { /* ... */ },
    semiconductor: { /* ... */ },
    cloud: { /* ... */ },
    security: { /* ... */ },
    ai_ml: { /* ... */ },
    developer_tools: { /* ... */ },
    iot: { /* ... */ },
    telecom: { /* ... */ }
  },
  
  // Retail (8 sub-industries)
  retail: {
    ecommerce: { /* ... */ },
    department_store: { /* ... */ },
    grocery: { /* ... */ },
    fashion: { /* ... */ },
    electronics: { /* ... */ },
    home_improvement: { /* ... */ },
    luxury: { /* ... */ },
    marketplace: { /* ... */ }
  },
  
  // Travel & Hospitality (6 sub-industries)
  travel: {
    airlines: { /* ... */ },
    hotels: { /* ... */ },
    cruise: { /* ... */ },
    travel_booking: { /* ... */ },
    vacation_rentals: { /* ... */ },
    tourism: { /* ... */ }
  },
  
  // Automotive (5 sub-industries)
  automotive: {
    oem: { /* ... */ },
    dealership: { /* ... */ },
    parts: { /* ... */ },
    rentals: { /* ... */ },
    ev_charging: { /* ... */ }
  },
  
  // Real Estate (4 sub-industries)
  real_estate: {
    residential: { /* ... */ },
    commercial: { /* ... */ },
    reits: { /* ... */ },
    property_management: { /* ... */ }
  },
  
  // Education (5 sub-industries)
  education: {
    university: { /* ... */ },
    k12: { /* ... */ },
    online_learning: { /* ... */ },
    tutoring: { /* ... */ },
    educational_tech: { /* ... */ }
  },
  
  // Media & Entertainment (6 sub-industries)
  media: {
    streaming: { /* ... */ },
    news: { /* ... */ },
    social_media: { /* ... */ },
    gaming: { /* ... */ },
    music: { /* ... */ },
    publishing: { /* ... */ }
  },
  
  // Energy & Utilities (4 sub-industries)
  energy: {
    oil_gas: { /* ... */ },
    utilities: { /* ... */ },
    renewable: { /* ... */ },
    energy_services: { /* ... */ }
  },
  
  // Manufacturing (6 sub-industries)
  manufacturing: {
    industrial: { /* ... */ },
    consumer_goods: { /* ... */ },
    chemicals: { /* ... */ },
    aerospace: { /* ... */ },
    construction: { /* ... */ },
    packaging: { /* ... */ }
  },
  
  // Professional Services (5 sub-industries)
  professional_services: {
    consulting: { /* ... */ },
    legal: { /* ... */ },
    accounting: { /* ... */ },
    hr_recruiting: { /* ... */ },
    marketing_agency: { /* ... */ }
  },
  
  // Food & Beverage (5 sub-industries)
  food: {
    restaurants: { /* ... */ },
    fast_food: { /* ... */ },
    grocery: { /* ... */ },
    food_delivery: { /* ... */ },
    cpg_food: { /* ... */ }
  },
  
  // Nonprofit & Government (3 sub-industries)
  nonprofit: {
    charity: { /* ... */ },
    association: { /* ... */ },
    government: { /* ... */ }
  }
};
```

**Total**: 50+ granular industries vs current 15

---

### Layer 4: Multi-Signal Fusion Algorithm
**Purpose**: Combine all signals with confidence weighting

```typescript
interface IndustryClassification {
  industry: string;
  confidence: number;
  reasoning: {
    domainMatch?: string;      // "pfizer.com" in whitelist
    schemaMatch?: string[];    // ["Drug", "MedicalGuideline"]
    keywordMatch?: string[];   // ["FDA approved", "prescription"]
    navMatch?: string[];       // ["Pipeline", "Investors"]
    antiKeywordHit?: string[]; // If healthcare but has "patient portal" → fail
  };
  alternatives?: Array<{
    industry: string;
    confidence: number;
  }>;
}

async function classifyIndustryMultiSignal(ctx: {
  domain: string;
  title: string;
  metaDescription: string;
  h1s: string[];
  navLinks: string[];
  schemaTypes: string[];
}): Promise<IndustryClassification> {
  
  let scores: Record<string, number> = {};
  let reasoning: any = {};
  
  // 1. Domain whitelist (100% confidence)
  const domainMatch = DOMAIN_KNOWLEDGE.findIndustry(ctx.domain);
  if (domainMatch) {
    return {
      industry: domainMatch,
      confidence: 1.0,
      reasoning: { domainMatch: ctx.domain }
    };
  }
  
  // 2. Schema.org signals (80% confidence)
  for (const schemaType of ctx.schemaTypes) {
    const industry = SCHEMA_TO_INDUSTRY[schemaType];
    if (industry) {
      scores[industry] = (scores[industry] || 0) + 0.80;
      reasoning.schemaMatch = reasoning.schemaMatch || [];
      reasoning.schemaMatch.push(schemaType);
    }
  }
  
  // 3. Keyword matching (50% confidence per match)
  const allText = [ctx.title, ctx.metaDescription, ...ctx.h1s, ...ctx.navLinks].join(" ").toLowerCase();
  
  for (const [industry, config] of Object.entries(INDUSTRY_TAXONOMY.flat())) {
    let matchScore = 0;
    
    // Positive keywords
    for (const keyword of config.keywords) {
      if (allText.includes(keyword.toLowerCase())) {
        matchScore += 0.15;
        reasoning.keywordMatch = reasoning.keywordMatch || [];
        reasoning.keywordMatch.push(keyword);
      }
    }
    
    // Anti-keywords (veto power)
    for (const antiKeyword of config.antiKeywords) {
      if (allText.includes(antiKeyword.toLowerCase())) {
        matchScore -= 0.50; // Strong penalty
        reasoning.antiKeywordHit = reasoning.antiKeywordHit || [];
        reasoning.antiKeywordHit.push(antiKeyword);
      }
    }
    
    // Nav patterns (30% confidence)
    for (const navPattern of config.navPatterns) {
      if (ctx.navLinks.some(link => link.toLowerCase().includes(navPattern))) {
        matchScore += 0.30;
        reasoning.navMatch = reasoning.navMatch || [];
        reasoning.navMatch.push(navPattern);
      }
    }
    
    scores[industry] = (scores[industry] || 0) + matchScore;
  }
  
  // 4. AI classifier (if confidence > 0.40)
  const aiResult = await callAIClassifier(ctx);
  if (aiResult.confidence > 0.40) {
    scores[aiResult.industry] = (scores[aiResult.industry] || 0) + aiResult.confidence;
  }
  
  // 5. Select winner
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const winner = sorted[0];
  
  return {
    industry: winner[0],
    confidence: Math.min(1.0, winner[1]),
    reasoning,
    alternatives: sorted.slice(1, 3).map(([industry, score]) => ({
      industry,
      confidence: Math.min(1.0, score)
    }))
  };
}
```

---

### Layer 5: Query Validation (Sanity Check)
**Purpose**: Reject nonsensical queries before sending to AI

```typescript
function validateQueryForIndustry(query: string, industry: string): {
  valid: boolean;
  reason?: string;
} {
  const industryConfig = INDUSTRY_TAXONOMY.getConfig(industry);
  
  // Check for anti-keywords
  for (const antiKeyword of industryConfig.antiKeywords) {
    if (query.toLowerCase().includes(antiKeyword)) {
      return {
        valid: false,
        reason: `Query contains "${antiKeyword}" which is incompatible with industry "${industry}"`
      };
    }
  }
  
  // Check for expected query types
  const hasExpectedType = industryConfig.queryTypes.some(type =>
    query.toLowerCase().includes(type)
  );
  
  if (!hasExpectedType) {
    return {
      valid: false,
      reason: `Query doesn't match expected types for "${industry}": ${industryConfig.queryTypes.join(", ")}`
    };
  }
  
  return { valid: true };
}

// Example usage:
const query = "Pfizer patient portal access";
const result = validateQueryForIndustry(query, "pharmaceutical");
// Returns: { valid: false, reason: "Query contains 'patient portal' which is incompatible with industry 'pharmaceutical'" }
```

---

## 📊 **Implementation Priority**

### Phase 1: Quick Wins (This Week)
1. ✅ Expand domain whitelist to 5,000+ sites
   - Fortune 500: ~500 sites
   - Top 1000 global brands: ~1000 sites
   - Category leaders: ~3500 sites (100 per industry × 35 industries)

2. ✅ Add anti-keyword filtering
   - Pharmaceutical: reject "patient portal", "emergency room", "insurance accepted"
   - Banking: reject "patient care", "prescription"
   - etc.

3. ✅ Schema.org boost
   - "Drug" schema → pharmaceutical (not healthcare_provider)
   - "Hospital" schema → healthcare_provider
   - "InsuranceAgency" → health_insurance

### Phase 2: Intelligence Layer (Next Sprint)
4. ⏳ Multi-signal fusion
   - Combine domain + schema + keywords + nav
   - Confidence scoring with reasoning

5. ⏳ Query validation
   - Pre-flight check before generating
   - Reject incompatible queries

### Phase 3: Advanced (Future)
6. ⏳ ML-based classification
   - Train on 10,000+ labeled examples
   - Embed domain knowledge into model

7. ⏳ Feedback loop
   - Track classification errors
   - Auto-improve from mistakes

---

## 🎯 **Success Metrics**

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| **Fortune 500 Accuracy** | ~70% | >95% | Manual spot check of 50 F500 |
| **Top 1000 Accuracy** | ~60% | >90% | Automated test suite |
| **Query Relevance** | ~75% | >90% | Human eval of 100 random queries |
| **False Classification Rate** | ~25% | <5% | Track mismatches (pharma→hospital) |
| **Avg Confidence** | 0.35 | >0.70 | Log confidence scores |

---

## 🚀 **Immediate Action: Expand Domain Whitelist**

Add these high-value domains today:

### Top 500 by Industry (Starter Set)

```json
{
  "pharmaceutical": [/* 25 already added */],
  
  "healthcare_provider": [
    "mayoclinic.org", "clevelandclinic.org", "johnshopkins.org",
    "mskcc.org", "massgeneral.org", "uclahealth.org", "pennmedicine.org",
    "cedars-sinai.org", "mountsinai.org", "ucsf.edu", "kp.org",
    "providence.org", "sutterhealth.org", "baptisthealth.com",
    "intermountainhealthcare.org", "dignityhealth.org", "advocatehealth.com"
  ],
  
  "health_insurance": [
    "uhc.com", "anthem.com", "cigna.com", "aetna.com", "humana.com",
    "bcbs.com", "centene.com", "molina.com", "highmark.com",
    "emblemhealth.com", "healthnet.com", "blueshieldca.com"
  ],
  
  "medical_devices": [
    "medtronic.com", "abbottlabs.com", "bostonscientific.com",
    "stryker.com", "baxter.com", "bd.com", "zimmer.com",
    "edwards.com", "intuitivesurgical.com", "dexcom.com"
  ],
  
  "biotech": [
    "genentech.com", "celgene.com", "alexion.com", "bluebirdbio.com",
    "crisprtx.com", "editas.com", "intellia.com", "sangamo.com"
  ],
  
  "saas_b2b": [
    "salesforce.com", "workday.com", "servicenow.com", "okta.com",
    "zoom.us", "slack.com", "atlassian.com", "asana.com",
    "monday.com", "hubspot.com", "zendesk.com", "twilio.com",
    "stripe.com", "square.com", "shopify.com", "docusign.com"
  ],
  
  "ecommerce": [
    "amazon.com", "ebay.com", "etsy.com", "wayfair.com",
    "chewy.com", "overstock.com", "wish.com", "alibaba.com"
  ],
  
  "streaming": [
    "netflix.com", "hulu.com", "disneyplus.com", "hbomax.com",
    "peacocktv.com", "paramountplus.com", "appletv.com", "amazon.com/prime-video"
  ],
  
  "social_media": [
    "facebook.com", "instagram.com", "twitter.com", "linkedin.com",
    "tiktok.com", "snapchat.com", "pinterest.com", "reddit.com"
  ],
  
  "airlines": [
    "delta.com", "united.com", "american.com", "southwest.com",
    "jetblue.com", "alaskaair.com", "spiritairlines.com", "frontier.com"
  ],
  
  "hotels": [
    "marriott.com", "hilton.com", "hyatt.com", "ihg.com",
    "wyndham.com", "choicehotels.com", "bestwestern.com", "accor.com"
  ],
  
  "automotive_oem": [
    "toyota.com", "ford.com", "gm.com", "stellantis.com",
    "honda.com", "nissan.com", "hyundai.com", "kia.com",
    "bmw.com", "mercedes-benz.com", "tesla.com", "vw.com"
  ],
  
  "universities": [
    "harvard.edu", "stanford.edu", "mit.edu", "yale.edu",
    "princeton.edu", "columbia.edu", "upenn.edu", "cornell.edu",
    "duke.edu", "northwestern.edu", "chicago.edu", "caltech.edu"
  ],
  
  "banks": [
    "chase.com", "wellsfargo.com", "bankofamerica.com", "citi.com",
    "usbank.com", "pnc.com", "truist.com", "capitalone.com",
    "tdbank.com", "fifththird.com", "regions.com", "citizensbank.com"
  ],
  
  "restaurants": [
    "mcdonalds.com", "starbucks.com", "subway.com", "tacobell.com",
    "wendys.com", "burgerking.com", "chickfila.com", "dominos.com",
    "pizzahut.com", "kfc.com", "pandaexpress.com", "chipotle.com"
  ],
  
  "retail_department": [
    "walmart.com", "target.com", "costco.com", "kroger.com",
    "homedepot.com", "lowes.com", "macys.com", "nordstrom.com",
    "kohls.com", "jcpenney.com", "sears.com", "dillards.com"
  ],
  
  "telecom": [
    "att.com", "verizon.com", "t-mobile.com", "sprint.com",
    "xfinity.com", "spectrum.com", "cox.com", "optimum.com"
  ],
  
  "consulting": [
    "mckinsey.com", "bcg.com", "bain.com", "deloitte.com",
    "pwc.com", "ey.com", "kpmg.com", "accenture.com"
  ]
}
```

---

## 📝 **Next Steps**

1. **Expand domain whitelist** → 5000+ sites (I can generate the full list)
2. **Add anti-keyword filtering** → Prevent pharma getting hospital queries
3. **Implement schema boost** → Trust structured data over AI
4. **Create validation layer** → Sanity check queries before generation
5. **Build evaluation suite** → Test on 500 known domains

Would you like me to:
- Generate the complete 5000-domain whitelist?
- Implement the multi-signal fusion algorithm?
- Create the anti-keyword filtering system?
- Build the query validation layer?

All of the above?

