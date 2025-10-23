/**
 * Consumer User Persona
 * 
 * Characteristics:
 * - Personal use, not business
 * - Price-sensitive
 * - Values simplicity and convenience
 * - Influenced by reviews and recommendations
 * - Quick decision-making
 */

export const CONSUMER_USER = {
  name: "consumer_user",
  
  concerns: [
    "price",
    "ease of use",
    "quality",
    "customer service",
    "return policy",
    "shipping/delivery"
  ],
  
  language_patterns: [
    "Is {brand} worth it",
    "Should I buy",
    "{brand} vs {competitor} which is better",
    "What do people say about",
    "Is {brand} good quality",
    "Does {brand} have free shipping",
    "Can I return {brand} if",
    "Best {category} for families"
  ],
  
  question_starters: [
    "Is it worth",
    "Should I",
    "What's the best",
    "Does it",
    "Can I",
    "Which is better",
    "How much does",
    "Where can I"
  ],
  
  decision_drivers: [
    "Customer reviews and ratings",
    "Price and value",
    "Brand reputation",
    "Ease of purchase",
    "Return policy",
    "Friend/family recommendations"
  ],
  
  pain_points: [
    "Too many options",
    "Confusing pricing",
    "Uncertain about quality",
    "Fear of buyer's remorse",
    "Hidden fees",
    "Shipping costs"
  ],
  
  typical_queries: [
    "Is {brand} worth the money?",
    "{brand} vs {competitor} comparison",
    "What's better, {brand} or {competitor}?",
    "{brand} customer reviews",
    "Does {brand} have sales?",
    "Best {category} under $50",
    "{brand} return policy",
    "Where to buy {brand} cheap",
    "Is {brand} good for beginners?",
    "{brand} promo codes"
  ]
};

