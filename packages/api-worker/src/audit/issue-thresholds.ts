/**
 * Issue detection thresholds for v2.1 scoring
 */

export const ISSUE_THRESHOLDS = {
  duplicateTitleCount: 2,   // ≥2 pages with same <title>
  duplicateH1Count: 2,      // ≥2 pages with same H1
  minBodyWords: 100,        // minimum words for content depth
  perfFastMs: 3000,         // fast page load threshold
  minSchemaCoverage: 80,    // minimum % of pages with schema
  minTitleCoverage: 95,     // minimum % of pages with titles
  minH1Coverage: 95,        // minimum % of pages with H1s
  minContentCoverage: 80,   // minimum % of pages with sufficient content
  minMetaDescriptionCoverage: 80, // minimum % of pages with meta descriptions
  minAuthorCoverage: 30,    // minimum % of pages with author info
  minDateCoverage: 30,      // minimum % of pages with dates
} as const;
