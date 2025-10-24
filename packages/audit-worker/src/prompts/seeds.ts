/**
 * Industry-specific seed data for competitor, audience, and purpose lists
 */

export const COMPETITOR_SEEDS: Record<string, string[]> = {
  finance: ['Stripe', 'Square', 'Adyen', 'Worldpay', 'Venmo', 'Apple Pay', 'Google Pay'],
  travel: ['Carnival', 'Norwegian Cruise Line', 'Princess', 'Disney Cruise Line', 'MSC'],
  retail: ['Amazon', 'Shopify', 'Walmart', 'Target'],
  software: ['GitHub', 'GitLab', 'Bitbucket', 'Atlassian'],
  // 🔥 FIX: Add real restaurant competitors
  food_restaurant: ['Qdoba', "Moe's", 'Panera', 'Sweetgreen', 'Shake Shack', 'Five Guys'],
  'food_restaurant.fast_casual': ['Qdoba', "Moe's", 'Panera', 'Sweetgreen', 'Shake Shack'],
  'food_restaurant.qsr': ['McDonald\'s', 'Burger King', 'Wendy\'s', 'Taco Bell', 'KFC'],
  'food_restaurant.casual': ['Applebee\'s', 'Chili\'s', 'Olive Garden', 'Red Lobster', 'Outback Steakhouse'],
  default: ['Competitor A', 'Competitor B']
};

export const AUDIENCE_SEEDS: Record<string, string[]> = {
  finance: ['small businesses', 'consumers', 'freelancers', 'nonprofits', 'marketplaces'],
  travel: ['families', 'couples', 'first-timers', 'budget travelers', 'groups'],
  retail: ['DTC brands', 'marketplaces', 'brick-and-mortar retailers', 'resellers'],
  software: ['developers', 'enterprise teams', 'startups', 'admins'],
  // 🔥 FIX: Add restaurant audiences
  food_restaurant: ['lunch crowds', 'families', 'takeout customers', 'catering clients', 'delivery users'],
  health: ['patients', 'families', 'seniors', 'children', 'caregivers'],
  default: ['beginners', 'professionals', 'small businesses']
};

export const PURPOSE_SEEDS: Record<string, string[]> = {
  finance: ['online payments', 'money transfers', 'checkout', 'donations', 'subscriptions'],
  travel: ['booking', 'check-in', 'onboard purchases', 'shore excursions'],
  // 🔥 FIX: Add restaurant purposes
  food_restaurant: ['quick lunch', 'dinner', 'catering events', 'online ordering', 'takeout'],
  health: ['routine care', 'specialist visit', 'emergency care', 'lab work', 'prescriptions'],
  default: ['getting started', 'evaluation', 'migration']
};

