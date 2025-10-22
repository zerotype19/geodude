# Scoring V1 - Verification & Operations Guide

## 10-Minute Verification Checklist

### 1. Database Sanity Check

Verify at least one page has populated `checks_json`:

```sql
-- Check that new audits have scoring data
SELECT 
  page_id, 
  substr(checks_json, 1, 200) AS sample,
  length(checks_json) as json_size
FROM audit_page_analysis
WHERE checks_json IS NOT NULL 
  AND length(checks_json) > 10
ORDER BY analyzed_at DESC
LIMIT 3;
```

Expected output: JSON arrays starting with `[{"id":"C1_title_quality",...`

### 2. Count Coverage

See what % of pages have scoring data:

```sql
SELECT 
  COUNT(*) as total_pages,
  COUNT(checks_json) as scored_pages,
  ROUND(COUNT(checks_json) * 100.0 / COUNT(*), 2) as coverage_pct
FROM audit_page_analysis;
```

Expected: 100% for new audits, lower % for old audits (need backfill).

### 3. Sample Check Output

View full check results for one page:

```sql
SELECT 
  p.url,
  json_extract(a.checks_json, '$[0].id') as check_id,
  json_extract(a.checks_json, '$[0].score') as check_score,
  json_array_length(a.checks_json) as total_checks
FROM audit_pages p
JOIN audit_page_analysis a ON a.page_id = p.id
WHERE a.checks_json IS NOT NULL
LIMIT 1;
```

Expected: `total_checks = 13`, check IDs like `C1_title_quality`, etc.

### 4. API Sanity Check

Test the API endpoint (replace `{AUDIT_ID}` with a real ID):

```bash
# Get audit detail
curl -s https://api.optiview.ai/api/audits/{AUDIT_ID} \
  -H "Cookie: ov_sess=YOUR_SESSION" | \
  jq '{
    audit_id: .id,
    pages_analyzed: .pages_analyzed,
    has_checks: (.checks != null),
    check_count: (.checks | length),
    first_check: .checks[0]
  }'
```

Expected output:
```json
{
  "audit_id": "...",
  "pages_analyzed": 42,
  "has_checks": true,
  "check_count": 13,
  "first_check": {
    "id": "C1_title_quality",
    "score": 85,
    "status": "ok",
    ...
  }
}
```

### 5. Pages Endpoint Check

```bash
curl -s https://api.optiview.ai/api/audits/{AUDIT_ID}/pages \
  -H "Cookie: ov_sess=YOUR_SESSION" | \
  jq '.pages[0] | {
    url,
    has_checks: (.checks_json != null),
    checks_preview: (.checks_json | fromjson | map(.id) | .[0:3])
  }'
```

Expected: `has_checks: true`, check IDs visible.

### 6. UI Verification (Manual)

Open an audit in the UI and verify:

- ✅ Page detail shows check results
- ✅ Category cards show scores based on present checks
- ✅ "Active checks: N/Y" indicator visible
- ✅ Category averages don't include phantom zeros
- ✅ A page missing viewport meta shows `T1_mobile_viewport = 0` with `status: "fail"`

### 7. Logs Check

Tail worker logs during a new audit:

```bash
wrangler tail --env production
```

Look for:
- `[SCORING_V1] Scored page: https://...`
- No `[SCORING_V1] Error` messages
- Check execution <50ms per page

---

## Backfill Existing Audits

### Single Audit Backfill

```bash
curl -X POST https://api.optiview.ai/api/admin/audits/{AUDIT_ID}/backfill-checks \
  -H "Cookie: ov_sess=ADMIN_SESSION" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "total": 45,
  "processed": 43,
  "skipped": 2,
  "errors": ["page_url: HTML too short"]
}
```

### Batch Backfill (Top Audits)

Get audit IDs to backfill:

```sql
-- Get recent audits without scoring data
SELECT DISTINCT a.id, a.root_url, a.started_at
FROM audits a
JOIN audit_pages p ON p.audit_id = a.id
JOIN audit_page_analysis apa ON apa.page_id = p.id
WHERE a.status = 'complete'
  AND (apa.checks_json IS NULL OR apa.checks_json = '')
ORDER BY a.started_at DESC
LIMIT 20;
```

Then batch backfill:

```bash
curl -X POST https://api.optiview.ai/api/admin/backfill-checks-batch \
  -H "Cookie: ov_sess=ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "audit_ids": [
      "aud_abc123",
      "aud_def456",
      "aud_ghi789"
    ]
  }'
```

