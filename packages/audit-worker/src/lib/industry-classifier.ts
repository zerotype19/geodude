/**
 * AI-Powered Industry Classifier
 * 
 * Combines heuristics, embeddings, and LLM voting to classify domains
 * Works even when homepage returns 403 (uses site_description)
 */

import type { IndustryKey } from '../config/industry-packs.schema';

export interface ClassifyRequest {
  domain: string;
  root_url: string;
  site_description?: string;
  project_id?: string;
  hints?: string[];
  crawl_budget?: {
    homepage?: boolean;
    sitemap?: boolean;
    timeout_ms?: number;
  };
}

export interface ClassifyResponse {
  primary: {
    industry_key: IndustryKey;
    confidence: number;
    source: 'ai_worker';
  };
  alts: Array<{
    industry_key: IndustryKey;
    confidence: number;
  }>;
  evidence: {
    title?: string;
    nav?: string[];
    schema?: string[];
    keywords?: string[];
    domain_signals?: string[];
  };
  model_version: string;
}

interface ExtractedSignals {
  domain: string;
  title?: string;
  metaDescription?: string;
  ogSiteName?: string;
  h1?: string;
  navTerms?: string[];
  schemaTypes?: string[];
  bodyText?: string;
  siteDescription?: string;
}

/**
 * Heuristic patterns for industry detection
 */
const HEURISTICS: Record<IndustryKey, RegExp[]> = {
  automotive_oem: [
    /\b(msrp|vin|dealer|build\s*(&|and)\s*price|configure|inventory|test\s*drive)\b/i,
    /\b(iihs|nhtsa|safety\s*rating|crash\s*test|warranty|towing|payload)\b/i,
    /\b(sedan|suv|truck|pickup|crossover|hybrid|electric\s*vehicle|ev)\b/i,
    /\b(car\s*manufacturer|auto\s*manufacturer|automotive|vehicle|automobile|auto\s*manufacturing)\b/i,
    /\b(chrysler|dodge|jeep|fiat|alfa\s*romeo|peugeot|citroen|opel|vauxhall)\b/i,
  ],
  automotive_dealer: [],
  travel_cruise: [
    /\b(cruise|cruises|river\s*cruise|ocean\s*cruise|expedition|sailing|itinerary|itineraries)\b/i,
    /\b(stateroom|cabin|deck|port|embark|disembark|shore\s*excursion)\b/i,
    /\b(cruise\s*line|cruise\s*ship|vessels|fleet)\b/i,
  ],
  travel_hotels: [
    /\b(hotel|resort|spa|lodge|inn|suites?|rooms?|check[-\s]in|check[-\s]out)\b/i,
    /\b(amenities|concierge|housekeeping|room\s*service|mini[-\s]bar)\b/i,
    /\b(booking|reservation|stay|nights?|guest)\b/i,
  ],
  travel_air: [
    /\b(airline|flight|baggage|fare\s*class|check[-\s]in|boarding|gate)\b/i,
    /\b(destination|route|departure|arrival|layover|connecting)\b/i,
    /\b(frequent\s*flyer|miles|points|rewards\s*program)\b/i,
  ],
  retail: [
    /\b(return\s*policy|free\s*shipping|add\s*to\s*cart|checkout|shopping\s*cart)\b/i,
    /\b(gift\s*card|promo\s*code|discount|sale|clearance|in\s*stock)\b/i,
    /\b(product|sku|inventory|order\s*status|track\s*order)\b/i,
    /\b(computer\s*hardware|software|technology|electronics|iphone|ipad|macbook|laptop)\b/i,
    /\b(smartphone|tablet|consumer\s*electronics|tech\s*company|innovation)\b/i,
  ],
  financial_services: [
    /\b(fdic|apr|apy|routing\s*number|account\s*number|nmls)\b/i,
    /\b(checking|savings|credit\s*card|debit\s*card|mortgage|loan)\b/i,
    /\b(online\s*banking|mobile\s*banking|bill\s*pay|transfer)\b/i,
  ],
  healthcare_provider: [
    /\b(find\s*(a\s*)?doctor|physician|appointment|patient\s*portal)\b/i,
    /\b(medical\s*record|emr|ehr|clinic|hospital|emergency\s*room)\b/i,
    /\b(insurance\s*accepted|medicare|medicaid|copay)\b/i,
  ],
  food_restaurant: [
    /\b(menu|reservation|dine[-\s]in|takeout|delivery|order\s*online)\b/i,
    /\b(restaurant|cafe|bistro|eatery|dining|cuisine)\b/i,
    /\b(chef|culinary|recipe|food\s*service)\b/i,
  ],
  real_estate: [
    /\b(property|listing|homes?\s*for\s*sale|rent|lease|realtor)\b/i,
    /\b(square\s*feet|bedroom|bathroom|mls|open\s*house)\b/i,
    /\b(real\s*estate|property\s*management|landlord|tenant)\b/i,
  ],
  education: [
    /\b(school|university|college|academy|learning|course)\b/i,
    /\b(student|enrollment|tuition|degree|certificate|diploma)\b/i,
    /\b(curriculum|faculty|admission|campus|education)\b/i,
  ],
  professional_services: [
    /\b(consulting|advisory|legal|law\s*firm|attorney|lawyer)\b/i,
    /\b(accounting|tax|audit|cpa|bookkeeping)\b/i,
    /\b(professional\s*service|expertise|consultation)\b/i,
  ],
  saas_b2b: [
    /\b(saas|software\s*as\s*a\s*service|cloud|platform|api)\b/i,
    /\b(enterprise|b2b|business\s*solution|workflow)\b/i,
    /\b(subscription|pricing\s*plan|free\s*trial|demo)\b/i,
  ],
  ecommerce_fashion: [],
  media_entertainment: [
    /\b(streaming|video|music|podcast|broadcast|content)\b/i,
    /\b(movie|film|tv\s*show|series|episode|watch\s*now)\b/i,
    /\b(media|entertainment|news|magazine|blog)\b/i,
  ],
  nonprofit: [
    /\b(donate|donation|charity|nonprofit|non[-\s]profit|foundation)\b/i,
    /\b(volunteer|fundrais|cause|mission|impact)\b/i,
    /\b(501\(c\)|tax[-\s]deductible|giving)\b/i,
  ],
  government: [
    /\b(\.gov|government|federal|state|municipal|county|city)\b/i,
    /\b(agency|department|bureau|administration|commission)\b/i,
    /\b(public\s*service|citizen|permit|license|regulation)\b/i,
  ],
  manufacturing: [
    /\b(manufacturer|factory|production|industrial|supply\s*chain)\b/i,
    /\b(wholesale|distributor|b2b|oem|component)\b/i,
    /\b(manufacturing|fabrication|assembly|machinery)\b/i,
  ],
  generic_consumer: [],
  unknown: [],
};

