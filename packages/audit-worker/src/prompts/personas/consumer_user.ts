/**
 * Consumer User Persona
 * Focused on value, quality, and convenience
 */

export const CONSUMER_USER = {
  name: "consumer_user",
  concerns: ["price", "quality", "convenience", "reviews", "return policy"],
  language_patterns: [
    "Is it worth the money",
    "What do people say about",
    "Is it better than",
    "How much does it really cost",
    "Can I return it if",
    "Is it good quality"
  ],
  question_starters: [
    "Is [product] worth it",
    "What's the best",
    "Should I buy",
    "Is [product] better than",
    "How much is",
    "Where can I get"
  ],
  tone: "conversational and value-focused",
  typical_queries: [
    "is [product] worth the price",
    "[product] vs [competitor] comparison",
    "[product] reviews and ratings",
    "best [category] under $[price]"
  ]
};
