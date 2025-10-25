/**
 * Template Resolver - Cascading Template Resolution
 * 
 * Resolves prompt templates hierarchically:
 * - health.pharma.brand → health.pharma → health → default
 * - Merges templates from all ancestors
 * - De-duplicates final list
 */

import { getAncestorSlugs, INDUSTRY_TAXONOMY_V2 } from '../config/industry-taxonomy-v2';

export interface PromptTemplateSet {
  branded: string[];
  nonBranded: string[];
}

/**
 * Prompt templates organized by industry hierarchy
 */
export const PROMPT_TEMPLATES_V2: Record<string, PromptTemplateSet> = {
  // ==================== HEALTH (Parent) ====================
  'health': {
    branded: [
      'Does {brand} accept my insurance?',
      'What services does {brand} offer?',
      'How do I contact {brand}?',
      '{brand} locations near me',
      '{brand} customer reviews'
    ],
    nonBranded: [
      'Best healthcare options for {condition}',
      'How to choose a healthcare provider',
      'Understanding health insurance coverage',
      'Healthcare costs and billing'
    ]
  },
  
  // ==================== HEALTH.PHARMA.BRAND (Child) ====================
  'health.pharma.brand': {
    branded: [
      '{brand} {product} Prescribing Information (PI) PDF and Medication Guide',
      '{brand} {product} indication and who it\'s for',
      'Contraindications and boxed warnings for {brand} {product}',
      '{brand} {product} dosage and administration',
      '{brand} {product} side effects and safety info',
      '{brand} {product} mechanism of action (MoA)',
      '{brand} {product} patient savings card / copay assistance',
      '{brand} {product} clinical trial results (phase, outcome)',
      '{brand} {product} vs {competitor} (on-label comparison)',
      '{brand} {product} HCP vs Patient site—official links',
      '{brand} {product} FDA approval date/status',
      'How to report side effects to {brand} (pharmacovigilance contact)'
    ],
    nonBranded: [
      'Treatments for {condition}: overview and official PI sources',
      'Side effects by {drug_class} (and how to read PI sections)',
      'How to find patient assistance for expensive medications',
      'Understanding the FDA drug approval process',
      'What to ask your doctor about starting {drug_class}',
      'Generic vs brand medicines for {condition}'
    ]
  },
  
  // ==================== HEALTH.PROVIDERS (Child) ====================
  'health.providers': {
    branded: [
      'How do I find a doctor at {brand}?',
      'Does {brand} accept {insurance} and {plan}?',
      '{brand} urgent care hours today ({today}) in {city}',
      'How to schedule an appointment at {brand}',
      '{brand} patient portal login (name of portal and official link)',
      'What specialties and {department} does {brand} offer?',
      '{brand} emergency room wait times in {city}',
      '{brand} billing, payment options, and financial assistance',
      'Is {brand} accepting new patients for {department}?',
      '{brand} medical records release and contact',
      'Parking, directions, and campus map for {brand} {city} location',
      '{brand} visitor policy and official site link'
    ],
    nonBranded: [
      'Best hospitals for {procedure} in {city}, {state}',
      'How to find an in-network primary care doctor in {city}',
      'What to expect at urgent care vs emergency room',
      'Hospital patient rights and medical billing basics',
      'How to choose a specialist for {condition}',
      'Where to get same-day appointments in {city}'
    ]
  },
  
  // ==================== SOFTWARE (Parent) ====================
  'software': {
    branded: [
      '{brand} pricing and plans',
      'How does {brand} work?',
      '{brand} free trial',
      '{brand} customer support',
      '{brand} vs {competitor}',
      'Is {brand} worth it?'
    ],
    nonBranded: [
      'Best {category} software for small business',
      'How to choose {category} software',
      '{category} software comparison',
      'Free vs paid {category} tools'
    ]
  },
  
  // ==================== SOFTWARE.SAAS (Child) ====================
  'software.saas': {
    branded: [
      '{brand} pricing and plans (official pricing page)',
      '{brand} integrations & API docs',
      '{brand} security & compliance (SOC 2, ISO, HIPAA/BAA)',
      '{brand} data residency and privacy policy',
      '{brand} service SLA and uptime guarantees',
      '{brand} status page and incident history',
      '{brand} SSO/SAML setup and supported IdPs',
      '{brand} rate limits and API quotas',
      '{brand} implementation timeline and onboarding guide',
      'Migrating from {competitor} to {brand} (official migration docs)'
    ],
    nonBranded: [
      'SaaS vs on-prem: security, cost, and compliance checklist',
      'How to evaluate SaaS vendors (security questionnaire basics)',
      'Data residency vs data sovereignty in cloud apps',
      'SSO/SAML vs OAuth for business apps',
      'SLA terms explained (RTO/RPO, uptime, credits)'
    ]
  },
  
  // ==================== SOFTWARE.CDP_CRM (Child) ====================
  'software.cdp_crm': {
    branded: [
      'How does {brand} CRM help sales teams?',
      '{brand} lead scoring and automation',
      '{brand} reporting and analytics',
      '{brand} mobile app features',
      'Migrating from {competitor} to {brand}',
      '{brand} customization options',
      '{brand} customer data platform capabilities'
    ],
    nonBranded: [
      'CRM vs CDP comparison',
      'Best CRM for small business',
      'Sales automation strategies',
      'Customer data platform benefits'
    ]
  },
  
  // ==================== AUTOMOTIVE (Parent) ====================
  'automotive': {
    branded: [
      '{brand} {model} reviews',
      '{brand} reliability and quality',
      '{brand} warranty coverage',
      '{brand} financing and incentives',
      '{brand} near me',
      'Is {brand} a good car?'
    ],
    nonBranded: [
      'Best {category} vehicles for families',
      'Most reliable car brands',
      'How to buy a car',
      'New vs used car buying guide'
    ]
  },
  
  // ==================== AUTOMOTIVE.OEM (Child) ====================
  'automotive.oem': {
    branded: [
      '{brand} {model} specs and features (official brochure)',
      '{brand} {model} safety ratings and driver-assist features',
      '{brand} {model} owner\'s manual and maintenance schedule',
      '{brand} {model} warranty coverage and exclusions',
      '{brand} {model} build & price (official configurator)',
      '{brand} {model} MPG/range and charging time (EV/hybrid)',
      '{brand} {model} towing capacity and payload',
      '{brand} {model} software updates / OTA release notes',
      '{brand} certified pre-owned program details',
      '{brand} recalls and VIN lookup (official)',
      '{brand} {model} winter/terrain performance',
      '{brand} roadside assistance coverage and contact'
    ],
    nonBranded: [
      'Safest family vehicles this year',
      'EV vs hybrid cost of ownership overview',
      'Best SUVs under $40k (features to compare)',
      'How to check recalls with a VIN',
      'How often to service a new car',
      'What\'s included in manufacturer warranties'
    ]
  },
  
  // ==================== RETAIL.GROCERY (Child) ====================
  'retail.grocery': {
    branded: [
      '{brand} weekly ad and deals',
      '{brand} store hours and locations',
      '{brand} online ordering and delivery',
      '{brand} pharmacy services',
      '{brand} loyalty program and rewards',
      '{brand} deli and bakery menu',
      'Organic and natural products at {brand}',
      '{brand} vs {competitor} prices'
    ],
    nonBranded: [
      'Best grocery stores for organic food',
      'Grocery delivery services comparison',
      'How to save money on groceries',
      'Meal planning and grocery shopping tips'
    ]
  },
  
  // ==================== RETAIL.WHOLESALE_CLUB ====================
  'retail.wholesale_club': {
    branded: [
      '{brand} membership cost and benefits',
      '{brand} gas prices near me',
      '{brand} tire center services',
      '{brand} business membership',
      '{brand} exclusive deals for members',
      'Is {brand} membership worth it?',
      '{brand} optical center',
      '{brand} pharmacy hours'
    ],
    nonBranded: [
      'Warehouse club membership comparison',
      'Best warehouse club for families',
      'Bulk buying savings calculator',
      'Warehouse club vs grocery store prices'
    ]
  },
  
  // ==================== FOOD_RESTAURANT.FAST_CASUAL ====================
  'food_restaurant.fast_casual': {
    branded: [
      '{brand} menu and prices',
      '{brand} nutrition information',
      '{brand} catering options',
      '{brand} rewards program',
      '{brand} mobile ordering',
      '{brand} dietary options (vegan, gluten-free)',
      '{brand} vs {competitor}',
      'Healthiest options at {brand}'
    ],
    nonBranded: [
      'Best fast casual restaurants',
      'Healthy fast casual options',
      'Fast casual vs fast food',
      'Fast casual restaurant trends'
    ]
  },
  
  // ==================== FOOD_RESTAURANT.CASUAL ====================
  'food_restaurant.casual': {
    branded: [
      '{brand} menu and current prices (official menu page)',
      '{brand} nutrition & allergens PDF',
      '{brand} happy hour and specials in {city}',
      '{brand} reservations and wait times (official app/page)',
      '{brand} takeout & delivery partners and fees',
      '{brand} kids menu and family deals',
      '{brand} gift cards balance and terms',
      '{brand} catering options and order lead times',
      '{brand} location hours today ({today}) in {city}',
      '{brand} return/refund policy for online orders'
    ],
    nonBranded: [
      'Best casual dining options for families in {city}',
      'How to check restaurant allergen info',
      'Tips for finding wait times and booking tables',
      'Comparing delivery fees across apps',
      'What counts as a "kids eat free" deal'
    ]
  },
  
  // ==================== FOOD_RESTAURANT.QSR (Quick Service / Fast Food / Beverages) ====================
  'food_restaurant.qsr': {
    branded: [
      '{brand} nutrition facts',
      '{brand} flavors and varieties',
      'Where to buy {brand}',
      '{brand} vs {competitor}',
      '{brand} ingredients and caffeine',
      'Is {brand} healthy?',
      '{brand} promotions and deals',
      '{brand} near me',
      '{brand} reviews and ratings',
      'Benefits of {brand}',
      '{brand} side effects',
      '{brand} pricing'
    ],
    nonBranded: [
      'Best energy drinks for focus',
      'Healthiest energy drink options',
      'Energy drink caffeine comparison',
      'Natural energy boosters',
      'Energy drinks vs coffee',
      'Low sugar energy drinks',
      'Energy drink safety',
      'Best tasting energy drinks'
    ]
  },
  
  // ==================== RETAIL.CPG.BEVERAGE (Taxonomy V2: Proper classification for beverages/CPG) ====================
  // This is the proper home for energy drinks, coffee, packaged beverages
  'retail.cpg.beverage': {
    branded: [
      '{brand} nutrition facts',
      '{brand} flavors and varieties',
      'Where to buy {brand}',
      '{brand} vs {competitor}',
      '{brand} ingredients and caffeine',
      'Is {brand} healthy?',
      '{brand} promotions and deals',
      '{brand} near me',
      '{brand} reviews and ratings',
      'Benefits of {brand}',
      '{brand} side effects',
      '{brand} pricing'
    ],
    nonBranded: [
      'Best energy drinks for focus',
      'Healthiest energy drink options',
      'Energy drink caffeine comparison',
      'Natural energy boosters',
      'Energy drinks vs coffee',
      'Low sugar energy drinks',
      'Energy drink safety',
      'Best tasting energy drinks'
    ]
  },
  
  // Aliases for backward compatibility (map to retail.cpg.beverage)
  'FOOD & RESTAURANT.qsr': {
    branded: [
      '{brand} nutrition facts',
      '{brand} flavors and varieties',
      'Where to buy {brand}',
      '{brand} vs {competitor}',
      '{brand} ingredients and caffeine',
      'Is {brand} healthy?',
      '{brand} promotions and deals',
      '{brand} near me',
      '{brand} reviews and ratings',
      'Benefits of {brand}',
      '{brand} side effects',
      '{brand} pricing'
    ],
    nonBranded: [
      'Best energy drinks for focus',
      'Healthiest energy drink options',
      'Energy drink caffeine comparison',
      'Natural energy boosters',
      'Energy drinks vs coffee',
      'Low sugar energy drinks',
      'Energy drink safety',
      'Best tasting energy drinks'
    ]
  },
  
  // ==================== FINANCE.INSURANCE.P_AND_C ====================
  'finance.insurance.p_and_c': {
    branded: [
      '{brand} auto insurance quote',
      '{brand} home insurance coverage',
      '{brand} discounts and savings',
      '{brand} customer service and claims',
      '{brand} vs {competitor} rates',
      'How much is {brand} insurance?',
      '{brand} bundling options',
      '{brand} mobile app features'
    ],
    nonBranded: [
      'How to get cheap car insurance',
      'Home insurance coverage explained',
      'Best auto insurance for young drivers',
      'Insurance deductibles explained'
    ]
  },
  
  // ==================== FINANCE.LENDING.MORTGAGE ====================
  'finance.lending.mortgage': {
    branded: [
      '{brand} mortgage rates today',
      '{brand} pre-approval process',
      '{brand} refinance savings calculator',
      '{brand} closing costs',
      '{brand} FHA and VA loans',
      'How long does {brand} approval take?',
      '{brand} vs {competitor} rates',
      '{brand} customer reviews'
    ],
    nonBranded: [
      'Current mortgage rates',
      'How to get pre-approved for a mortgage',
      'Refinancing vs home equity loan',
      'First-time homebuyer programs'
    ]
  },
  
  // ==================== FINANCE.BROKERAGE.TRADING ====================
  'finance.brokerage.trading': {
    branded: [
      '{brand} commission and fees',
      '{brand} account types (IRA, 401k, taxable)',
      '{brand} research and tools',
      '{brand} mobile app features',
      '{brand} vs {competitor}',
      'How to open an account with {brand}',
      '{brand} customer support',
      '{brand} fractional shares'
    ],
    nonBranded: [
      'Best brokerage for beginners',
      'Commission-free trading platforms',
      'Roth IRA vs Traditional IRA',
      'How to start investing with $100'
    ]
  },
  
  // ==================== TRAVEL.CRUISE ====================
  'travel.cruise': {
    branded: [
      '{brand} cruise itineraries and destinations',
      '{brand} cabin types and pricing',
      '{brand} dining options',
      '{brand} shore excursions',
      '{brand} kids programs and activities',
      '{brand} drink packages',
      '{brand} vs {competitor}',
      'Best time to book {brand} cruise'
    ],
    nonBranded: [
      'First-time cruise tips',
      'Best cruise lines for families',
      'Alaska cruise vs Caribbean cruise',
      'Cruise packing list'
    ]
  },
  
  // ==================== TRAVEL.VACATION_RENTALS ====================
  'travel.vacation_rentals': {
    branded: [
      '{brand} property search',
      '{brand} host reviews and ratings',
      '{brand} cancellation policy',
      '{brand} cleaning fees',
      '{brand} guest service fees',
      '{brand} vs {competitor}',
      'How to find the best deals on {brand}',
      '{brand} superhost benefits'
    ],
    nonBranded: [
      'Vacation rental vs hotel',
      'How to find safe vacation rentals',
      'Vacation rental scams to avoid',
      'Best vacation rental sites'
    ]
  },
  
  // ==================== EDUCATION.HIGHER.PUBLIC ====================
  'education.higher.public': {
    branded: [
      '{brand} admissions requirements',
      '{brand} in-state vs out-of-state tuition',
      '{brand} financial aid and scholarships',
      '{brand} popular majors',
      '{brand} campus life and housing',
      '{brand} acceptance rate',
      '{brand} vs {competitor}',
      'How to get into {brand}'
    ],
    nonBranded: [
      'Best public universities',
      'In-state vs out-of-state tuition',
      'How to apply for financial aid',
      'College major selection tips'
    ]
  },
  
  // ==================== EDUCATION.HIGHER.PRIVATE ====================
  'education.higher.private': {
    branded: [
      '{brand} admissions requirements',
      '{brand} tuition and fees',
      '{brand} merit scholarships',
      '{brand} campus visit',
      '{brand} early decision vs regular decision',
      '{brand} acceptance rate',
      '{brand} vs {competitor}',
      'Is {brand} worth the cost?'
    ],
    nonBranded: [
      'Best private universities',
      'How to pay for private college',
      'Private vs public university',
      'College rankings and reputation'
    ]
  },
  
  // ==================== TELECOM.WIRELESS ====================
  'telecom.wireless': {
    branded: [
      '{brand} plans and pricing',
      '{brand} coverage map',
      '{brand} bring your own phone',
      '{brand} family plans',
      '{brand} unlimited data options',
      '{brand} international roaming',
      '{brand} vs {competitor}',
      'How to switch to {brand}'
    ],
    nonBranded: [
      'Best cell phone plans',
      'Unlimited data plans comparison',
      'How to reduce cell phone bill',
      'Prepaid vs postpaid plans'
    ]
  },
  
  // ==================== TELECOM.ISP_BROADBAND ====================
  'telecom.isp_broadband': {
    branded: [
      '{brand} internet plans and speeds',
      '{brand} availability in my area',
      '{brand} installation and setup',
      '{brand} modem and router rental',
      '{brand} data caps',
      '{brand} vs {competitor}',
      '{brand} customer service',
      '{brand} internet only (no cable)'
    ],
    nonBranded: [
      'Best internet providers',
      'How much internet speed do I need?',
      'Cable vs fiber internet',
      'Internet plans for streaming'
    ]
  },
  
  // ==================== MEDIA.STREAMING.MUSIC ====================
  'media.streaming.music': {
    branded: [
      '{brand} subscription plans and pricing',
      '{brand} music library size',
      '{brand} podcast selection',
      '{brand} student discount',
      '{brand} family plan',
      '{brand} vs {competitor}',
      '{brand} offline listening',
      '{brand} audio quality'
    ],
    nonBranded: [
      'Best music streaming services',
      'Free vs paid music streaming',
      'Music streaming sound quality comparison',
      'Best podcasts to listen to'
    ]
  },
  
  // ==================== PROFESSIONAL.CONSULTING.MGMT ====================
  'professional.consulting.mgmt': {
    branded: [
      '{brand} services and industries',
      '{brand} case studies',
      '{brand} careers and recruiting',
      '{brand} vs {competitor}',
      '{brand} consulting approach',
      'How to work with {brand}',
      '{brand} office locations',
      '{brand} partner bios'
    ],
    nonBranded: [
      'Top management consulting firms',
      'How to hire a consultant',
      'Consulting vs in-house',
      'What do management consultants do?'
    ]
  },
  
  // ==================== HEALTH.PAYERS ====================
  'health.payers': {
    branded: [
      '{brand} plan options',
      '{brand} find a doctor',
      '{brand} claims and benefits',
      '{brand} prescription drug coverage',
      '{brand} enrollment periods',
      '{brand} customer service',
      '{brand} vs {competitor}',
      'Does {brand} cover {procedure}?'
    ],
    nonBranded: [
      'How to choose health insurance',
      'HMO vs PPO vs EPO',
      'Health insurance deductibles explained',
      'Open enrollment tips'
    ]
  },
  
  // ==================== HEALTH.DENTAL ====================
  'health.dental': {
    branded: [
      '{brand} services and procedures',
      '{brand} insurance accepted',
      '{brand} new patient special',
      '{brand} emergency dental',
      '{brand} cosmetic dentistry',
      '{brand} teeth whitening cost',
      '{brand} near me',
      '{brand} patient reviews'
    ],
    nonBranded: [
      'How often should I visit the dentist?',
      'Dental insurance coverage',
      'Teeth whitening options',
      'Emergency dental care'
    ]
  },
  
  // ==================== HEALTH.MENTAL_BEHAVIORAL ====================
  'health.mental_behavioral': {
    branded: [
      '{brand} how it works',
      '{brand} therapist matching',
      '{brand} insurance coverage',
      '{brand} pricing',
      '{brand} video vs phone vs chat',
      '{brand} vs {competitor}',
      '{brand} crisis support',
      'Is {brand} covered by insurance?'
    ],
    nonBranded: [
      'How to find a therapist',
      'Online therapy vs in-person',
      'How much does therapy cost?',
      'Mental health resources'
    ]
  },
  
  // ==================== AUTOMOTIVE.RENTAL ====================
  'automotive.rental': {
    branded: [
      '{brand} rental rates',
      '{brand} car classes',
      '{brand} insurance options',
      '{brand} loyalty program',
      '{brand} young driver fees',
      '{brand} vs {competitor}',
      '{brand} airport locations',
      'How to rent a car from {brand}'
    ],
    nonBranded: [
      'Best car rental companies',
      'How to get cheap car rentals',
      'Car rental insurance explained',
      'One-way car rental options'
    ]
  },
  
  // ==================== AUTOMOTIVE.EV ====================
  'automotive.ev': {
    branded: [
      '{brand} {model} electric range',
      '{brand} {model} charging time',
      '{brand} {model} tax incentives',
      '{brand} {model} vs {competitor}',
      '{brand} charging network',
      '{brand} {model} battery warranty',
      '{brand} {model} cost to own',
      '{brand} {model} cold weather performance'
    ],
    nonBranded: [
      'Best electric cars',
      'EV vs hybrid comparison',
      'Home EV charging installation',
      'Electric car tax credits'
    ]
  },
  
  // ==================== RETAIL.BEAUTY ====================
  'retail.beauty': {
    branded: [
      '{brand} rewards program',
      '{brand} return policy',
      '{brand} online vs in-store',
      '{brand} beauty services',
      '{brand} exclusive brands',
      '{brand} vs {competitor}',
      '{brand} coupons and sales',
      '{brand} product recommendations'
    ],
    nonBranded: [
      'Best beauty products for {concern}',
      'Drugstore vs high-end makeup',
      'Clean beauty brands',
      'Beauty product reviews'
    ]
  },
  
  // ==================== MEDIA (Parent) ====================
  'media': {
    branded: [
      '{brand} content and programming',
      '{brand} subscription cost',
      '{brand} vs {competitor}',
      '{brand} app and streaming',
      '{brand} customer reviews'
    ],
    nonBranded: [
      'Best media streaming services',
      'How to cut cable',
      'Streaming vs traditional media',
      'Entertainment options comparison'
    ]
  },
  
  // ==================== MEDIA.NEWS ====================
  'media.news': {
    branded: [
      '{brand} breaking news coverage',
      '{brand} political bias and objectivity',
      '{brand} subscription cost',
      '{brand} vs {competitor}',
      '{brand} investigative reporting',
      '{brand} digital subscription benefits',
      '{brand} mobile app features',
      'Is {brand} reliable?',
      '{brand} opinion vs news coverage',
      '{brand} international news',
      '{brand} fact-checking accuracy'
    ],
    nonBranded: [
      'Most trusted news sources',
      'How to identify news bias',
      'Best news apps',
      'Free vs paid news subscriptions',
      'Breaking news alerts',
      'Local vs national news coverage',
      'Fact-checking websites',
      'News media literacy'
    ]
  },
  
  // ==================== MEDIA.SPORTS ====================
  'media.sports': {
    branded: [
      '{brand} live sports streaming',
      '{brand}+ subscription worth it?',
      '{brand} vs {competitor} for sports coverage',
      '{brand} live scores and updates',
      '{brand} fantasy sports',
      '{brand} mobile app features',
      '{brand} streaming quality',
      'What sports does {brand} cover?',
      '{brand} blackout restrictions',
      '{brand} international sports coverage',
      '{brand} college vs pro sports'
    ],
    nonBranded: [
      'Best sports streaming services',
      'How to watch live sports online',
      'Sports streaming without cable',
      'Fantasy sports tips and strategy',
      'Live sports scores apps',
      'College sports streaming',
      'International sports coverage',
      'Sports news aggregators'
    ]
  },
  
  // ==================== MEDIA.STREAMING.VIDEO ====================
  'media.streaming.video': {
    branded: [
      '{brand} original content',
      '{brand} subscription plans',
      '{brand} vs {competitor}',
      '{brand} content library size',
      '{brand} 4K and HDR support',
      '{brand} simultaneous streams',
      '{brand} download for offline',
      '{brand} family profiles',
      'Is {brand} worth it?',
      'Best shows on {brand}'
    ],
    nonBranded: [
      'Best streaming services for movies',
      'Streaming bundles comparison',
      'Free streaming services',
      'How many streaming services do I need?',
      '4K streaming requirements',
      'Best original series streaming'
    ]
  },
  
  // ==================== EDUCATION.ONLINE ====================
  'education.online': {
    branded: [
      '{brand} course catalog',
      '{brand} pricing and subscription',
      '{brand} certificates and credentials',
      '{brand} vs {competitor}',
      '{brand} course quality',
      '{brand} instructor reviews',
      '{brand} free courses',
      'Are {brand} certificates worth it?',
      '{brand} course completion rates',
      '{brand} career outcomes'
    ],
    nonBranded: [
      'Best online learning platforms',
      'Free online courses',
      'Online degrees vs certifications',
      'MOOCs comparison',
      'How to learn programming online',
      'Online course credibility',
      'Self-paced vs instructor-led courses'
    ]
  },
  
  // ==================== REAL_ESTATE (Parent) ====================
  'real_estate': {
    branded: [
      '{brand} property search',
      '{brand} agent services',
      '{brand} market data',
      '{brand} vs {competitor}',
      '{brand} fees and commissions'
    ],
    nonBranded: [
      'How to buy a house',
      'Real estate market trends',
      'Home buying process',
      'Real estate agent vs FSBO'
    ]
  },
  
  // ==================== REAL_ESTATE.RESIDENTIAL.BROKER ====================
  'real_estate.residential.broker': {
    branded: [
      '{brand} homes for sale near me',
      '{brand} home value estimator',
      '{brand} vs {competitor}',
      '{brand} mobile app features',
      '{brand} agent services',
      'How accurate is {brand} Zestimate?',
      '{brand} rental listings',
      '{brand} market trends',
      '{brand} mortgage calculator',
      '{brand} seller resources'
    ],
    nonBranded: [
      'Best real estate websites',
      'How to find homes for sale',
      'Home value estimation accuracy',
      'Real estate market data',
      'First-time home buyer tips',
      'How to price your home',
      'Real estate listing strategies'
    ]
  },
  
  // ==================== REAL_ESTATE.COMMERCIAL ====================
  'real_estate.commercial': {
    branded: [
      '{brand} commercial listings',
      '{brand} property types',
      '{brand} market analysis',
      '{brand} investment properties',
      '{brand} vs {competitor}',
      '{brand} broker services',
      '{brand} lease vs buy calculator'
    ],
    nonBranded: [
      'Commercial real estate investing',
      'Office space vs coworking',
      'Retail space for lease',
      'Commercial property financing',
      'CRE market trends'
    ]
  },
  
  // ==================== FINANCE (Parent) ====================
  'finance': {
    branded: [
      '{brand} account types',
      '{brand} fees and rates',
      '{brand} vs {competitor}',
      '{brand} customer service',
      '{brand} mobile banking',
      'Is {brand} safe?'
    ],
    nonBranded: [
      'Best financial services',
      'How to manage money',
      'Personal finance tips',
      'Financial planning basics'
    ]
  },
  
  // ==================== FINANCE.BANK ====================
  'finance.bank': {
    branded: [
      '{brand} checking accounts (fees, minimums) — official page',
      '{brand} savings account APY today ({today})',
      '{brand} routing number and wire instructions',
      '{brand} Zelle / instant transfer support',
      '{brand} mobile deposit and daily limits',
      '{brand} branch hours and holiday schedule in {city}',
      '{brand} ATM network and surcharge policy',
      'How to open an account with {brand} (requirements)',
      '{brand} overdraft policy and fees',
      '{brand} privacy policy and data sharing opt-outs',
      '{brand} customer service contact and secure message portal',
      '{brand} vs {competitor} for business banking'
    ],
    nonBranded: [
      'Best banks for high-yield savings',
      'Online vs branch banks: fees, access, support',
      'How to avoid bank fees',
      'Student checking account features to compare',
      'What is a routing number vs account number?',
      'How overdraft protection works'
    ]
  },
  
  // ==================== FINANCE.CREDIT_CARD ====================
  'finance.credit_card': {
    branded: [
      '{brand} rewards program',
      '{brand} annual fee',
      '{brand} welcome bonus',
      '{brand} vs {competitor}',
      '{brand} travel benefits',
      '{brand} cash back rate',
      '{brand} balance transfer',
      'How to apply for {brand} card',
      '{brand} credit score needed',
      '{brand} foreign transaction fees'
    ],
    nonBranded: [
      'Best credit cards for rewards',
      'Cash back vs travel rewards',
      'How to choose a credit card',
      'Credit card with no annual fee',
      'Building credit with credit cards',
      'Balance transfer strategies'
    ]
  },
  
  // ==================== TRAVEL (Parent) ====================
  'travel': {
    branded: [
      '{brand} booking process',
      '{brand} cancellation policy',
      '{brand} customer service',
      '{brand} vs {competitor}',
      '{brand} rewards program',
      '{brand} mobile app'
    ],
    nonBranded: [
      'Best travel booking sites',
      'How to find travel deals',
      'Travel planning tips',
      'Budget travel strategies'
    ]
  },
  
  // ==================== TRAVEL.AIR ====================
  'travel.air': {
    branded: [
      '{brand} flight status',
      '{brand} baggage fees',
      '{brand} seat selection',
      '{brand} vs {competitor}',
      '{brand} frequent flyer program',
      '{brand} flight deals',
      '{brand} change flight policy',
      '{brand} in-flight wifi',
      'How to check in with {brand}',
      '{brand} customer service'
    ],
    nonBranded: [
      'Best airlines for service',
      'How to find cheap flights',
      'Airline baggage policies',
      'Frequent flyer programs comparison',
      'Basic economy vs regular economy',
      'Flight booking tips'
    ]
  },
  
  // ==================== TRAVEL.HOTEL ====================
  'travel.hotel': {
    branded: [
      '{brand} hotel search',
      '{brand} rewards program',
      '{brand} cancellation policy',
      '{brand} vs {competitor}',
      '{brand} room types',
      '{brand} amenities',
      '{brand} member rates',
      'Best {brand} properties',
      '{brand} elite status benefits'
    ],
    nonBranded: [
      'Best hotel booking sites',
      'Hotel vs vacation rental',
      'Hotel rewards programs comparison',
      'How to get hotel upgrades',
      'Budget hotel chains',
      'Luxury hotel comparison'
    ]
  },
  
  // ==================== GOVERNMENT ====================
  'government': {
    branded: [
      '{brand} services and resources',
      'How to contact {brand}',
      '{brand} office locations',
      '{brand} hours of operation',
      '{brand} forms and applications',
      '{brand} eligibility requirements',
      '{brand} appointment scheduling',
      '{brand} online portal'
    ],
    nonBranded: [
      'Government services by state',
      'How to access public records',
      'Government assistance programs',
      'Voter registration process',
      'How to contact elected officials',
      'Government agency directory'
    ]
  },
  
  // ==================== NONPROFIT ====================
  'nonprofit': {
    branded: [
      '{brand} mission and impact',
      '{brand} donation options',
      '{brand} volunteer opportunities',
      '{brand} programs and services',
      '{brand} vs {competitor}',
      'How to donate to {brand}',
      '{brand} tax deductible',
      '{brand} annual report',
      '{brand} success stories'
    ],
    nonBranded: [
      'Best charities to donate to',
      'How to evaluate nonprofit effectiveness',
      'Volunteer opportunities near me',
      'Tax-deductible donations',
      'Nonprofit ratings and reviews',
      'Charitable giving strategies'
    ]
  },
  
  // ==================== FALLBACK ====================
  'generic_consumer': {
    branded: [
      '{brand} official website and contact page',
      '{brand} pricing and current promotions',
      '{brand} return & refund policy',
      '{brand} warranty terms and how to file a claim',
      '{brand} privacy policy and data deletion request',
      '{brand} owner\'s manual / getting started guide',
      '{brand} store hours today ({today}) in {city}',
      '{brand} product registration page',
      'Is {brand} legit? — official company info and about page',
      '{brand} vs {competitor} (feature comparison from official pages)'
    ],
    nonBranded: [
      'Best {category} options this year',
      '{category} buying guide: features to compare',
      'How to read a {category} warranty',
      'Return policy red flags to watch for',
      'How to contact customer support effectively',
      'How to spot counterfeit {category} products'
    ]
  }
};