/**
 * Extract signals from HTML (if available)
 */
async function extractSignalsFromHTML(
  html: string,
  domain: string,
  siteDescription?: string
): Promise<ExtractedSignals> {
  const signals: ExtractedSignals = { domain, siteDescription };

  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch) signals.title = titleMatch[1].trim();

  // Extract meta description
  const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (metaMatch) signals.metaDescription = metaMatch[1].trim();

  // Extract og:site_name
  const ogMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
  if (ogMatch) signals.ogSiteName = ogMatch[1].trim();

  // Extract first H1
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) signals.h1 = h1Match[1].replace(/<[^>]+>/g, '').trim();

  // Extract nav terms (simplified)
  const navMatches = html.match(/<nav[^>]*>(.*?)<\/nav>/is);
  if (navMatches) {
    const navText = navMatches[1].replace(/<[^>]+>/g, ' ');
    signals.navTerms = navText
      .split(/\s+/)
      .filter((w) => w.length > 3 && w.length < 20)
      .slice(0, 20);
  }

  // Extract JSON-LD schema types
  const schemaMatches = html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  const schemaTypes = new Set<string>();
  for (const match of schemaMatches) {
    try {
      const json = JSON.parse(match[1]);
      if (json['@type']) {
        const types = Array.isArray(json['@type']) ? json['@type'] : [json['@type']];
        types.forEach((t: string) => schemaTypes.add(t));
      }
    } catch {}
  }
  signals.schemaTypes = Array.from(schemaTypes);

  // Extract body text (first 2000 chars)
  const bodyMatch = html.match(/<body[^>]*>(.*?)<\/body>/is);
  if (bodyMatch) {
    signals.bodyText = bodyMatch[1]
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000);
  }

  return signals;
}

/**
 * Fetch homepage HTML with timeout
 */
