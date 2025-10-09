# Next Milestones (M8-M10)

**Current Version**: v0.9.0-mvp  
**Status**: Production Ready ✅  
**Next**: M8-M10 Feature Enhancements

---

## M8 - Deploy Dashboard + Shareable Audits

**Goal**: Non-dev users can run and share audits

### Scope
1. **Deploy Dashboard**
   - Deploy `apps/app` to Cloudflare Pages
   - Custom domain: app.optiview.ai
   - Build output: `/apps/app/dist`

2. **Shareable Audit Links**
   - Add public route: `/a/:audit_id`
   - Read-only view that fetches `/v1/audits/:id` (no auth required)
   - Renders scores/issues/pages without API key
   - Persist latest `audit_id` per property for easy sharing

3. **API Key in UI**
   - Add API key input field in dashboard
   - Store in localStorage
   - Auto-include in audit requests
   - Show/hide key toggle

### Acceptance Criteria
- [ ] Navigate to app.optiview.ai
- [ ] Input x-api-key in UI field
- [ ] Run audit successfully
- [ ] Share link `/a/<id>` renders results without auth
- [ ] Copy/paste link works for non-authenticated users

### Tasks
1. Create Cloudflare Pages project for `apps/app`
2. Add route `/a/:id` to dashboard
3. Create public audit view component
4. Add API key localStorage management
5. Update ENV for production API base
6. Deploy and test

### Cursor Prompts
```
"Add /a/:id route to apps/app with read-only audit view that fetches GET /v1/audits/:id without auth"

"Add API key input field to dashboard; store in localStorage; include x-api-key header in audit requests"

"Deploy apps/app to Cloudflare Pages; set build output to apps/app/dist; configure custom domain app.optiview.ai"
```

---

## M9 - Citations Lite (Perplexity-First)

**Goal**: Prototype AI inclusion signal with citation tracking

### Scope
1. **Search API Integration**
   - Worker fetch for query seeds (brand name, domain, product)
   - Use SerpAPI for Perplexity/Bing or simple HTML fetch (TOS-safe)
   - Extract citations (URLs) from AI answers or SERP "Sources"

2. **Database Schema**
   - New table: `citations`
     - Fields: `id`, `audit_id`, `engine` (perplexity/bing), `query`, `url`, `title`, `cited_at`
     - Index on `audit_id`, `url`

3. **UI Integration**
   - Add "Citations" tab in dashboard
   - Show if any sources match domain
   - Display: engine, query, cited URL, date
   - Handle 0 results gracefully ("none yet" message)

### Acceptance Criteria
- [ ] Query "Optiview AI visibility" via search API
- [ ] Extract citations from results
- [ ] Store in `citations` table
- [ ] If domain appears, record it ✅
- [ ] UI shows citations tab with results
- [ ] Empty state: "No citations yet"

### Tasks
1. Add `citations` table migration
2. Create search API integration (SerpAPI or HTML parser)
3. Build citation extraction logic
4. Store results in D1
5. Add Citations tab to dashboard UI
6. Test with sample queries

### Notes
- Keep it minimal & TOS-safe
- Even a stub that records 0/none is fine for first pass
- Perplexity-first (most transparent with sources)
- Can expand to other engines later

### Cursor Prompts
```
"Create D1 migration for citations table: id, audit_id, engine, query, url, title, cited_at"

"Add Worker function to query SerpAPI for Perplexity results; extract source URLs from answer"

"Add Citations tab to dashboard; fetch citations for current audit; show engine, query, URL, date; handle empty state"
```

---

## M10 - Entity Graph (sameAs Suggestions)

**Goal**: Strengthen machine understanding via structured links

### Scope
1. **Detection Logic**
   - Parse JSON-LD for Organization schema
   - Check for missing `sameAs` property
   - Flag as recommendation

2. **Recommendation Generator**
   - Propose 3-5 sameAs links:
     - LinkedIn company page
     - Crunchbase profile
     - GitHub organization (if tech company)
     - Wikipedia/Wikidata (if notable)
   - Generate based on domain/company name

3. **UI Integration**
   - Add "Recommendations" section
   - Show copy-paste JSON-LD snippet with `sameAs` array
   - "Mark as applied" toggle (local state)
   - Re-run audit to verify implementation

### Acceptance Criteria
- [ ] Run audit on optiview.ai
- [ ] Detect missing Organization.sameAs
- [ ] Generate 3-5 sameAs suggestions
- [ ] UI shows populated suggestion block
- [ ] Copy-paste JSON-LD snippet works
- [ ] "Mark as applied" toggle functions
- [ ] Re-audit shows sameAs detected

### Tasks
1. Add sameAs detection to audit engine
2. Create recommendation generator
3. Build suggestion UI component
4. Generate JSON-LD snippet with sameAs array
5. Add "Mark as applied" local state
6. Test with real company data

### Example Output
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Optiview",
  "url": "https://optiview.ai",
  "sameAs": [
    "https://www.linkedin.com/company/optiview",
    "https://github.com/optiview",
    "https://www.crunchbase.com/organization/optiview"
  ]
}
```

### Cursor Prompts
```
"Add sameAs detection to audit HTML parser; flag if Organization schema missing sameAs property"

"Create recommendation generator that suggests LinkedIn, Crunchbase, GitHub URLs based on domain"

"Add Recommendations section to dashboard; show copy-paste JSON-LD with sameAs array; add 'Mark as applied' toggle"
```

---

## Implementation Order

1. **M8 - Dashboard** (1-2 days)
   - Immediate value for users
   - Shareable links enable demos
   - API key in UI simplifies onboarding

2. **M10 - Entity Graph** (1-2 days)
   - Easier to implement (no external APIs)
   - Direct audit improvement
   - Dogfood-able on optiview.ai

3. **M9 - Citations** (2-3 days)
   - Requires external API integration
   - TOS compliance research
   - More complex data extraction

---

## Alerts & Monitoring (Quick Wins)

### Audit Failure Alerts
```typescript
// In audit.ts
if (audit.status === 'error' || auditDuration > 90000) {
  console.error('ALERT: Audit failed', {
    domain: property.domain,
    property_id: property.id,
    error: audit.error,
    duration: auditDuration
  });
}
```

### Rate Limit Logging
```typescript
// In index.ts
if (!rateLimit.allowed) {
  console.warn('Rate limit exceeded', {
    project_id: authResult.projectId,
    count: rateLimit.count,
    limit: rateLimit.limit,
    date: new Date().toISOString().split('T')[0]
  });
}
```

### Bot Activity Rollup (Weekly SQL)
```sql
-- Run weekly to monitor bot traffic
SELECT 
  DATE(created_at) AS date,
  bot_type,
  COUNT(*) AS hits
FROM hits
GROUP BY date, bot_type
ORDER BY date DESC, hits DESC
LIMIT 50;
```

---

## Release Cadence

- **v0.9.0-mvp**: M0-M7 Complete ✅ (Current)
- **v0.10.0**: M8 Complete (Dashboard deployed)
- **v0.11.0**: M10 Complete (Entity graph)
- **v0.12.0**: M9 Complete (Citations)
- **v1.0.0**: All features stable, production traffic

---

**Status**: Ready to begin M8-M10 implementation  
**GitHub Issues**: Create 3 issues (M8, M9, M10) with acceptance criteria above

