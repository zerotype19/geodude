/**
 * Universal Classification v1.0 - Keyword Clusters & Weights
 * Phase 1: English baseline tokens
 */

export type Cluster = {
  id: string;
  tokens: RegExp[];
  weightPerHit: number;      // add per token match
  clusterBonus: number;      // add once if any token matches
};

export type IndustryBoost = {
  id: string;
  tokens: RegExp[];
  weightPerHit: number;
  clusterBonus: number;
};

export type SchemaBoost = {
  types: string[];           // JSON-LD @type
  siteTypeHint?: string;     // "ecommerce" | "media" | ...
  industryHint?: string;     // "retail" | "finance" | ...
  weight: number;
};

// --- Site-type signal clusters (English v1)
export const SITE_TYPE_CLUSTERS: Cluster[] = [
  // Commerce (ecommerce / brand_store)
  {
    id: "commerce",
    tokens: [
      /\badd[-\s]?to[-\s]?cart\b/i, /\bcheckout\b/i, /\bcart\b/i, /\bprice\b/i,
      /\bsku\b/i, /\bproduct(?:s)?\b/i, /\bpdp\b/i, /\bplp\b/i,
      /\bfree shipping\b/i, /\breturns?\b/i
    ],
    weightPerHit: 2,
    clusterBonus: 2
  },
  // Media / publishing
  {
    id: "media",
    tokens: [/\bnews\b/i, /\bpress\b/i, /\bblog\b/i, /\barticle\b/i, /\bmagazine\b/i, /\bpublisher\b/i, /\bbyline\b/i],
    weightPerHit: 1,
    clusterBonus: 2
  },
  // Software / docs
  {
    id: "software",
    tokens: [/\bapi\b/i, /\bsdk\b/i, /\bdocs?\b/i, /\bdevelopers?\b/i, /\bswagger\b/i, /\bopenapi\b/i, /\bdashboard\b/i, /\bpricing\b/i],
    weightPerHit: 1.5,
    clusterBonus: 2
  },
  // Support / FAQ
  {
    id: "support",
    tokens: [/\bfaq\b/i, /\bhelp\b/i, /\bsupport\b/i, /\bknowledge base\b/i],
    weightPerHit: 1,
    clusterBonus: 1
  },
  // IR / Corporate finance pages
  {
    id: "ir",
    tokens: [/\binvestors?\b/i, /\bIR\b/, /\b10[-\s]?k\b/i, /\b10[-\s]?q\b/i, /\bearnings\b/i, /\bticker\b/i],
    weightPerHit: 1.5,
    clusterBonus: 2
  }
];

// --- Industry boosts (English v1)
export const INDUSTRY_BOOSTS: IndustryBoost[] = [
  // Finance / banking
  {
    id: "finance",
    tokens: [/\bcredit card\b/i, /\bapy\b/i, /\bapr\b/i, /\bchecking\b/i, /\bsavings?\b/i, /\bmortgage\b/i, /\brates?\b/i, /\bapply now\b/i, /\bbrokerage\b/i, /\btrading\b/i],
    weightPerHit: 2,
    clusterBonus: 2
  },
  // Insurance
  {
    id: "insurance",
    tokens: [/\binsurance\b/i, /\bpolicy\b/i, /\bpremium\b/i, /\bquote\b/i, /\bclaim\b/i, /\bund(er)?writing\b/i, /\bliability\b/i, /\bcoverage\b/i],
    weightPerHit: 2,
    clusterBonus: 2
  },
  // Travel
  {
    id: "travel",
    tokens: [/\bflight\b/i, /\bhotel\b/i, /\bbook\b/i, /\bitinerary\b/i, /\bcheck[-\s]?in\b/i, /\breservation\b/i, /\bresort\b/i, /\bcruise\b/i],
    weightPerHit: 1.5,
    clusterBonus: 2
  },
  // Automotive
  {
    id: "automotive",
    tokens: [/\bbuild\b/i, /\bconfigure\b/i, /\bmodels?\b/i, /\bmsrp\b/i, /\bdealers?\b/i, /\bcertified\b/i, /\binventory\b/i, /\bvin\b/i, /\btest drive\b/i],
    weightPerHit: 2,
    clusterBonus: 2
  },
  // Retail vertical (sportswear)
  {
    id: "retail_sportswear",
    tokens: [/\bmen\b/i, /\bwomen\b/i, /\bkids\b/i, /\bcleats?\b/i, /\bjerseys?\b/i, /\bfootwear\b/i, /\bapparel\b/i],
    weightPerHit: 1.25,
    clusterBonus: 1.5
  },
  // Retail vertical (music/instruments)
  {
    id: "retail_music",
    tokens: [/\bguitars?\b/i, /\bbasses?\b/i, /\bamps?\b/i, /\bpedals?\b/i, /\bstrings?\b/i, /\bcustom shop\b/i],
    weightPerHit: 1.5,
    clusterBonus: 2
  }
];

// --- JSON-LD based hints
export const SCHEMA_BOOSTS: SchemaBoost[] = [
  { types: ["Product","Offer","AggregateOffer","BreadcrumbList"], siteTypeHint: "ecommerce", weight: 2 },
  { types: ["NewsArticle","Article","BlogPosting"], siteTypeHint: "media", weight: 2 },
  { types: ["FAQPage","HowTo"], siteTypeHint: "support", weight: 1.5 },
  { types: ["SoftwareApplication"], siteTypeHint: "software", industryHint: "software", weight: 2 },
  { types: ["FinancialService","BankOrCreditUnion"], industryHint: "finance", weight: 3 },
  { types: ["InsuranceAgency","Insurance"], industryHint: "insurance", weight: 3 },
  { types: ["AutoDealer","Vehicle"], industryHint: "automotive", weight: 3 },
  { types: ["TouristTrip","LodgingBusiness","TravelAgency"], industryHint: "travel", weight: 2 }
];

// Map site-type cluster → canonical label
export const CLUSTER_TO_SITE_TYPE: Record<string,string> = {
  commerce: "ecommerce",
  media: "media",
  software: "software",
  support: "corporate", // site_mode will pick 'support_site'
  ir: "corporate"
};

// Map industry cluster → canonical label
export const CLUSTER_TO_INDUSTRY: Record<string,string> = {
  finance: "finance",
  insurance: "insurance",
  travel: "travel",
  automotive: "automotive",
  retail_sportswear: "retail",
  retail_music: "retail"
};

