/**
 * Industry classification heuristic
 */

export function inferIndustryFromContext(text: string): string | null {
  const t = text.toLowerCase();
  const map: [string, RegExp][] = [
    // Insurance: auto, home, life, health, property
    ['insurance', /\b(insurance|insurer|auto insurance|home insurance|life insurance|health insurance|property insurance|coverage|policy|premium|claim|underwriting|liability)\b/],
    // Finance: expanded to include trading/investment platforms
    ['finance', /\b(payments?|bank|wallet|invoice|checkout|transfer|fintech|card|trading|investment|stock|broker|brokerage|crypto|portfolio|market|invest|securities|financial)\b/],
    ['travel', /\b(cruise|hotel|flight|vacation|booking|resort|ship|itinerary)\b/],
    // Retail: includes stores, manufacturers, and consumer product categories
    ['retail', /\b(retail|ecommerce|SKU|cart|checkout|store|merch|apparel|guitar|instrument|music|drum|piano|bass|amp|pedal|product|buy|shop|purchase|soccer|football|basketball|baseball|tennis|hockey|sport|athletic|jersey|cleat|uniform|team|gear|equipment)\b/],
    ['software', /\b(api|sdk|saas|dashboard|developers?|docs|integration)\b/],
    ['media', /\b(news|article|blog|press|magazine|publisher|review)\b/],
    ['education', /\b(course|learning|university|school|edtech|students?)\b/],
  ];
  for (const [label, rx] of map) {
    if (rx.test(t)) return label;
  }
  return null;
}

