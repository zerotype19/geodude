/**
 * Intent archetypes for human-like query generation
 * Split into branded (mentions {brand}) and non-branded (no brand mention)
 */

export type IntentName = 'overview' | 'trust' | 'cost' | 'comparison' | 'usage' | 'policy';

export const BRANDED_TEMPLATES: Record<IntentName, string[]> = {
  overview: [
    "What is {brand} and how does it work for {audience}?",
    "Explain how {brand} works for {use_case}.",
    "When should someone choose {brand} for {goal}?"
  ],
  trust: [
    "Is {brand} safe for {purpose}?",
    "How does {brand} protect {user_data}?",
    "Does {brand} offer buyer or seller protection for {scenario}?"
  ],
  cost: [
    "How much does it cost to use {brand} for {use_case}?",
    "Does {brand} charge fees for {transaction_type}?",
    "Is {brand} cheaper than {competitor} for {use_case}?"
  ],
  comparison: [
    "Compare {brand} vs {competitor} for {goal}.",
    "Which is better, {brand} or {competitor}, for {use_case}?",
    "Alternatives to {brand} for {goal}."
  ],
  usage: [
    "How do I set up {brand} for {goal}?",
    "Can I use {brand} to {action}?",
    "Steps to use {brand} for {use_case}."
  ],
  policy: [
    "Where is {brand} available and what are the limits for {use_case}?",
    "Does {brand} support {region} and {currency}?",
    "What are {brand}'s rules for {scenario}?"
  ]
};

export const NONBRANDED_TEMPLATES: Record<IntentName, string[]> = {
  overview: [
    "What is a {category} and how does it work?",
    "When should a team choose a {category} for {goal}?"
  ],
  trust: [
    "Are {categoryPlural} safe for {purpose}?",
    "How do {categoryPlural} protect {user_data}?"
  ],
  cost: [
    "How much do {categoryPlural} cost for {use_case}?",
    "Which {category} has the lowest fees for {use_case}?"
  ],
  comparison: [
    "Best {categoryPlural} for {audience}.",
    "Top {categoryPlural} for {goal}.",
    "Which {category} is better for {use_case}?"
  ],
  usage: [
    "How do {categoryPlural} work?",
    "Steps to set up a {category} for {goal}."
  ],
  policy: [
    "Availability and limits for {categoryPlural} in {region}.",
    "Do {categoryPlural} support {currency}?"
  ]
};

// Few-shot seeds (branded only) - used optionally
export const FEWSHOT_SEEDS: Record<string, string[]> = {
  finance: [
    "Is {brand} FDIC insured?",
    "Does {brand} work internationally?",
    "How long do transfers take with {brand}?"
  ],
  travel: [
    "How early should I check in with {brand}?",
    "What's included in a {brand} package?",
    "Does {brand} allow bringing {item} onboard?"
  ],
  retail: [
    "How does {brand}'s return policy work?",
    "Does {brand} price match?"
  ]
};
