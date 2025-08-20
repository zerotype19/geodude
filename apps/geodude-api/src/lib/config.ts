/**
 * Cache configuration constants
 */

export const CACHE_TTL = {
  eventsSummary:    30,
  sessionsSummary:  30,
  referralsSummary: 60,
  funnelsSummary:   60,
  citationsSummary: 120,
} as const;

export const CACHE_PAYLOAD_LIMIT_BYTES = 50_000; // ~50KB
