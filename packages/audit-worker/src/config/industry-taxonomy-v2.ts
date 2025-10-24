/**
 * Hierarchical Industry Taxonomy V2
 * 
 * Uses dot-slug notation for granular classification:
 * - Top-level: `automotive`, `health`, `software`, etc.
 * - Sub-level: `automotive.oem`, `health.pharma.brand`, etc.
 * 
 * Enables cascading template resolution:
 * - health.pharma.brand → health.pharma.* → health.* → default
 */

export interface IndustryNode {
  slug: string;
  name: string;
  parent?: string;
  aliases?: string[];
  keywords?: string[];
  antiKeywords?: string[];
  schemaTypes?: string[];
  navPatterns?: string[];
  queryTypes?: string[];
  enabled: boolean;
}

/**
 * Full hierarchical taxonomy
 * Organized by top-level vertical for easy navigation
 */
export const INDUSTRY_TAXONOMY_V2: Record<string, IndustryNode> = {
  // ==================== AUTOMOTIVE & MOBILITY ====================
  'automotive': {
    slug: 'automotive',
    name: 'Automotive & Mobility',
    enabled: true,
    keywords: ['car', 'vehicle', 'auto', 'automotive'],
    antiKeywords: []
  },
  'automotive.oem': {
    slug: 'automotive.oem',
    name: 'Automotive OEM',
    parent: 'automotive',
    enabled: true,
    keywords: ['manufacturer', 'new car', 'model', 'trim', 'configure'],
    schemaTypes: ['Car', 'Vehicle'],
    navPatterns: ['/models', '/inventory', '/dealers', '/build-and-price'],
    queryTypes: ['features', 'pricing', 'comparison', 'mpg', 'safety', 'warranty']
  },
  'automotive.dealer': {
    slug: 'automotive.dealer',
    name: 'Auto Dealers',
    parent: 'automotive',
    enabled: true,
    keywords: ['dealership', 'used cars', 'certified pre-owned', 'trade-in'],
    navPatterns: ['/inventory', '/specials', '/financing', '/service'],
    queryTypes: ['inventory', 'test drive', 'financing', 'trade-in value']
  },
  'automotive.marketplace': {
    slug: 'automotive.marketplace',
    name: 'Auto Marketplaces & Classifieds',
    parent: 'automotive',
    enabled: true,
    keywords: ['car listings', 'auto classifieds', 'private sale'],
    queryTypes: ['listings', 'price comparison', 'seller reviews', 'vehicle history']
  },
  'automotive.aftermarket': {
    slug: 'automotive.aftermarket',
    name: 'Parts & Accessories',
    parent: 'automotive',
    enabled: true,
    keywords: ['parts', 'accessories', 'tires', 'oil', 'filters'],
    queryTypes: ['part compatibility', 'installation', 'price', 'reviews']
  },
  'automotive.services.repair': {
    slug: 'automotive.services.repair',
    name: 'Auto Repair / Service',
    parent: 'automotive',
    enabled: true,
    keywords: ['repair', 'service', 'maintenance', 'oil change', 'brake'],
    queryTypes: ['service cost', 'appointment', 'warranty', 'location']
  },
  'automotive.rental': {
    slug: 'automotive.rental',
    name: 'Car Rental & Carshare',
    parent: 'automotive',
    enabled: true,
    keywords: ['car rental', 'rent a car', 'carshare', 'hourly rental'],
    queryTypes: ['rental rates', 'locations', 'insurance', 'loyalty program']
  },
  'automotive.ev': {
    slug: 'automotive.ev',
    name: 'Electric Vehicles',
    parent: 'automotive',
    enabled: true,
    keywords: ['electric vehicle', 'EV', 'battery', 'range', 'charging'],
    queryTypes: ['range', 'charging time', 'incentives', 'cost to own']
  },
  'automotive.ev.charging': {
    slug: 'automotive.ev.charging',
    name: 'EV Charging Networks',
    parent: 'automotive.ev',
    enabled: true,
    keywords: ['charging station', 'supercharger', 'fast charging'],
    queryTypes: ['charging locations', 'pricing', 'compatibility', 'membership']
  },
  
  // ==================== TRAVEL, HOSPITALITY & TOURISM ====================
  'travel': {
    slug: 'travel',
    name: 'Travel, Hospitality & Tourism',
    enabled: true,
    keywords: ['travel', 'vacation', 'trip', 'booking'],
    antiKeywords: []
  },
  'travel.air': {
    slug: 'travel.air',
    name: 'Airlines',
    parent: 'travel',
    enabled: true,
    keywords: ['airline', 'flight', 'booking', 'baggage', 'check-in'],
    schemaTypes: ['Airline', 'Flight'],
    navPatterns: ['/book', '/check-in', '/manage-trip', '/baggage', '/status'],
    queryTypes: ['flight status', 'baggage fees', 'change flight', 'loyalty program', 'seat selection']
  },
  'travel.hotels': {
    slug: 'travel.hotels',
    name: 'Hotels & Resorts',
    parent: 'travel',
    enabled: true,
    keywords: ['hotel', 'resort', 'accommodation', 'rooms', 'stay'],
    schemaTypes: ['Hotel', 'Resort', 'LodgingBusiness'],
    navPatterns: ['/rooms', '/book', '/amenities', '/locations', '/loyalty'],
    queryTypes: ['room rates', 'amenities', 'cancellation policy', 'loyalty points', 'location']
  },
  'travel.cruise': {
    slug: 'travel.cruise',
    name: 'Cruise Lines',
    parent: 'travel',
    enabled: true,
    keywords: ['cruise', 'ship', 'itinerary', 'ports', 'sail'],
    queryTypes: ['itinerary', 'cabins', 'dining', 'shore excursions', 'pricing']
  },
  'travel.otasearch': {
    slug: 'travel.otasearch',
    name: 'OTAs & Metasearch',
    parent: 'travel',
    enabled: true,
    aliases: ['travel_booking'],
    keywords: ['book', 'search flights', 'hotel deals', 'package'],
    queryTypes: ['price comparison', 'deals', 'bundle savings', 'refund policy']
  },
  'travel.vacation_rentals': {
    slug: 'travel.vacation_rentals',
    name: 'Vacation Rentals',
    parent: 'travel',
    enabled: true,
    keywords: ['vacation rental', 'vrbo', 'airbnb', 'rental property'],
    queryTypes: ['property amenities', 'host reviews', 'cancellation', 'cleaning fees']
  },
  'travel.destinations.dmo': {
    slug: 'travel.destinations.dmo',
    name: 'Destination Marketing Orgs',
    parent: 'travel',
    enabled: true,
    aliases: ['tourism'],
    keywords: ['visit', 'tourism', 'destination', 'things to do'],
    queryTypes: ['attractions', 'events', 'itineraries', 'visitor guide']
  },
  'travel.parks.theme': {
    slug: 'travel.parks.theme',
    name: 'Theme Parks & Attractions',
    parent: 'travel',
    enabled: true,
    keywords: ['theme park', 'amusement park', 'attractions', 'rides'],
    queryTypes: ['tickets', 'hours', 'ride wait times', 'dining options']
  },
  
  // ==================== RETAIL & ECOMMERCE ====================
  'retail': {
    slug: 'retail',
    name: 'Retail & Ecommerce',
    enabled: true,
    keywords: ['store', 'shop', 'buy', 'products', 'retail'],
    antiKeywords: []
  },
  'retail.grocery': {
    slug: 'retail.grocery',
    name: 'Grocery',
    parent: 'retail',
    enabled: true,
    keywords: ['grocery', 'supermarket', 'food', 'produce'],
    queryTypes: ['store hours', 'weekly ad', 'delivery', 'coupons']
  },
  'retail.mass_merch': {
    slug: 'retail.mass_merch',
    name: 'Mass Merch / Big Box',
    parent: 'retail',
    enabled: true,
    keywords: ['department store', 'big box', 'general merchandise'],
    queryTypes: ['store locations', 'deals', 'price match', 'return policy']
  },
  'retail.apparel.general': {
    slug: 'retail.apparel.general',
    name: 'Apparel (General)',
    parent: 'retail',
    enabled: true,
    keywords: ['clothing', 'apparel', 'fashion', 'wear'],
    queryTypes: ['sizing', 'styles', 'returns', 'shipping']
  },
  'retail.apparel.luxury': {
    slug: 'retail.apparel.luxury',
    name: 'Luxury Fashion',
    parent: 'retail',
    enabled: true,
    keywords: ['luxury', 'designer', 'high-end', 'couture'],
    queryTypes: ['authenticity', 'personalization', 'concierge', 'limited editions']
  },
  'retail.beauty': {
    slug: 'retail.beauty',
    name: 'Beauty & Cosmetics',
    parent: 'retail',
    enabled: true,
    keywords: ['beauty', 'cosmetics', 'makeup', 'skincare'],
    queryTypes: ['product reviews', 'ingredients', 'rewards program', 'tutorials']
  },
  'retail.electronics': {
    slug: 'retail.electronics',
    name: 'Consumer Electronics',
    parent: 'retail',
    enabled: true,
    keywords: ['electronics', 'tech', 'gadgets', 'appliances'],
    queryTypes: ['specs', 'compatibility', 'warranty', 'geek squad', 'installation']
  },
  'retail.home_improvement': {
    slug: 'retail.home_improvement',
    name: 'Home Improvement / DIY',
    parent: 'retail',
    enabled: true,
    keywords: ['home improvement', 'diy', 'tools', 'hardware'],
    queryTypes: ['project ideas', 'how-to', 'contractor services', 'store hours']
  },
  'retail.pharmacy': {
    slug: 'retail.pharmacy',
    name: 'Pharmacy / Drugstore',
    parent: 'retail',
    enabled: true,
    aliases: ['pharmacy'],
    keywords: ['pharmacy', 'prescriptions', 'drugstore', 'medications'],
    queryTypes: ['prescription refill', 'pharmacy hours', 'insurance', 'immunizations']
  },
  'retail.wholesale_club': {
    slug: 'retail.wholesale_club',
    name: 'Warehouse Clubs',
    parent: 'retail',
    enabled: true,
    keywords: ['warehouse', 'wholesale', 'membership', 'bulk'],
    queryTypes: ['membership cost', 'locations', 'gas prices', 'exclusive deals']
  },
  'retail.pets': {
    slug: 'retail.pets',
    name: 'Pet Stores',
    parent: 'retail',
    enabled: true,
    keywords: ['pet', 'pet food', 'pet supplies'],
    queryTypes: ['pet products', 'grooming', 'vet services', 'training']
  },
  'retail.marketplace.horizontal': {
    slug: 'retail.marketplace.horizontal',
    name: 'Horizontal Marketplaces',
    parent: 'retail',
    enabled: true,
    aliases: ['ecommerce'],
    keywords: ['marketplace', 'online shopping', 'everything store'],
    queryTypes: ['shipping', 'returns', 'prime', 'seller ratings']
  },
  'retail.dtc': {
    slug: 'retail.dtc',
    name: 'Direct-to-Consumer Brands',
    parent: 'retail',
    enabled: true,
    keywords: ['direct to consumer', 'dtc', 'brand'],
    queryTypes: ['brand story', 'sustainability', 'returns', 'sizing']
  },
  
  // ==================== FOOD & BEVERAGE ====================
  'food_restaurant': {
    slug: 'food_restaurant',
    name: 'Food & Beverage',
    enabled: true,
    aliases: ['restaurants'],
    keywords: ['restaurant', 'food', 'dining', 'menu'],
    antiKeywords: []
  },
  'food_restaurant.qsr': {
    slug: 'food_restaurant.qsr',
    name: 'Quick-Service Restaurants',
    parent: 'food_restaurant',
    enabled: true,
    keywords: ['fast food', 'quick service', 'drive-thru'],
    queryTypes: ['menu', 'nutrition', 'locations', 'mobile order', 'deals']
  },
  'food_restaurant.fast_casual': {
    slug: 'food_restaurant.fast_casual',
    name: 'Fast Casual',
    parent: 'food_restaurant',
    enabled: true,
    keywords: ['fast casual', 'counter service', 'fresh ingredients'],
    queryTypes: ['menu', 'catering', 'delivery', 'rewards']
  },
  'food_restaurant.casual': {
    slug: 'food_restaurant.casual',
    name: 'Casual Dining',
    parent: 'food_restaurant',
    enabled: true,
    keywords: ['casual dining', 'full service', 'family restaurant'],
    queryTypes: ['menu', 'reservations', 'happy hour', 'takeout']
  },
  'food_restaurant.fine_dining': {
    slug: 'food_restaurant.fine_dining',
    name: 'Fine Dining',
    parent: 'food_restaurant',
    enabled: true,
    keywords: ['fine dining', 'upscale', 'chef', 'tasting menu'],
    queryTypes: ['reservations', 'dress code', 'wine list', 'private dining']
  },
  
  // ==================== FINANCIAL SERVICES ====================
  'finance': {
    slug: 'finance',
    name: 'Financial Services',
    enabled: true,
    aliases: ['financial_services'],
    keywords: ['bank', 'finance', 'money', 'financial'],
    antiKeywords: []
  },
  'finance.bank': {
    slug: 'finance.bank',
    name: 'Banks',
    parent: 'finance',
    enabled: true,
    keywords: ['bank', 'checking', 'savings', 'account'],
    schemaTypes: ['Bank', 'FinancialService'],
    navPatterns: ['/checking', '/savings', '/loans', '/online-banking'],
    queryTypes: ['interest rates', 'fees', 'branch hours', 'online banking', 'overdraft protection']
  },
  'finance.credit_union': {
    slug: 'finance.credit_union',
    name: 'Credit Unions',
    parent: 'finance',
    enabled: true,
    keywords: ['credit union', 'membership', 'cooperative'],
    queryTypes: ['membership eligibility', 'rates', 'shared branching']
  },
  'finance.lending.mortgage': {
    slug: 'finance.lending.mortgage',
    name: 'Mortgage Lenders',
    parent: 'finance',
    enabled: true,
    keywords: ['mortgage', 'home loan', 'refinance', 'pre-approval'],
    queryTypes: ['mortgage rates', 'pre-approval', 'refinance savings', 'closing costs']
  },
  'finance.lending.auto': {
    slug: 'finance.lending.auto',
    name: 'Auto Lending',
    parent: 'finance',
    enabled: true,
    keywords: ['auto loan', 'car financing', 'lease'],
    queryTypes: ['auto loan rates', 'pre-qualification', 'payment calculator']
  },
  'finance.lending.personal': {
    slug: 'finance.lending.personal',
    name: 'Personal Loans',
    parent: 'finance',
    enabled: true,
    keywords: ['personal loan', 'debt consolidation', 'loan'],
    queryTypes: ['loan rates', 'eligibility', 'fast funding', 'credit score required']
  },
  'finance.insurance.p_and_c': {
    slug: 'finance.insurance.p_and_c',
    name: 'Insurance: P&C',
    parent: 'finance',
    enabled: true,
    keywords: ['auto insurance', 'home insurance', 'property', 'casualty'],
    queryTypes: ['quote', 'coverage options', 'claims', 'discounts']
  },
  'finance.insurance.life': {
    slug: 'finance.insurance.life',
    name: 'Insurance: Life',
    parent: 'finance',
    enabled: true,
    keywords: ['life insurance', 'term life', 'whole life'],
    queryTypes: ['life insurance types', 'coverage amount', 'rates', 'beneficiaries']
  },
  'finance.credit_cards': {
    slug: 'finance.credit_cards',
    name: 'Credit Cards / Issuers',
    parent: 'finance',
    enabled: true,
    keywords: ['credit card', 'rewards', 'cash back', 'apr'],
    queryTypes: ['rewards program', 'apr', 'annual fee', 'credit limit', 'balance transfer']
  },
  'finance.brokerage.trading': {
    slug: 'finance.brokerage.trading',
    name: 'Brokerages / Trading',
    parent: 'finance',
    enabled: true,
    keywords: ['brokerage', 'trading', 'stocks', 'investing'],
    queryTypes: ['commission fees', 'account types', 'research tools', 'mobile app']
  },
  
  // ==================== HEALTHCARE & LIFE SCIENCES ====================
  'health': {
    slug: 'health',
    name: 'Healthcare & Life Sciences',
    enabled: true,
    aliases: ['healthcare_provider', 'healthcare'],
    keywords: ['health', 'medical', 'healthcare', 'patient'],
    antiKeywords: []
  },
  'health.providers': {
    slug: 'health.providers',
    name: 'Health Systems & Providers',
    parent: 'health',
    enabled: true,
    keywords: ['hospital', 'clinic', 'medical center', 'health system'],
    schemaTypes: ['Hospital', 'MedicalClinic', 'Physician'],
    navPatterns: ['/find-a-doctor', '/services', '/locations', '/patient-portal', '/billing'],
    queryTypes: ['find a doctor', 'services', 'insurance accepted', 'patient portal', 'appointment'],
    antiKeywords: ['prescription', 'drug', 'medication', 'vaccine', 'pharmaceutical']
  },
  'health.providers.urgent_care': {
    slug: 'health.providers.urgent_care',
    name: 'Urgent Care',
    parent: 'health.providers',
    enabled: true,
    keywords: ['urgent care', 'walk-in clinic', 'after hours'],
    queryTypes: ['hours', 'wait times', 'services', 'insurance', 'location']
  },
  'health.telehealth': {
    slug: 'health.telehealth',
    name: 'Telehealth',
    parent: 'health',
    enabled: true,
    keywords: ['telehealth', 'telemedicine', 'virtual visit', 'online doctor'],
    queryTypes: ['how it works', 'pricing', 'insurance', 'conditions treated', 'prescription']
  },
  'health.mental_behavioral': {
    slug: 'health.mental_behavioral',
    name: 'Mental & Behavioral Health',
    parent: 'health',
    enabled: true,
    keywords: ['mental health', 'therapy', 'counseling', 'psychiatry'],
    queryTypes: ['find a therapist', 'insurance', 'first appointment', 'crisis help']
  },
  'health.pharmacy': {
    slug: 'health.pharmacy',
    name: 'Pharmacies',
    parent: 'health',
    enabled: true,
    keywords: ['pharmacy', 'prescriptions', 'rx', 'medications'],
    queryTypes: ['prescription transfer', 'refill', 'drug info', 'delivery', 'insurance']
  },
  'health.payers': {
    slug: 'health.payers',
    name: 'Health Plans / Payers',
    parent: 'health',
    enabled: true,
    aliases: ['health_insurance'],
    keywords: ['health insurance', 'health plan', 'coverage', 'payer'],
    queryTypes: ['plan options', 'find a doctor', 'claims', 'benefits', 'enrollment']
  },
  'health.dental': {
    slug: 'health.dental',
    name: 'Dental',
    parent: 'health',
    enabled: true,
    keywords: ['dental', 'dentist', 'orthodontics', 'teeth'],
    queryTypes: ['services', 'insurance', 'appointment', 'emergency dental']
  },
  'health.pharma.brand': {
    slug: 'health.pharma.brand',
    name: 'Pharma (Brand Sites)',
    parent: 'health',
    enabled: true,
    aliases: ['pharmaceutical'],
    keywords: ['prescription', 'drug', 'medication', 'vaccine', 'pharmaceutical', 'fda approved', 'clinical trial'],
    schemaTypes: ['Drug', 'MedicalTherapy'],
    navPatterns: ['/products', '/pipeline', '/patient-resources', '/hcp', '/clinical-trials'],
    queryTypes: ['drug information', 'side effects', 'dosage', 'patient assistance', 'efficacy'],
    antiKeywords: ['hospital', 'clinic', 'appointment', 'doctor', 'emergency room', 'patient portal']
  },
  'health.med_devices': {
    slug: 'health.med_devices',
    name: 'Medical Devices',
    parent: 'health',
    enabled: true,
    aliases: ['medical_devices'],
    keywords: ['medical device', 'diagnostic', 'imaging', 'equipment'],
    queryTypes: ['product specs', 'clinical evidence', 'ordering', 'support']
  },
  'health.biotech': {
    slug: 'health.biotech',
    name: 'Biotechnology',
    parent: 'health',
    enabled: true,
    keywords: ['biotech', 'biologics', 'gene therapy', 'cell therapy'],
    queryTypes: ['pipeline', 'clinical trials', 'investors', 'partnerships']
  },
  
  // ==================== REAL ESTATE & HOUSING ====================
  'real_estate': {
    slug: 'real_estate',
    name: 'Real Estate & Housing',
    enabled: true,
    keywords: ['real estate', 'property', 'home', 'housing'],
    antiKeywords: []
  },
  'real_estate.residential.broker': {
    slug: 'real_estate.residential.broker',
    name: 'Residential Brokerage',
    parent: 'real_estate',
    enabled: true,
    keywords: ['home search', 'mls', 'agent', 'buy a home', 'sell a home'],
    queryTypes: ['home search', 'find an agent', 'home value', 'market trends']
  },
  'real_estate.new_home_builders': {
    slug: 'real_estate.new_home_builders',
    name: 'Home Builders',
    parent: 'real_estate',
    enabled: true,
    keywords: ['new homes', 'builder', 'construction', 'floor plans'],
    queryTypes: ['communities', 'floor plans', 'pricing', 'design center']
  },
  
  // ==================== EDUCATION ====================
  'education': {
    slug: 'education',
    name: 'Education',
    enabled: true,
    aliases: ['university'],
    keywords: ['education', 'school', 'learning', 'university', 'college'],
    antiKeywords: []
  },
  'education.higher.public': {
    slug: 'education.higher.public',
    name: 'Universities (Public)',
    parent: 'education',
    enabled: true,
    keywords: ['university', 'college', 'higher education', 'public university'],
    schemaTypes: ['CollegeOrUniversity', 'EducationalOrganization'],
    navPatterns: ['/admissions', '/academics', '/tuition', '/financial-aid', '/campus-life'],
    queryTypes: ['admissions', 'tuition', 'programs', 'financial aid', 'campus life']
  },
  'education.higher.private': {
    slug: 'education.higher.private',
    name: 'Universities (Private)',
    parent: 'education',
    enabled: true,
    keywords: ['university', 'college', 'higher education', 'private university'],
    queryTypes: ['admissions', 'tuition', 'programs', 'scholarships', 'campus tour']
  },
  'education.community_college': {
    slug: 'education.community_college',
    name: 'Community Colleges',
    parent: 'education',
    enabled: true,
    keywords: ['community college', 'associate degree', 'certificate'],
    queryTypes: ['programs', 'tuition', 'enrollment', 'transfer pathways']
  },
  'education.bootcamps': {
    slug: 'education.bootcamps',
    name: 'Bootcamps',
    parent: 'education',
    enabled: true,
    keywords: ['bootcamp', 'coding bootcamp', 'intensive training'],
    queryTypes: ['cost', 'outcomes', 'curriculum', 'job guarantee']
  },
  
  // ==================== PROFESSIONAL & BUSINESS SERVICES ====================
  'professional': {
    slug: 'professional',
    name: 'Professional & Business Services',
    enabled: true,
    aliases: ['consulting'],
    keywords: ['professional services', 'consulting', 'business services'],
    antiKeywords: []
  },
  'professional.consulting.mgmt': {
    slug: 'professional.consulting.mgmt',
    name: 'Management Consulting',
    parent: 'professional',
    enabled: true,
    keywords: ['management consulting', 'strategy', 'transformation'],
    queryTypes: ['services', 'industries', 'case studies', 'careers']
  },
  'professional.legal': {
    slug: 'professional.legal',
    name: 'Legal Services / Law Firms',
    parent: 'professional',
    enabled: true,
    keywords: ['law firm', 'attorney', 'legal services', 'lawyer'],
    queryTypes: ['practice areas', 'find a lawyer', 'consultation', 'case results']
  },
  
  // ==================== SOFTWARE, SAAS & CLOUD ====================
  'software': {
    slug: 'software',
    name: 'Software, SaaS & Cloud',
    enabled: true,
    aliases: ['saas_b2b'],
    keywords: ['software', 'saas', 'cloud', 'platform', 'api'],
    antiKeywords: []
  },
  'software.saas': {
    slug: 'software.saas',
    name: 'SaaS (General B2B)',
    parent: 'software',
    enabled: true,
    keywords: ['saas', 'software as a service', 'cloud software', 'subscription'],
    schemaTypes: ['SoftwareApplication', 'WebApplication'],
    navPatterns: ['/pricing', '/features', '/demo', '/integrations', '/customers', '/docs'],
    queryTypes: ['pricing', 'features', 'integrations', 'free trial', 'api', 'security']
  },
  'software.devtools': {
    slug: 'software.devtools',
    name: 'Developer Tools',
    parent: 'software',
    enabled: true,
    keywords: ['developer tools', 'devtools', 'ide', 'ci/cd', 'version control'],
    queryTypes: ['documentation', 'pricing', 'integrations', 'cli', 'api']
  },
  'software.analytics_bi': {
    slug: 'software.analytics_bi',
    name: 'Analytics & BI',
    parent: 'software',
    enabled: true,
    keywords: ['analytics', 'business intelligence', 'bi', 'data visualization'],
    queryTypes: ['data sources', 'visualizations', 'sharing', 'pricing']
  },
  'software.cdp_crm': {
    slug: 'software.cdp_crm',
    name: 'CDP & CRM',
    parent: 'software',
    enabled: true,
    keywords: ['crm', 'customer data', 'cdp', 'sales automation'],
    queryTypes: ['features', 'integrations', 'pricing', 'migration']
  },
  'software.security': {
    slug: 'software.security',
    name: 'Cybersecurity',
    parent: 'software',
    enabled: true,
    keywords: ['cybersecurity', 'security', 'threat', 'vulnerability'],
    queryTypes: ['threat detection', 'compliance', 'deployment', 'soc']
  },
  
  // ==================== MEDIA, ENTERTAINMENT & SPORTS ====================
  'media': {
    slug: 'media',
    name: 'Media, Entertainment & Sports',
    enabled: true,
    aliases: ['streaming', 'social_media'],
    keywords: ['media', 'entertainment', 'content', 'streaming'],
    antiKeywords: []
  },
  'media.streaming.video': {
    slug: 'media.streaming.video',
    name: 'Streaming Video',
    parent: 'media',
    enabled: true,
    keywords: ['streaming', 'video', 'tv shows', 'movies', 'watch'],
    queryTypes: ['subscription plans', 'content library', 'devices', 'download', 'profiles']
  },
  'media.streaming.music': {
    slug: 'media.streaming.music',
    name: 'Music Streaming',
    parent: 'media',
    enabled: true,
    keywords: ['music streaming', 'spotify', 'playlist', 'podcast'],
    queryTypes: ['subscription plans', 'music library', 'podcasts', 'offline listening']
  },
  'media.social': {
    slug: 'media.social',
    name: 'Social Media',
    parent: 'media',
    enabled: true,
    keywords: ['social media', 'social network', 'feed', 'post'],
    queryTypes: ['create account', 'privacy settings', 'content policy', 'ads']
  },
  
  // ==================== TELECOMMUNICATIONS & CONNECTIVITY ====================
  'telecom': {
    slug: 'telecom',
    name: 'Telecommunications & Connectivity',
    enabled: true,
    keywords: ['telecom', 'wireless', 'internet', 'broadband', 'mobile'],
    antiKeywords: []
  },
  'telecom.wireless': {
    slug: 'telecom.wireless',
    name: 'Wireless Carriers',
    parent: 'telecom',
    enabled: true,
    keywords: ['wireless', 'mobile', 'cell phone', 'carrier', 'plan'],
    queryTypes: ['plans', 'coverage', 'bring your device', 'deals', 'data usage']
  },
  'telecom.isp_broadband': {
    slug: 'telecom.isp_broadband',
    name: 'ISPs / Broadband',
    parent: 'telecom',
    enabled: true,
    keywords: ['internet', 'broadband', 'isp', 'fiber', 'cable'],
    queryTypes: ['plans', 'speed', 'availability', 'installation', 'equipment']
  },
  
  // ==================== CONSUMER SERVICES & LIFESTYLE ====================
  'consumer': {
    slug: 'consumer',
    name: 'Consumer Services & Lifestyle',
    enabled: true,
    keywords: ['consumer services', 'lifestyle', 'personal'],
    antiKeywords: []
  },
  'consumer.fitness_gyms': {
    slug: 'consumer.fitness_gyms',
    name: 'Gyms & Studios',
    parent: 'consumer',
    enabled: true,
    keywords: ['gym', 'fitness', 'workout', 'personal training'],
    queryTypes: ['membership', 'classes', 'locations', 'equipment', 'amenities']
  },
  'consumer.wellness': {
    slug: 'consumer.wellness',
    name: 'Wellness & Mindfulness',
    parent: 'consumer',
    enabled: true,
    keywords: ['wellness', 'meditation', 'mindfulness', 'spa'],
    queryTypes: ['services', 'pricing', 'membership', 'appointments']
  },
  
  // ==================== GOVERNMENT & PUBLIC SECTOR ====================
  'government': {
    slug: 'government',
    name: 'Government & Public Sector',
    enabled: true,
    keywords: ['government', 'agency', 'public', 'federal', 'state', 'city'],
    antiKeywords: []
  },
  'government.federal': {
    slug: 'government.federal',
    name: 'Federal Agencies',
    parent: 'government',
    enabled: true,
    keywords: ['federal', 'agency', '.gov'],
    queryTypes: ['services', 'forms', 'contact', 'resources']
  },
  
  // ==================== MISC / FALLBACKS ====================
  'generic_consumer': {
    slug: 'generic_consumer',
    name: 'Generic Consumer',
    enabled: true,
    keywords: [],
    antiKeywords: []
  },
  'generic_b2b': {
    slug: 'generic_b2b',
    name: 'Generic B2B',
    enabled: true,
    keywords: [],
    antiKeywords: []
  },
  'unknown': {
    slug: 'unknown',
    name: 'Unknown / Unclassified',
    enabled: true,
    keywords: [],
    antiKeywords: []
  }
};

