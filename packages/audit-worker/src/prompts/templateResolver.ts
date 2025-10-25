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
      'What are the side effects of {brand} {product}?',
      'Is {brand} {product} right for me?',
      '{brand} {product} vs {competitor}',
      'How effective is {brand} {product}?',
      'Does {brand} offer patient assistance programs?',
      '{brand} {product} dosage and administration',
      'What conditions does {brand} {product} treat?',
      '{brand} {product} FDA approval status',
      'How do I get a prescription for {brand} {product}?',
      '{brand} clinical trial results',
      '{brand} drug interactions and warnings'
    ],
    nonBranded: [
      'What are the best treatments for {condition}?',
      'Comparing prescription medications for {condition}',
      'Side effects of {drug_class} medications',
      'Patient assistance programs for expensive medications',
      'FDA drug approval process',
      'Understanding prescription drug labels'
    ]
  },
  
  // ==================== HEALTH.PROVIDERS (Child) ====================
  'health.providers': {
    branded: [
      'How do I find a doctor at {brand}?',
      'Does {brand} accept {insurance}?',
      '{brand} emergency room wait times',
      'How to schedule an appointment at {brand}',
      '{brand} patient portal login',
      'What specialties does {brand} offer?',
      '{brand} vs {competitor} for {procedure}',
      '{brand} hospital reviews and ratings',
      '{brand} billing and payment options',
      'Does {brand} have urgent care?'
    ],
    nonBranded: [
      'Best hospitals for {procedure}',
      'How to find a specialist for {condition}',
      'What to expect at urgent care',
      'Hospital patient rights and billing',
      'How to choose a primary care doctor',
      'Emergency room vs urgent care'
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
      '{brand} integrations and API',
      '{brand} security and compliance',
      '{brand} implementation timeline',
      '{brand} data migration',
      '{brand} uptime and reliability',
      'How to get started with {brand}',
      '{brand} training and onboarding',
      '{brand} ROI and business case'
    ],
    nonBranded: [
      'SaaS vs on-premise software',
      'How to evaluate SaaS vendors',
      'SaaS pricing models explained',
      'SaaS security best practices'
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
      '{brand} {model} specs and features',
      '{brand} {model} mpg and fuel economy',
      '{brand} {model} safety ratings',
      '{brand} {model} vs {competitor_model}',
      '{brand} {model} trim levels and pricing',
      'Configure and price {brand} {model}',
      '{brand} {model} towing capacity',
      'Where to buy {brand} {model}',
      '{brand} certified pre-owned program'
    ],
    nonBranded: [
      'Best SUVs under $40k',
      'Most fuel-efficient sedans',
      'Safest family vehicles',
      'Electric vs hybrid cars comparison'
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
      '{brand} menu and prices',
      '{brand} happy hour specials',
      '{brand} reservations',
      '{brand} takeout and delivery',
      '{brand} rewards program',
      '{brand} kids menu',
      '{brand} near me',
      '{brand} wait times'
    ],
    nonBranded: [
      'Best casual dining restaurants',
      'Family-friendly restaurants',
      'Casual dining deals and coupons',
      'Restaurant reservations tips'
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
  
  // Aliases for common food/beverage classifications
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
      '{brand} checking account',
      '{brand} savings account rates',
      '{brand} credit card rewards',
      '{brand} vs {competitor}',
      '{brand} branch locations',
      '{brand} ATM network',
      '{brand} overdraft fees',
      '{brand} mobile deposit',
      'How to open account with {brand}',
      '{brand} customer service hours'
    ],
    nonBranded: [
      'Best banks for checking accounts',
      'High-yield savings accounts',
      'Online banks vs traditional banks',
      'How to avoid bank fees',
      'Bank account for students',
      'Business banking options'
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
      '{brand} reviews and ratings',
      '{brand} pricing and cost',
      '{brand} vs {competitor}',
      'Is {brand} worth it?',
      'Where to buy {brand}',
      '{brand} customer service',
      '{brand} return policy',
      '{brand} deals and discounts'
    ],
    nonBranded: [
      'Best {category} options',
      'How to choose {category}',
      '{category} buying guide',
      '{category} comparison'
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

