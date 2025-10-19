/**
 * Industry-specific seed data for competitor, audience, and purpose lists
 */

export const COMPETITOR_SEEDS: Record<string, string[]> = {
  finance: ['Stripe', 'Square', 'Adyen', 'Worldpay', 'Venmo', 'Apple Pay', 'Google Pay'],
  travel: ['Carnival', 'Norwegian Cruise Line', 'Princess', 'Disney Cruise Line', 'MSC'],
  retail: ['Amazon', 'Shopify', 'Walmart', 'Target'],
  software: ['GitHub', 'GitLab', 'Bitbucket', 'Atlassian'],
  default: ['Competitor A', 'Competitor B']
};

export const AUDIENCE_SEEDS: Record<string, string[]> = {
  finance: ['small businesses', 'consumers', 'freelancers', 'nonprofits', 'marketplaces'],
  travel: ['families', 'couples', 'first-timers', 'budget travelers', 'groups'],
  retail: ['DTC brands', 'marketplaces', 'brick-and-mortar retailers', 'resellers'],
  software: ['developers', 'enterprise teams', 'startups', 'admins'],
  default: ['beginners', 'professionals', 'small businesses']
};

export const PURPOSE_SEEDS: Record<string, string[]> = {
  finance: ['online payments', 'money transfers', 'checkout', 'donations', 'subscriptions'],
  travel: ['booking', 'check-in', 'onboard purchases', 'shore excursions'],
  default: ['getting started', 'evaluation', 'migration']
};

