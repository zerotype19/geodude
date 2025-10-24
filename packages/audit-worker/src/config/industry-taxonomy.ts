/**
 * Industry Taxonomy with granular classifications
 * Anti-keywords prevent misclassification (e.g., pharma → hospital)
 * Query types define expected query patterns for validation
 */

export interface IndustryTaxonomy {
  label: string;
  keywords: string[];
  antiKeywords: string[];
  schemaTypes: string[];
  navPatterns: string[];
  queryTypes: string[];
}

export const INDUSTRY_TAXONOMY: Record<string, IndustryTaxonomy> = {
  // === HEALTHCARE VERTICAL (8 sub-industries) ===
  pharmaceutical: {
    label: "Pharmaceutical / Drug Manufacturer",
    keywords: [
      "fda approved",
      "prescription",
      "clinical trial",
      "drug",
      "medication",
      "vaccine",
      "pharmaceutical",
      "prescription drug",
      "side effects",
      "drug information",
      "dosage",
      "contraindications"
    ],
    antiKeywords: [
      "patient portal",
      "appointment",
      "schedule visit",
      "emergency room",
      "wait time",
      "insurance accepted",
      "find a doctor",
      "hospital",
      "clinic"
    ],
    schemaTypes: ["Drug", "MedicalGuideline"],
    navPatterns: ["pipeline", "products", "investors", "r&d", "research"],
    queryTypes: [
      "drug efficacy",
      "side effects",
      "pricing",
      "alternatives",
      "generic",
      "prescription",
      "fda approval",
      "clinical trial"
    ]
  },

  healthcare_provider: {
    label: "Hospital / Medical Clinic",
    keywords: [
      "patient",
      "appointment",
      "doctor",
      "emergency",
      "insurance accepted",
      "hospital",
      "clinic",
      "medical center",
      "patient care",
      "patient portal",
      "schedule",
      "visit",
      "treatment",
      "physician"
    ],
    antiKeywords: [
      "fda approved drug",
      "prescription drug",
      "clinical trial enrollment",
      "drug development",
      "pharmaceutical products"
    ],
    schemaTypes: ["Hospital", "MedicalClinic", "Physician", "MedicalOrganization"],
    navPatterns: ["patient portal", "find a doctor", "services", "locations", "appointments"],
    queryTypes: [
      "appointment",
      "wait times",
      "insurance",
      "services",
      "doctors",
      "emergency room",
      "visiting hours",
      "patient portal"
    ]
  },

  health_insurance: {
    label: "Health Insurance Provider",
    keywords: [
      "plan",
      "coverage",
      "deductible",
      "network",
      "claims",
      "premium",
      "health insurance",
      "benefits",
      "copay",
      "out of pocket"
    ],
    antiKeywords: [
      "patient portal",
      "fda approved",
      "prescription drug",
      "appointment booking",
      "emergency room"
    ],
    schemaTypes: ["InsuranceAgency", "HealthInsurancePlan"],
    navPatterns: ["plans", "find care", "member login", "claims", "benefits"],
    queryTypes: [
      "coverage",
      "network",
      "premiums",
      "enrollment",
      "claims",
      "deductible",
      "out of pocket",
      "plan comparison"
    ]
  },

  medical_devices: {
    label: "Medical Device Manufacturer",
    keywords: [
      "device",
      "implant",
      "diagnostic",
      "fda cleared",
      "surgical",
      "medical device",
      "equipment",
      "instrument"
    ],
    antiKeywords: [
      "patient appointment",
      "prescription drug",
      "insurance plans",
      "emergency room",
      "patient portal"
    ],
    schemaTypes: ["MedicalDevice", "Product"],
    navPatterns: ["products", "for professionals", "clinical evidence", "technology"],
    queryTypes: [
      "device features",
      "compatibility",
      "fda clearance",
      "clinical data",
      "specifications",
      "implant procedure"
    ]
  },

  biotech: {
    label: "Biotechnology / Research",
    keywords: [
      "biotech",
      "gene therapy",
      "crispr",
      "research",
      "genomics",
      "biotechnology",
      "genetic",
      "molecular"
    ],
    antiKeywords: [
      "patient care",
      "insurance",
      "appointment",
      "emergency room",
      "patient portal"
    ],
    schemaTypes: ["ResearchProject", "Organization"],
    navPatterns: ["pipeline", "research", "technology", "science", "platform"],
    queryTypes: [
      "technology platform",
      "research focus",
      "partnerships",
      "gene therapy",
      "clinical pipeline"
    ]
  },

  telemedicine: {
    label: "Telemedicine / Digital Health",
    keywords: [
      "telehealth",
      "virtual visit",
      "online doctor",
      "digital health",
      "telemedicine",
      "remote care"
    ],
    antiKeywords: ["physical location", "emergency room", "hospital"],
    schemaTypes: ["MedicalBusiness", "SoftwareApplication"],
    navPatterns: ["how it works", "start visit", "pricing", "virtual care"],
    queryTypes: [
      "virtual care",
      "online consultation",
      "prescriptions online",
      "telemedicine",
      "remote doctor"
    ]
  },

  pharmacy: {
    label: "Pharmacy / Drug Retailer",
    keywords: [
      "pharmacy",
      "prescriptions",
      "fill rx",
      "pharmacy hours",
      "refill",
      "pharmacist"
    ],
    antiKeywords: [
      "fda approved drug development",
      "clinical trials",
      "drug manufacturer"
    ],
    schemaTypes: ["Pharmacy", "Store"],
    navPatterns: ["locations", "refills", "transfer prescription", "pharmacy services"],
    queryTypes: [
      "pharmacy hours",
      "prescription refill",
      "pharmacy locations",
      "transfer prescription",
      "rx costs"
    ]
  },

  health_services: {
    label: "Health Services / Lab Testing",
    keywords: [
      "lab test",
      "diagnostic",
      "screening",
      "results",
      "laboratory",
      "testing"
    ],
    antiKeywords: ["drug development", "patient admission", "emergency room"],
    schemaTypes: ["MedicalTest", "DiagnosticProcedure"],
    navPatterns: ["tests", "locations", "results login", "test menu"],
    queryTypes: [
      "test types",
      "preparation",
      "results turnaround",
      "lab locations",
      "testing requirements"
    ]
  },

  // === TECHNOLOGY VERTICAL ===
  saas_b2b: {
    label: "SaaS / B2B Software",
    keywords: [
      "software",
      "platform",
      "cloud",
      "api",
      "integration",
      "saas",
      "enterprise",
      "business software"
    ],
    antiKeywords: [
      "patient care",
      "prescription",
      "emergency room",
      "retail store",
      "physical location"
    ],
    schemaTypes: ["SoftwareApplication", "Product"],
    navPatterns: ["pricing", "features", "integrations", "api", "for teams"],
    queryTypes: [
      "pricing",
      "features",
      "integrations",
      "api",
      "security",
      "alternatives",
      "reviews"
    ]
  },

  // === RETAIL VERTICAL ===
  retail: {
    label: "Retail / Department Store",
    keywords: [
      "store",
      "shop",
      "buy",
      "sale",
      "products",
      "retail",
      "shopping",
      "merchandise"
    ],
    antiKeywords: [
      "patient",
      "appointment",
      "fda approved",
      "prescription",
      "software as a service"
    ],
    schemaTypes: ["Store", "Product"],
    navPatterns: ["shop", "departments", "deals", "locations", "weekly ad"],
    queryTypes: [
      "hours",
      "locations",
      "prices",
      "sales",
      "products",
      "return policy",
      "delivery"
    ]
  },

  ecommerce: {
    label: "E-Commerce / Online Marketplace",
    keywords: [
      "online shopping",
      "marketplace",
      "buy online",
      "free shipping",
      "ecommerce",
      "cart"
    ],
    antiKeywords: [
      "patient",
      "appointment",
      "prescription",
      "emergency room"
    ],
    schemaTypes: ["OnlineStore", "Product"],
    navPatterns: ["shop", "deals", "cart", "account", "orders"],
    queryTypes: [
      "shipping",
      "returns",
      "deals",
      "products",
      "prices",
      "delivery time",
      "coupon codes"
    ]
  },

  // === TRAVEL VERTICAL ===
  travel_air: {
    label: "Airline",
    keywords: [
      "flights",
      "airline",
      "booking",
      "baggage",
      "travel",
      "fly",
      "airport"
    ],
    antiKeywords: [
      "patient",
      "hospital",
      "prescription",
      "fda approved",
      "software"
    ],
    schemaTypes: ["Airline", "Flight"],
    navPatterns: ["book", "check-in", "flight status", "destinations", "deals"],
    queryTypes: [
      "baggage fees",
      "flight status",
      "check-in",
      "destinations",
      "booking",
      "miles",
      "cancellation"
    ]
  },

  travel_hotels: {
    label: "Hotel Chain",
    keywords: [
      "hotel",
      "rooms",
      "reservations",
      "accommodation",
      "stay",
      "booking"
    ],
    antiKeywords: [
      "patient",
      "hospital",
      "prescription",
      "fda approved"
    ],
    schemaTypes: ["Hotel", "LodgingBusiness"],
    navPatterns: ["book", "locations", "rewards", "offers", "amenities"],
    queryTypes: [
      "reservations",
      "rates",
      "locations",
      "amenities",
      "cancellation",
      "loyalty program"
    ]
  },

  travel_cruise: {
    label: "Cruise Line",
    keywords: [
      "cruise",
      "ship",
      "voyages",
      "sailing",
      "destinations",
      "itinerary"
    ],
    antiKeywords: [
      "patient",
      "hospital",
      "prescription",
      "fda approved"
    ],
    schemaTypes: ["TouristAttraction", "TravelAgency"],
    navPatterns: ["destinations", "book", "ships", "deals", "itineraries"],
    queryTypes: [
      "destinations",
      "pricing",
      "itineraries",
      "ships",
      "deals",
      "what's included"
    ]
  },

  travel_booking: {
    label: "Travel Booking Platform",
    keywords: [
      "book travel",
      "hotels",
      "flights",
      "vacation packages",
      "travel deals"
    ],
    antiKeywords: ["patient", "prescription", "hospital"],
    schemaTypes: ["TravelAgency", "Service"],
    navPatterns: ["flights", "hotels", "cars", "deals", "vacations"],
    queryTypes: [
      "booking",
      "deals",
      "packages",
      "cancellation",
      "refunds",
      "customer service"
    ]
  },

  vacation_rentals: {
    label: "Vacation Rentals",
    keywords: [
      "vacation rental",
      "home rental",
      "property",
      "stays",
      "host"
    ],
    antiKeywords: ["patient", "prescription", "hospital"],
    schemaTypes: ["RealEstateAgent", "Accommodation"],
    navPatterns: ["search", "host", "help", "trips", "experiences"],
    queryTypes: [
      "booking",
      "fees",
      "cancellation",
      "host policies",
      "locations",
      "amenities"
    ]
  },

  // === AUTOMOTIVE VERTICAL ===
  automotive_oem: {
    label: "Automotive Manufacturer",
    keywords: [
      "vehicles",
      "cars",
      "auto",
      "models",
      "dealerships",
      "automotive"
    ],
    antiKeywords: [
      "patient",
      "hospital",
      "prescription",
      "fda approved"
    ],
    schemaTypes: ["AutoDealer", "Product"],
    navPatterns: ["vehicles", "models", "dealers", "build", "shop"],
    queryTypes: [
      "models",
      "pricing",
      "features",
      "specs",
      "dealers",
      "reviews",
      "financing"
    ]
  },

  // === EDUCATION VERTICAL ===
  university: {
    label: "University / Higher Education",
    keywords: [
      "university",
      "college",
      "education",
      "degree",
      "admissions",
      "campus",
      "students"
    ],
    antiKeywords: [
      "patient",
      "hospital",
      "prescription",
      "retail store"
    ],
    schemaTypes: ["CollegeOrUniversity", "EducationalOrganization"],
    navPatterns: ["admissions", "academics", "campus life", "programs", "research"],
    queryTypes: [
      "admissions",
      "programs",
      "tuition",
      "requirements",
      "campus",
      "financial aid",
      "rankings"
    ]
  },

  // === RESTAURANT VERTICAL ===
  restaurants: {
    label: "Restaurant / Fast Food Chain",
    keywords: [
      "menu",
      "restaurant",
      "food",
      "dining",
      "delivery",
      "order"
    ],
    antiKeywords: [
      "patient",
      "hospital",
      "prescription",
      "fda approved"
    ],
    schemaTypes: ["Restaurant", "FoodEstablishment"],
    navPatterns: ["menu", "locations", "order", "delivery", "deals"],
    queryTypes: [
      "menu",
      "locations",
      "hours",
      "delivery",
      "nutritional info",
      "deals",
      "catering"
    ]
  },

  // === MEDIA & ENTERTAINMENT ===
  streaming: {
    label: "Streaming Service",
    keywords: [
      "streaming",
      "watch",
      "shows",
      "movies",
      "content",
      "video"
    ],
    antiKeywords: [
      "patient",
      "hospital",
      "prescription"
    ],
    schemaTypes: ["BroadcastService", "EntertainmentBusiness"],
    navPatterns: ["browse", "plans", "originals", "movies", "shows"],
    queryTypes: [
      "pricing",
      "content",
      "plans",
      "devices",
      "cancel subscription",
      "new releases"
    ]
  },

  social_media: {
    label: "Social Media Platform",
    keywords: [
      "social",
      "connect",
      "share",
      "network",
      "post",
      "follow"
    ],
    antiKeywords: [
      "patient",
      "hospital",
      "prescription"
    ],
    schemaTypes: ["WebSite", "Organization"],
    navPatterns: ["profile", "feed", "messages", "notifications", "settings"],
    queryTypes: [
      "privacy",
      "account",
      "settings",
      "delete account",
      "advertising",
      "help"
    ]
  },

  // === TELECOM ===
  telecom: {
    label: "Telecommunications Provider",
    keywords: [
      "wireless",
      "phone",
      "internet",
      "plans",
      "network",
      "coverage"
    ],
    antiKeywords: [
      "patient",
      "hospital",
      "prescription"
    ],
    schemaTypes: ["Telecommunication", "Service"],
    navPatterns: ["plans", "coverage", "devices", "support", "business"],
    queryTypes: [
      "plans",
      "coverage",
      "devices",
      "pricing",
      "upgrades",
      "customer service"
    ]
  },

  // === PROFESSIONAL SERVICES ===
  consulting: {
    label: "Consulting Services",
    keywords: [
      "consulting",
      "advisory",
      "strategy",
      "management",
      "services"
    ],
    antiKeywords: [
      "patient",
      "hospital",
      "prescription",
      "retail"
    ],
    schemaTypes: ["ProfessionalService", "Organization"],
    navPatterns: ["services", "insights", "careers", "industries", "about"],
    queryTypes: [
      "services",
      "careers",
      "industries",
      "expertise",
      "case studies",
      "contact"
    ]
  },

  // === FINANCIAL SERVICES ===
  financial_services: {
    label: "Financial Services / Banking",
    keywords: [
      "bank",
      "banking",
      "financial",
      "accounts",
      "loans",
      "credit",
      "investment"
    ],
    antiKeywords: [
      "patient",
      "hospital",
      "prescription",
      "fda approved"
    ],
    schemaTypes: ["BankOrCreditUnion", "FinancialService"],
    navPatterns: ["accounts", "loans", "credit cards", "investments", "online banking"],
    queryTypes: [
      "accounts",
      "rates",
      "loans",
      "credit cards",
      "fees",
      "online banking",
      "customer service"
    ]
  },

  // === GENERIC / FALLBACK ===
  generic_consumer: {
    label: "Generic / Consumer",
    keywords: [],
    antiKeywords: [],
    schemaTypes: [],
    navPatterns: [],
    queryTypes: [
      "hours",
      "location",
      "contact",
      "about",
      "services",
      "products"
    ]
  }
};