/**
 * Get parent slug from a hierarchical slug
 * E.g., "health.pharma.brand" → "health.pharma"
 */
export function getParentSlug(slug: string): string | null {
  const parts = slug.split('.');
  if (parts.length === 1) return null; // Top-level
  return parts.slice(0, -1).join('.');
}

/**
 * Get all ancestors of a slug (for cascading template resolution)
 * E.g., "health.pharma.brand" → ["health.pharma.brand", "health.pharma", "health"]
 */
export function getAncestorSlugs(slug: string): string[] {
  const parts = slug.split('.');
  const ancestors: string[] = [];
  for (let i = parts.length; i > 0; i--) {
    ancestors.push(parts.slice(0, i).join('.'));
  }
  return ancestors;
}

/**
 * Resolve a legacy flat industry to new hierarchical slug
 */
export function mapLegacyToV2(legacyIndustry: string): string {
  const legacyMap: Record<string, string> = {
    'automotive_oem': 'automotive.oem',
    'travel_air': 'travel.air',
    'travel_hotels': 'travel.hotels',
    'travel_cruise': 'travel.cruise',
    'travel_booking': 'travel.otasearch',
    'vacation_rentals': 'travel.vacation_rentals',
    'retail': 'retail.mass_merch',
    'ecommerce': 'retail.marketplace.horizontal',
    'restaurants': 'food_restaurant.qsr',
    'financial_services': 'finance.bank',
    'healthcare_provider': 'health.providers',
    'pharmaceutical': 'health.pharma.brand',
    'pharmacy': 'health.pharmacy',
    'university': 'education.higher.public',
    'consulting': 'professional.consulting.mgmt',
    'saas_b2b': 'software.saas',
    'streaming': 'media.streaming.video',
    'social_media': 'media.social',
    'telecom': 'telecom.wireless',
    'generic_consumer': 'generic_consumer',
    'unknown': 'unknown'
  };
  
  return legacyMap[legacyIndustry] || 'unknown';
}

