/**
 * Intent archetypes for human-like query generation
 * Split into branded (mentions {brand}) and non-branded (no brand mention)
 */

export type IntentName = 'overview' | 'trust' | 'cost' | 'comparison' | 'usage' | 'policy';

export const BRANDED_TEMPLATES: Record<IntentName, string[]> = {
  overview: [
    "What is {brand} and how does it work for {audience}?",
    "Explain how {brand} works for {use_case}.",
    "When should someone choose {brand} for {goal}?",
    "What makes {brand} different from others?",
    "Help me understand what {brand} actually does.",
    "Is {brand} really worth it for {use_case}?"
  ],
  trust: [
    "Is {brand} safe for {purpose}?",
    "How does {brand} protect {user_data}?",
    "Does {brand} offer buyer or seller protection for {scenario}?",
    "Is {brand} actually safe to use?",
    "Do people trust {brand} with their {user_data}?",
    "What do users say about {brand}'s security?",
    "Can I trust {brand} with {purpose}?"
  ],
  cost: [
    "How much does it cost to use {brand} for {use_case}?",
    "Does {brand} charge fees for {transaction_type}?",
    "Is {brand} cheaper than {competitor} for {use_case}?",
    "Is {brand} worth the price?",
    "Why is {brand} so expensive?",
    "Any cheaper alternatives to {brand}?",
    "What's the catch with {brand}'s pricing?"
  ],
  comparison: [
    "Compare {brand} vs {competitor} for {goal}.",
    "Which is better, {brand} or {competitor}, for {use_case}?",
    "Alternatives to {brand} for {goal}.",
    "{brand} vs {competitor} — which should I choose?",
    "Is {brand} better than {competitor} for {goal}?",
    "Worth switching from {competitor} to {brand}?",
    "Should I use {brand} or stick with {competitor}?"
  ],
  usage: [
    "How do I set up {brand} for {goal}?",
    "Can I use {brand} to {action}?",
    "Steps to use {brand} for {use_case}.",
    "Help me get started with {brand}.",
    "What's the best way to use {brand} for {goal}?",
    "How do I actually use {brand}?"
  ],
  policy: [
    "Where is {brand} available and what are the limits for {use_case}?",
    "Does {brand} support {region} and {currency}?",
    "What are {brand}'s rules for {scenario}?",
    "How responsive is {brand}'s customer support?",
    "What happens if {brand} stops working?",
    "Does {brand} have a refund policy?"
  ]
};

export const NONBRANDED_TEMPLATES: Record<IntentName, string[]> = {
  overview: [
    "What is a {category} and how does it work?",
    "When should a team choose a {category} for {goal}?",
    "What are {categoryPlural} actually for?",
    "Help me understand {categoryPlural}.",
    "Why do people use {categoryPlural}?"
  ],
  trust: [
    "Are {categoryPlural} safe for {purpose}?",
    "How do {categoryPlural} protect {user_data}?",
    "Can I trust {categoryPlural} with {user_data}?",
    "What's the safest {category} for {purpose}?",
    "Are {categoryPlural} secure enough for {use_case}?"
  ],
  cost: [
    "How much do {categoryPlural} cost for {use_case}?",
    "Which {category} has the lowest fees for {use_case}?",
    "What's a good affordable {category}?",
    "Why are {categoryPlural} so expensive?",
    "Best value {categoryPlural} for {audience}?"
  ],
  comparison: [
    "Best {categoryPlural} for {audience}.",
    "Top {categoryPlural} for {goal}.",
    "Which {category} is better for {use_case}?",
    "What are the best {categoryPlural} right now?",
    "Top-rated {categoryPlural} comparison.",
    "Which {category} should I choose?"
  ],
  usage: [
    "How do {categoryPlural} work?",
    "Steps to set up a {category} for {goal}.",
    "How do I use {categoryPlural}?",
    "Guide to using {categoryPlural}.",
    "What's the easiest way to use a {category}?"
  ],
  policy: [
    "Availability and limits for {categoryPlural} in {region}.",
    "Do {categoryPlural} support {currency}?",
    "Which {categoryPlural} work in {region}?",
    "What are the rules for using {categoryPlural}?"
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