Response:
```json
{
  "results": [
    { "auditId": "aud_abc123", "status": "success", "processed": 42, "skipped": 0 },
    { "auditId": "aud_def456", "status": "success", "processed": 38, "skipped": 2 },
    { "auditId": "aud_ghi789", "status": "not_found" }
  ]
}
```

---

## Spot-Check Each Check (30 seconds)

### Test Fixtures

Create test HTML snippets to validate each check:

#### C1: Title Quality (0 → 85+)

```html
<!-- Bad: Missing title -->
<html><head></head><body>Content</body></html>

<!-- Good: Title with brand, 15-65 chars -->
<html><head>
  <title>Acme Widgets — Best Tools for Developers</title>
</head><body>Content</body></html>
```

#### C2: Meta Description (0 → 100)

```html
<!-- Bad: Missing -->
<head><title>Test</title></head>

<!-- Good: 50-160 chars -->
<head>
  <title>Test</title>
  <meta name="description" content="We provide simple, fast, and reliable widget solutions for modern teams.">
</head>
```

#### C3: H1 Presence (0 → 100 → 30)

```html
<!-- Bad: No H1 → score 0 -->
<body><h2>Welcome</h2></body>

<!-- Good: One H1 → score 100 -->
<body><h1>Welcome</h1></body>

<!-- Warn: Multiple H1 → score 30 -->
<body><h1>Welcome</h1><h1>About</h1></body>
```

#### A1: Answer-First (20 → 60 → 100)

```html
<!-- Poor: No clear value prop or CTA → 20 -->
<body><p>Welcome to our site</p></body>

<!-- Warn: Has CTA but vague content → 60 -->
<body><p>Welcome</p><a href="/pricing">Get Started</a></body>

<!-- Good: Clear value + CTA → 100 -->
<body>
  <p>We help teams do more with less. Fast, simple, reliable.</p>
  <a href="/pricing">Get Started</a>
</body>
```

#### A2: Semantic Headings (penalty test)

```html
<!-- Bad: H1 → H3 skip (penalty -20) → score ~80 -->
<body><h1>Page</h1><h3>Section</h3></body>

<!-- Bad: Multiple H1s (penalty -30) → score ~70 -->
<body><h1>One</h1><h2>Two</h2><h1>Three</h1></body>

<!-- Good: Proper hierarchy → score 100 -->
<body><h1>Page</h1><h2>Section</h2><h3>Subsection</h3></body>
```

#### A3/A4: FAQ Presence & Schema (0 → 60 → 100)

```html
<!-- None → 0 -->
<body><p>No FAQ here</p></body>

<!-- Has Q&A pattern → 60 -->
<body>
  <h2>FAQ</h2>
  <h3>What is this?</h3>
  <p>Answer here</p>
</body>

<!-- Valid FAQPage JSON-LD with 3+ Q&As → 100 -->
<head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {"@type": "Question", "name": "Q1", "acceptedAnswer": {"@type": "Answer", "text": "A1"}},
    {"@type": "Question", "name": "Q2", "acceptedAnswer": {"@type": "Answer", "text": "A2"}},
    {"@type": "Question", "name": "Q3", "acceptedAnswer": {"@type": "Answer", "text": "A3"}}
  ]
}
</script>
</head>
<body><details><summary>What is this?</summary><p>Answer</p></details></body>
```

#### A9: Internal Linking (20 → 60 → 100)

```html
<!-- Poor: <3 links → 20 -->
<body><a href="/page">Link</a></body>

<!-- Warn: 3-9 links → 60 -->
<body>
  <a href="/page1">One</a>
  <a href="/page2">Two</a>
  <a href="/page3">Three</a>
</body>

<!-- Good: 10+ links, 40%+ diversity → 100 -->
<body>
  <a href="/page1">Features</a>
  <a href="/page2">Pricing</a>
  <a href="/page3">About</a>
  <a href="/page4">Blog</a>
  <a href="/page5">Docs</a>
  <a href="/page6">Support</a>
  <a href="/page7">Contact</a>
  <a href="/page8">Careers</a>
  <a href="/page9">Partners</a>
  <a href="/page10">FAQ</a>
</body>
```

#### G10: Canonical (0 → 50 → 100)