async function fetchHomepage(
  url: string,
  timeoutMs: number = 5000
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OptiviewAuditBot/1.0 (+https://optiview.ai/bot; admin@optiview.ai)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    return null;
  }
}

/**
 * Score signals against heuristic patterns
 */
function scoreHeuristics(signals: ExtractedSignals): Map<IndustryKey, number> {
  const scores = new Map<IndustryKey, number>();

  // Combine all text for pattern matching
  const allText = [
    signals.domain,
    signals.title,
    signals.metaDescription,
    signals.ogSiteName,
    signals.h1,
    signals.siteDescription,
    signals.bodyText,
    ...(signals.navTerms || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Test each industry's patterns
  for (const [industry, patterns] of Object.entries(HEURISTICS) as Array<[IndustryKey, RegExp[]]>) {
    if (patterns.length === 0) continue;

    let matches = 0;
    for (const pattern of patterns) {
      if (pattern.test(allText)) matches++;
    }

    // Score is percentage of patterns that matched
    const score = patterns.length > 0 ? matches / patterns.length : 0;
    if (score > 0) scores.set(industry, score);
  }

  return scores;
}

/**
 * Score based on domain name tokens
 * Returns higher scores (0-1.0) when domain keywords match
 */
function scoreDomain(domain: string): Map<IndustryKey, number> {
  const scores = new Map<IndustryKey, number>();
  const tokens = domain.toLowerCase().split(/[.-]/);

  const domainKeywords: Record<IndustryKey, string[]> = {
    automotive_oem: ['auto', 'car', 'motors', 'toyota', 'ford', 'honda', 'nissan', 'bmw', 'tesla', 'stellantis', 'chrysler', 'dodge', 'jeep', 'carvana', 'carmax', 'vroom', 'shift', 'cars', 'subaru'],
    automotive_dealer: ['dealer', 'dealership', 'usedcars', 'newcars'],
    travel_cruise: ['cruise', 'cruises', 'viking', 'carnival', 'princess', 'royal', 'norwegian', 'holland', 'america', 'msc', 'celebrity', 'cunard', 'seabourn'],
    travel_hotels: ['hotel', 'hotels', 'resort', 'resorts', 'marriott', 'hilton', 'hyatt', 'airbnb', 'expedia'],
    travel_air: ['airline', 'airlines', 'air', 'delta', 'united', 'american', 'southwest', 'jetblue'],
    retail: ['shop', 'store', 'mall', 'retail', 'buy', 'cart', 'apple', 'samsung', 'microsoft', 'tech', 'amazon', 'walmart', 'target', 'nike', 'adidas', 'etsy', 'best', 'bestbuy'],
    financial_services: ['bank', 'banking', 'credit', 'loan', 'mortgage', 'invest', 'finance', 'capital', 'chase', 'wells', 'fargo', 'wellsfargo', 'allstate', 'progressive', 'aig', 'insurance'],
    healthcare_provider: ['health', 'medical', 'clinic', 'hospital', 'doctor', 'healthcare', 'mayo', 'cleveland', 'pfizer', 'merck', 'united', 'pharma', 'pharmaceutical'],
    food_restaurant: ['restaurant', 'cafe', 'pizza', 'burger', 'food', 'dining', 'menu', 'kitchen', 'grill', 'mcdonalds', 'mcd', 'starbucks', 'chipotle', 'dominos', 'domino', 'panera', 'bread'],
    real_estate: ['realty', 'realtor', 'homes', 'property', 'estate', 'zillow', 'redfin', 'trulia', 'kbhome', 'lennar', 'beazer'],
    education: ['edu', 'school', 'university', 'college', 'academy', 'learn', 'education', 'harvard', 'mit', 'coursera', 'edx', 'khan'],
    professional_services: ['law', 'legal', 'consulting', 'advisory', 'services', 'consulting'],
    saas_b2b: ['saas', 'cloud', 'platform', 'software', 'app', 'api', 'service', 'salesforce', 'adobe', 'nvidia'],
    ecommerce_fashion: [],
    media_entertainment: ['media', 'news', 'streaming', 'video', 'tv', 'entertainment', 'cnn', 'espn', 'netflix', 'spotify', 'disney', 'disneyplus'],
    nonprofit: ['charity', 'foundation', 'nonprofit', 'donate'],
    government: ['gov'],
    manufacturing: ['manufacturing', 'industrial', 'factory', 'caterpillar', 'honeywell', 'siemens', 'energy', 'oil', 'gas', 'exxon', 'chevron', 'shell', 'duke'],
    generic_consumer: [],
    unknown: [],
  };

  for (const [industry, keywords] of Object.entries(domainKeywords) as Array<[IndustryKey, string[]]>) {
    // Use substring matching to catch compound domains like "hollandamerica"
    // Count unique keywords matched (not tokens) to handle multiple matches in one token
    const matchedKeywords = new Set<string>();
    for (const token of tokens) {
      for (const kw of keywords) {
        if (token.includes(kw)) {
          matchedKeywords.add(kw);
        }
      }
    }
    const matches = matchedKeywords.size;
    if (matches > 0) {
      // Stronger scoring: 1 match = 0.70, 2+ matches = 0.95+
      scores.set(industry, Math.min(1.0, 0.70 + (matches - 1) * 0.25));
    }
  }

  return scores;
}

/**
 * Fuse scores from multiple sources
 * Weights: [heuristics, domain, embeddings/LLM]
 * Domain gets higher weight because it's a strong signal
 */
function fuseScores(...scoreMaps: Map<IndustryKey, number>[]): Map<IndustryKey, number> {
  const fused = new Map<IndustryKey, number>();
  const weights = [0.4, 0.5, 0.1]; // Heuristics, domain, embeddings/LLM (domain is most reliable)

  for (let i = 0; i < scoreMaps.length; i++) {
    const weight = weights[i] || 0.1;
    for (const [industry, score] of scoreMaps[i].entries()) {
      fused.set(industry, (fused.get(industry) || 0) + score * weight);
    }
  }

  return fused;
}

/**
 * Main classification function
 */
/**
 * Classify using Workers AI (Llama-3.1-8b)
 * Fast, accurate, handles long tail of sites
 */
async function classifyWithAI(
  signals: ExtractedSignals,
  env: any
): Promise<{ industry: string; confidence: number } | null> {
  if (!env?.AI) return null;

  try {
    // Build rich context for AI
    const context = [
      signals.domain && `Domain: ${signals.domain}`,
      signals.title && `Title: ${signals.title}`,
      signals.h1 && `H1: ${signals.h1}`,
      signals.metaDescription && `Description: ${signals.metaDescription}`,
      signals.navTerms?.length && `Navigation: ${signals.navTerms.slice(0, 8).join(', ')}`,
      signals.schemaTypes?.length && `Schema: ${signals.schemaTypes.join(', ')}`,
      signals.bodyText && `Content: ${signals.bodyText.slice(0, 500)}...`,
    ].filter(Boolean).join('\n');

    const prompt = `You are an expert at classifying websites into industries.

Analyze this website and classify it into ONE of these industries:

AUTOMOTIVE:
- automotive.oem (car manufacturers)
- automotive.dealer (car dealerships)
- automotive.rental (car rentals)
- automotive.ev (electric vehicles)

FINANCE:
- finance.bank (banks)
- finance.insurance.p_and_c (property & casualty insurance)
- finance.insurance.life (life insurance)
- finance.brokerage.trading (stock trading)
- finance.lending.mortgage (mortgages)

HEALTH:
- health.providers (hospitals, clinics)
- health.pharma.brand (pharmaceutical companies)
- health.payers (health insurance)
- health.dental (dental practices)
- health.mental_behavioral (mental health)

TRAVEL:
- travel.cruise (cruise lines)
- travel.hotels (hotels, resorts)
- travel.air (airlines)
- travel.vacation_rentals (Airbnb-style)
- travel.otasearch (Expedia, Booking.com)

FOOD & RESTAURANT:
- food_restaurant.fast_casual (Chipotle, Panera)
- food_restaurant.qsr (McDonald's, Starbucks)
- food_restaurant.casual (Applebee's, Chili's)

RETAIL:
- retail.grocery (grocery stores)
- retail.mass_merch (Walmart, Target)
- retail.marketplace.horizontal (Amazon)
- retail.beauty (Sephora, Ulta)

MEDIA & ENTERTAINMENT:
- media.streaming.video (Netflix, Hulu)
- media.streaming.music (Spotify)
- media.sports (ESPN, sports websites)
- media.news (CNN, news publishers)
- media.social (Facebook, Twitter)

EDUCATION:
- education.higher.private (Harvard, Stanford)
- education.higher.public (state universities)
- education.online (Coursera, Khan Academy)
- education.bootcamps (coding bootcamps)

REAL ESTATE:
- real_estate.residential.broker (Zillow, Redfin)
- real_estate.new_home_builders (Lennar, KB Home)

SOFTWARE:
- software.saas (Salesforce, Stripe)
- software.cdp_crm (CRM platforms)

PROFESSIONAL SERVICES:
- professional.consulting.mgmt (McKinsey, BCG)
- professional.accounting (accounting firms)

TELECOMMUNICATIONS:
- telecom.wireless (Verizon, AT&T)
- telecom.isp_broadband (Comcast, Spectrum)

OTHER:
- generic_consumer (if none fit)

Website to classify:
${context}

Respond with ONLY a JSON object in this exact format:
{"industry": "category.subcategory", "confidence": 0.95, "reason": "short explanation"}

Examples:
{"industry": "media.sports", "confidence": 0.98, "reason": "ESPN is a sports media company"}
{"industry": "real_estate.residential.broker", "confidence": 0.96, "reason": "Zillow is a real estate search platform"}
{"industry": "education.online", "confidence": 0.94, "reason": "Coursera offers online courses"}

Your response:`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      prompt,
      max_tokens: 150,
      temperature: 0.1, // Low temperature for consistent output
    });

    // Parse response
    const text = response?.response || '';
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      console.warn('[AI_CLASSIFY] No JSON in response:', text.slice(0, 200));
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.industry || !parsed.confidence) {
      console.warn('[AI_CLASSIFY] Invalid JSON structure:', parsed);
      return null;
    }

    console.log(`[AI_CLASSIFY] ${signals.domain} → ${parsed.industry} (${parsed.confidence.toFixed(2)}) - ${parsed.reason}`);
    return { industry: parsed.industry, confidence: parsed.confidence };

  } catch (err: any) {
    console.error('[AI_CLASSIFY] Error:', err.message || err);
    return null;
  }
}