/**
 * Resolve templates via cascading hierarchy
 * 
 * @param industrySlug - Hierarchical slug (e.g., "health.pharma.brand")
 * @param type - "branded" or "nonBranded"
 * @returns Array of unique templates from all ancestor levels
 */
export function resolveTemplates(
  industrySlug: string,
  type: 'branded' | 'nonBranded'
): string[] {
  const ancestors = getAncestorSlugs(industrySlug);
  const templates: string[] = [];
  
  // Collect templates from most specific to least specific
  for (const ancestor of ancestors) {
    const templateSet = PROMPT_TEMPLATES_V2[ancestor];
    if (templateSet && templateSet[type]) {
      templates.push(...templateSet[type]);
    }
  }
  
  // Fallback to generic_consumer if no templates found
  if (templates.length === 0) {
    const fallback = PROMPT_TEMPLATES_V2['generic_consumer'];
    if (fallback && fallback[type]) {
      templates.push(...fallback[type]);
    }
  }
  
  // De-duplicate (keep first occurrence)
  const unique = [...new Set(templates)];
  
  return unique;
}

/**
 * Check if a generated query is appropriate for the industry
 * Uses keywords and anti-keywords from taxonomy
 */
export function isAppropriateForIndustry(
  query: string,
  industrySlug: string
): boolean {
  const taxonomy = INDUSTRY_TAXONOMY_V2[industrySlug];
  if (!taxonomy) return true; // If no taxonomy, allow all
  
  const lower = query.toLowerCase();
  
  // Check anti-keywords (reject if present)
  if (taxonomy.antiKeywords && taxonomy.antiKeywords.length > 0) {
    for (const antiKeyword of taxonomy.antiKeywords) {
      if (lower.includes(antiKeyword.toLowerCase())) {
        console.log(`[TAXONOMY_FILTER] Rejected "${query}" - contains anti-keyword "${antiKeyword}" for ${industrySlug}`);
        return false;
      }
    }
  }
  
  // If keywords are defined, require at least one match
  // (Skip this check for generic industries)
  if (taxonomy.keywords && taxonomy.keywords.length > 0 && !industrySlug.includes('generic')) {
    const hasKeyword = taxonomy.keywords.some(kw => 
      lower.includes(kw.toLowerCase())
    );
    if (!hasKeyword) {
      console.log(`[TAXONOMY_FILTER] Rejected "${query}" - missing required keywords for ${industrySlug}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Get all templates for an industry with metadata
 */
export function getTemplatesWithMetadata(industrySlug: string): {
  slug: string;
  name: string;
  branded: string[];
  nonBranded: string[];
  ancestors: string[];
  total: number;
} {
  const taxonomy = INDUSTRY_TAXONOMY_V2[industrySlug];
  const ancestors = getAncestorSlugs(industrySlug);
  const branded = resolveTemplates(industrySlug, 'branded');
  const nonBranded = resolveTemplates(industrySlug, 'nonBranded');
  
  return {
    slug: industrySlug,
    name: taxonomy?.name || industrySlug,
    branded,
    nonBranded,
    ancestors,
    total: branded.length + nonBranded.length
  };
}