/**
 * Validates if a query is appropriate for the given industry
 */
export function validateQueryForIndustry(
  query: string,
  industry: string
): { valid: boolean; reason?: string } {
  const industryConfig = INDUSTRY_TAXONOMY[industry];
  if (!industryConfig) {
    return { valid: true }; // Unknown industry, allow query
  }

  const queryLower = query.toLowerCase();

  // Check for anti-keywords (immediate rejection)
  for (const antiKeyword of industryConfig.antiKeywords) {
    if (queryLower.includes(antiKeyword.toLowerCase())) {
      return {
        valid: false,
        reason: `Query contains "${antiKeyword}" which is incompatible with industry "${industryConfig.label}"`
      };
    }
  }

  // Check if query matches expected query types (soft validation)
  const hasExpectedType = industryConfig.queryTypes.some(type =>
    queryLower.includes(type.toLowerCase())
  );

  // Only warn if no expected types found AND we have query types defined
  if (!hasExpectedType && industryConfig.queryTypes.length > 0) {
    // Soft validation - still allow but log warning
    return {
      valid: true, // Allow it but...
      reason: `Query doesn't match expected types for "${industryConfig.label}": ${industryConfig.queryTypes.join(", ")}`
    };
  }

  return { valid: true };
}

/**
 * Get industry confidence boost from schema types
 */
export function calculateSchemaBoost(
  schemaTypes: string[],
  industry: string
): number {
  const industryConfig = INDUSTRY_TAXONOMY[industry];
  if (!industryConfig) return 0;

  for (const schemaType of schemaTypes) {
    if (industryConfig.schemaTypes.some(expected =>
      schemaType.toLowerCase().includes(expected.toLowerCase())
    )) {
      return 0.10; // 10% boost for matching schema
    }
  }

  return 0;
}

