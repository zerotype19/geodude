# Geo-Selection / Country-Selection Bypass System

## Problem

Many international websites (like Best Buy, Target, Nike, etc.) show geo-selection interstitial pages that ask users to "Choose your country" or "Select your region" before allowing access to the main content. When our crawler hits these pages, it gets stuck analyzing the country selector instead of the actual website content, resulting in:

- Low diagnostic scores (typically 30-40)
- Missing canonical tags
- No schema markup
- Minimal content analysis
- Title/H1 showing "Select your country" instead of actual brand content

## Example Case: Best Buy

**Before Fix:**
- URL: `https://www.bestbuy.com/`
- Captured Page: "Best Buy International: Select your Country - Best Buy"
- H1: "Choose a country."
- Result: Low score, no meaningful analysis

## Solution

Intelligent detection and automatic bypass of geo-selection interstitial pages using multiple detection patterns and fallback strategies.

### Detection Patterns

#### Pattern 1: Keyword Detection
Scans title and H1 tags for explicit geo-selection indicators:
- "select your country"
- "choose a country"
- "choose your country"
- "select your region"
- "choose your region"
- "select country"
- "country selection"
- "region selection"
- "select your location"
- "choose location"
- "international:"
- "which country"
- "where are you"

#### Pattern 2: URL Path Analysis
Detects common URL patterns:
- `/international`
- `/country-selector`
- `/region-selector`
- `/locale-selector`

#### Pattern 3: Content Analysis Heuristic
Identifies selector pages by combination of:
- 5+ links containing "country", "region", or "location" keywords
- Page size < 50KB (minimal content)
- No canonical tag present

### Bypass Strategies

When a geo-selection page is detected, the system attempts multiple strategies in order:

#### Strategy 1: Extract Target Link
- Parse HTML for links to US/EN sites
- Look for patterns: `/us`, `/en-us`, `country=us`
- Follow the extracted link to get actual content

#### Strategy 2: Common URL Fallbacks
If no explicit link is found, try these common patterns:
1. `{origin}/us`
2. `{origin}/en-us`
3. `{origin}/en`

#### Strategy 3: Content Comparison
- Fetch the target URL
- Compare HTML length with original
- Use the longer, more substantial content
- If target fails or is smaller, keep original (graceful degradation)

## Implementation

### Location
`geodude/packages/audit-worker/src/index.ts`

### Key Function
```typescript
function detectGeoSelectionPage(html: string, url: string): {
  isGeoSelection: boolean;
  targetUrl?: string;
  reason?: string;
}
```

### Integration Point
The bypass logic is integrated into the `fetchPage()` function, which is called for every page during audit crawling. This ensures:
- **Early detection**: Geo-selection pages are caught immediately
- **Automatic retry**: Target URL is fetched without manual intervention
- **Transparent operation**: Audit continues seamlessly with correct content
- **No user impact**: The system handles this invisibly

## Logging

The system provides detailed logging for debugging and monitoring:

```
[GEO-DETECT] ✅ Geo-selection detected: "select your country" in title
[GEO-BYPASS] Detected geo-selection page at https://www.bestbuy.com/
[GEO-BYPASS] Reason: Keyword: select your country
[GEO-BYPASS] Attempting to fetch target: https://www.bestbuy.com/us
[GEO-BYPASS] ✅ Successfully bypassed to https://www.bestbuy.com/us
```

## Testing

### Test Sites
Sites known to have geo-selection pages:
- Best Buy (bestbuy.com → bestbuy.com/us)
- Nike (nike.com → nike.com/us)
- Target (target.com → may redirect to target.com/us)
- H&M (hm.com → various country sites)
- IKEA (ikea.com → various country sites)

### Test Procedure
1. Start an audit for one of the test sites
2. Check logs for `[GEO-DETECT]` and `[GEO-BYPASS]` messages
3. Verify the audit analyzes actual content, not the selector page
4. Confirm title/H1 reflect the actual brand content
5. Check for proper canonical tags and schema markup

### Expected Results
✅ Detection triggers for country selector pages
✅ System attempts bypass to US/EN site
✅ Final HTML contains actual website content
✅ Diagnostic scores reflect real site quality (not selector page)
✅ Title shows brand content, not "Select your country"

## Benefits

1. **More Accurate Audits**: Analyzes actual website content instead of interstitial pages
2. **Higher Success Rate**: Prevents audits from getting stuck on selector pages
3. **Better Scores**: Diagnostic scores reflect real site quality
4. **Automatic**: No manual intervention or configuration needed
5. **Transparent**: Works invisibly without user awareness
6. **Graceful**: Falls back to original if bypass fails

## Edge Cases Handled

### Multiple Locales
- System defaults to US/EN but can be extended for other markets
- Prioritizes `/us` over `/en-us` over `/en`

### Failed Bypass
- If target URL fails to load, keeps original content
- If target content is smaller/worse, keeps original
- Never fails the audit completely

### False Positives
- Content comparison ensures we don't replace good content with bad
- Heuristic checks multiple signals (not just one keyword)
- URL path + content analysis reduces false detection

### Already Localized URLs
- If the incoming URL is already localized (e.g., `nike.com/us`), no bypass is triggered
- Detection only fires if we land on an actual selector page

## Future Enhancements

Potential improvements:
1. **Multi-region support**: Allow configuration for preferred regions (UK, CA, AU, etc.)
2. **Cookie-based bypass**: Set location cookies before fetching
3. **Header-based bypass**: Send location headers (Accept-Language, etc.)
4. **Sitemap awareness**: Extract primary locale from sitemap structure
5. **Machine learning**: Learn site-specific bypass patterns over time

## Deployment

- **Status**: ✅ Deployed to production
- **Worker Version**: `8b926459-34ce-41b2-a5b5-c8d58891735b`
- **Date**: October 28, 2025
- **Commit**: `3b6b866`

## Related Issues

This feature solves the problem reported where Best Buy audits were analyzing the "Best Buy International: Select your Country" page instead of the actual US Best Buy site, resulting in artificially low scores and incomplete analysis.