export async function classifyIndustry(
  req: ClassifyRequest,
  env?: any
): Promise<ClassifyResponse> {
  const { domain, root_url, site_description, crawl_budget } = req;

  // Extract signals
  let signals: ExtractedSignals = {
    domain,
    siteDescription: site_description,
  };

  // Try to fetch homepage if budget allows
  if (crawl_budget?.homepage !== false) {
    const html = await fetchHomepage(
      root_url,
      crawl_budget?.timeout_ms || 5000
    );
    if (html) {
      signals = await extractSignalsFromHTML(html, domain, site_description);
    }
  }

  // 🔥 NEW: Try AI first (Workers AI Llama)
  if (env?.AI) {
    const aiResult = await classifyWithAI(signals, env);
    if (aiResult && aiResult.confidence >= 0.70) {
      return {
        primary: {
          industry_key: aiResult.industry as IndustryKey,
          confidence: aiResult.confidence,
          source: 'ai_worker',
        },
        alts: [],
        evidence: {
          title: signals.title,
          nav: signals.navTerms,
          schema: signals.schemaTypes,
          keywords: site_description?.split(/\s+/).slice(0, 20),
          domain_signals: domain.split(/[.-]/),
        },
        model_version: 'ind-v2.0-llama',
      };
    }
  }

  // Fallback: Score using heuristics (legacy behavior)
  const heuristicScores = scoreHeuristics(signals);
  const domainScores = scoreDomain(domain);
  const fusedScores = fuseScores(heuristicScores, domainScores);

  const sorted = Array.from(fusedScores.entries())
    .sort((a, b) => b[1] - a[1])
    .filter(([_, score]) => score > 0);

  // Default to generic_consumer if no matches
  if (sorted.length === 0) {
    sorted.push(['generic_consumer', 0.5]);
  }

  const [primaryKey, primaryScore] = sorted[0];
  const alts = sorted
    .slice(1, 4)
    .map(([key, score]) => ({ industry_key: key as IndustryKey, confidence: score }));

  return {
    primary: {
      industry_key: primaryKey as IndustryKey,
      confidence: Math.min(1.0, primaryScore),
      source: 'ai_worker',
    },
    alts,
    evidence: {
      title: signals.title,
      nav: signals.navTerms,
      schema: signals.schemaTypes,
      keywords: site_description?.split(/\s+/).slice(0, 20),
      domain_signals: domain.split(/[.-]/),
    },
    model_version: 'ind-v1.1-heuristic',
  };
}