```html
<!-- Bad: Missing → 0 -->
<head><title>Test</title></head>

<!-- Warn: Different domain → 50 -->
<head>
  <link rel="canonical" href="https://other-domain.com/page">
</head>

<!-- Good: Same domain → 100 -->
<head>
  <link rel="canonical" href="https://acme.com/page">
</head>
```

#### T1/T2/T3: Technical Meta Tags

```html
<!-- T1: Mobile viewport (0 → 100) -->
<head>
  <!-- Bad: Missing → 0 -->
  <title>Test</title>
  
  <!-- Good → 100 -->
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>

<!-- T2: Lang/region (0 → 30 → 100) -->
<!-- Bad: No lang → 0 -->
<html><head><title>Test</title></head></html>

<!-- Warn: Has lang but doesn't match target → 30 -->
<html lang="fr"><head><title>Test</title></head></html>

<!-- Good: Matches target (en-US) → 100 -->
<html lang="en"><head><title>Test</title></head></html>

<!-- T3: Noindex check (0 → 100) -->
<!-- Bad: Has noindex → 0 -->
<head>
  <meta name="robots" content="noindex, nofollow">
</head>

<!-- Good: No blocking directives → 100 -->
<head>
  <meta name="robots" content="index, follow">
</head>
```

#### A12: Entity Graph (0 → progressive)

```html
<!-- None → 0 -->
<body><p>No schema</p></body>

<!-- Minimal org → ~30 -->
<script type="application/ld+json">
{"@type": "Organization", "name": "Acme"}
</script>

<!-- With logo + 2 sameAs → ~100 -->
<script type="application/ld+json">
{
  "@type": "Organization",
  "name": "Acme Corp",
  "logo": "https://acme.com/logo.png",
  "sameAs": ["https://twitter.com/acme", "https://linkedin.com/company/acme"]
}
</script>
```

---

## Troubleshooting

### "No checks in checks_json"

1. Check feature flag: `SCORING_V1_ENABLED="true"` in wrangler.toml
2. Verify logs: Look for `[SCORING_V1] Scored page: ...`
3. Check HTML availability:
   ```sql
   SELECT 
     id, url, 
     length(html_static) as static_size,
     length(html_rendered) as rendered_size
   FROM audit_pages
   WHERE audit_id = 'YOUR_AUDIT_ID'
   LIMIT 5;
   ```
4. If HTML is null/empty, the scoring service will skip (expected behavior)

### "All checks return status: error"

1. Check linkedom is installed: `pnpm list linkedom`
2. Check for syntax errors in checks.impl.ts
3. Look for specific error messages in logs
4. Test with a simple HTML fixture in smoke tests

### "Scores seem too low/high"

1. Review check logic in `checks.impl.ts`
2. Compare with manual inspection of a sample page
3. Adjust thresholds in individual check functions
4. Run smoke tests to validate scoring bands

### "Render gap issues"

The service automatically falls back to static HTML if rendered HTML is <5KB. Check logs for:
```
[SCORING] Render gap detected for https://..., using static HTML
```

If you see this frequently, adjust `MIN_RENDERED_SIZE` in `services/scorePage.ts`.

### "Performance degradation"

Scoring adds ~50ms per page. If audits are slower:
1. Check `linkedom` parsing time (should be <30ms)
2. Verify no infinite loops in check logic
3. Consider batching DB writes (already optimized)

---

## Rollout Plan

### Phase 1: Staging Validation (Day 1)

1. Deploy to staging with `SCORING_V1_ENABLED="true"`
2. Run 5-10 test audits on known domains
3. Verify all checks return reasonable scores
4. Check API responses include check data
5. Test backfill endpoint on 1-2 old audits

### Phase 2: Production Soft Launch (Day 2)

1. Deploy to production (flag enabled)
2. Monitor logs for errors
3. Backfill top 20 recent audits
4. Share internal note: "New scoring system live"

### Phase 3: Full Rollout (Day 3-7)

1. Backfill remaining high-value audits
2. Update UI to show "Active checks: X/Y"
3. Add site-level aggregation (Phase 2)
4. Monitor for 7 days, adjust thresholds as needed

---

## Next: Site-Level Aggregation

See `src/services/siteLevel.ts` for Phase 2 implementation.

This adds "scope: site" checks like:
- FAQ coverage % across all pages
- Schema adoption rate
- Mobile readiness %
- Canonical correctness %

Run after crawl completes:
```typescript
const metrics = await computeSiteLevel(env.DB, auditId);
await persistSiteLevel(env.DB, auditId, metrics);
```

Display in UI as a "Site Overview" card.

