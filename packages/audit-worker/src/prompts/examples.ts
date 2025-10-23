/**
 * Few-Shot Examples Library
 * 
 * High-quality example queries for each industry to guide LLM generation.
 * Each example is verified to be:
 * - Natural and conversational
 * - Factually accurate
 * - Free of brand hallucinations
 * - Representative of real user search behavior
 */

export interface FewShotExamples {
  good: string[];
  bad: string[];
}

export const FEWSHOT_EXAMPLES: Record<string, FewShotExamples> = {
  saas_b2b: {
    good: [
      "Is Salesforce worth it for a 10-person team?",
      "Salesforce vs HubSpot for B2B companies",
      "How much does Salesforce actually cost per user?",
      "Best CRM for small business under $100/month",
      "Does Salesforce integrate with Gmail?",
      "Salesforce pricing breakdown for startups",
      "Is HubSpot easier to use than Salesforce?",
      "What's included in Salesforce Professional plan?"
    ],
    bad: [
      "Salesforce makers pricing",
      "Explain how Salesforce works for ecommerce",
      "Salesforce builders enterprise plan",
      "When should someone choose Salesforce"
    ]
  },
  
  retail: {
    good: [
      "Is Walmart cheaper than Target for groceries?",
      "Best time to shop at Costco for deals",
      "Does Amazon Prime actually save money?",
      "Target vs Walmart quality comparison",
      "Costco membership worth it for families?",
      "Amazon return policy vs Walmart",
      "Best grocery delivery service prices"
    ],
    bad: [
      "Target shoppers review page",
      "Walmart.com login issues",
      "Target members pro pricing",
      "Costco shoppers exclusive deals"
    ]
  },
  
  financial_services: {
    good: [
      "Is Chase Sapphire worth the annual fee?",
      "Wells Fargo vs Bank of America checking account",
      "Best credit card for travel rewards",
      "Chase credit card approval requirements",
      "Does Stripe charge monthly fees?",
      "PayPal vs Stripe for small business",
      "Stripe pricing for online stores"
    ],
    bad: [
      "Chase banking pros for merchants",
      "Stripe builders payment gateway",
      "PayPal shoppers membership"
    ]
  },
  
  healthcare_provider: {
    good: [
      "Is Mayo Clinic better than Cleveland Clinic?",
      "Does Mayo Clinic accept Medicare?",
      "How much does Mayo Clinic cost?",
      "Mayo Clinic vs Johns Hopkins for cancer treatment",
      "Best hospital for heart surgery",
      "Does Cleveland Clinic take my insurance?",
      "Mayo Clinic patient reviews"
    ],
    bad: [
      "Mayo members portal login",
      "Cleveland Clinic pro services",
      "Healthcare providers comparison tool"
    ]
  },
  
  travel_hotels: {
    good: [
      "Is Marriott Bonvoy worth it?",
      "Marriott vs Hilton for business travel",
      "Best hotel loyalty program",
      "Marriott points value vs cash",
      "Hilton Honors vs Marriott Bonvoy comparison",
      "How much is a night at Marriott?",
      "Best hotel chain for families"
    ],
    good: [
      "Marriott travelers membership",
      "Hilton guests pro account",
      "Hotel members exclusive pricing"
    ]
  },
  
  travel_air: {
    good: [
      "Is Southwest worth it for families?",
      "Delta vs United for frequent flyers",
      "Best airline for international flights",
      "Southwest credit card vs Delta Amex",
      "Does Southwest have free checked bags?",
      "United baggage fees vs Delta",
      "Best airline rewards program"
    ],
    bad: [
      "Southwest flyers membership",
      "Delta travelers pro account",
      "United members exclusive"
    ]
  },
  
  travel_cruise: {
    good: [
      "Is Carnival cheaper than Royal Caribbean?",
      "Best cruise line for families with kids",
      "Carnival vs Norwegian cruise comparison",
      "How much does a Royal Caribbean cruise cost?",
      "Best cruise line for first-timers",
      "Norwegian cruise drink package worth it?"
    ],
    bad: [
      "Carnival cruisers membership",
      "Royal Caribbean passengers pro",
      "Cruise members exclusive"
    ]
  },
  
  media_entertainment: {
    good: [
      "Is Disney+ worth it vs Netflix?",
      "ESPN+ vs Hulu Live for sports",
      "Best streaming service for movies",
      "Netflix vs Disney+ content comparison",
      "Does ESPN+ have NFL games?",
      "Hulu vs Netflix pricing",
      "Best streaming bundle deals"
    ],
    bad: [
      "Disney+ watchers membership",
      "Netflix viewers pro account",
      "ESPN subscribers exclusive"
    ]
  },
  
  education: {
    good: [
      "Is Coursera worth it vs Udemy?",
      "Harvard online courses vs MIT",
      "Best online learning platform for tech",
      "Coursera certificate value for jobs",
      "edX vs Coursera for computer science",
      "How much does Harvard Extension cost?",
      "Best online MBA programs"
    ],
    bad: [
      "Coursera learners pro account",
      "Harvard students exclusive portal",
      "edX members premium"
    ]
  },
  
  automotive_oem: {
    good: [
      "Is Toyota more reliable than Honda?",
      "Ford vs Chevy truck comparison",
      "Best SUV under $40k",
      "Toyota Camry vs Honda Accord reliability",
      "Tesla Model 3 vs Model Y differences",
      "Ford F-150 vs Ram 1500 towing capacity",
      "Most reliable car brands"
    ],
    bad: [
      "Toyota drivers membership",
      "Ford owners pro account",
      "Tesla buyers exclusive"
    ]
  },
  
  food_restaurant: {
    good: [
      "Is Chipotle healthier than Taco Bell?",
      "Starbucks rewards vs Dunkin'",
      "Best fast food for low carb",
      "McDonald's vs Burger King prices",
      "Chipotle burrito bowl calories",
      "Starbucks drink prices vs local coffee",
      "Best fast casual restaurant value"
    ],
    bad: [
      "Chipotle eaters membership",
      "Starbucks drinkers pro",
      "McDonald's customers exclusive"
    ]
  },
  
  real_estate: {
    good: [
      "Is Zillow accurate for home values?",
      "Redfin vs Zillow for buying a house",
      "Best real estate website for sellers",
      "Zillow vs Realtor.com listings",
      "How accurate are Redfin estimates?",
      "Zillow Premier Agent worth it?",
      "Best site to find rental properties"
    ],
    bad: [
      "Zillow buyers pro account",
      "Redfin members exclusive",
      "Realtor members premium portal"
    ]
  },
  
  generic_consumer: {
    good: [
      "Is it worth buying from this brand?",
      "What do customers say about quality?",
      "Best value in this category",
      "Are there better alternatives?",
      "How does this compare to competitors?",
      "What's the return policy?",
      "Does this have good customer support?"
    ],
    bad: [
      "Brand makers pricing",
      "Company builders services",
      "Members pro exclusive access"
    ]
  }
};

/**
 * Get few-shot examples for a specific industry
 */
export function getFewShotExamples(industry: string, count: number = 3): string[] {
  const examples = FEWSHOT_EXAMPLES[industry] || FEWSHOT_EXAMPLES.generic_consumer;
  return examples.good.slice(0, count);
}

/**
 * Get bad examples for quality testing
 */
export function getBadExamples(industry: string): string[] {
  const examples = FEWSHOT_EXAMPLES[industry] || FEWSHOT_EXAMPLES.generic_consumer;
  return examples.bad;
}

