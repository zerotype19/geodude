/**
 * Time Budget Utility
 * Helps manage work within Cloudflare Worker execution limits
 */

export function makeBudget(ms: number) {
  const start = Date.now();
  const deadline = start + ms;
  
  return {
    left() { return Math.max(0, deadline - Date.now()); },
    over(threshold = 0) { return Date.now() + threshold >= deadline; },
  };
}
