# Changelog

All notable changes to Optiview will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v0.15.0] - 2025-10-09

### Added
- **Email Reports**: Beautiful HTML email reports with weekly AI Index Readiness summaries
  - Responsive email template with gradient header
  - Score delta from previous audit ("+5 from last week")
  - Score breakdown bars (Crawlability, Structured Data, Answerability, Trust)
  - Top 3 issues by severity with badges
  - Citations count callout
  - Top 3 AI bot activity (last 7 days with hit counts)
  - CTA button to full audit report
- **Manual Email Endpoint**: `POST /v1/audits/:id/email` for testing
- **Cron Ready**: Monday 06:00 UTC scheduled email reports
- **Resend Integration**: Official email API with graceful degradation

### Technical
- `packages/api-worker/src/email.ts` - 500+ line HTML template
- `packages/api-worker/src/index.ts` - Email endpoint with full data assembly
- FROM_EMAIL configured in wrangler.toml

---

## [v0.14.0] - 2025-10-09

### Added
- **Real Citations**: Bing Web Search API integration for citation detection
  - 3 query variations per domain (site:, company, reviews)
  - Smart filtering (eTLD+1 matching, target domain only)
  - Deduplication by URL
  - Configurable limit (5 citations per query)
  - Lazy fetch on first audit view
  - Store in D1 citations table
- **Citations Endpoint**: `GET /v1/audits/:id/citations` (read-only)
- **Enhanced UI**: Citations tab with query grouping
- **TOS Compliance**: 1200ms timeouts, 350ms delays, official Bing API

### Changed
- Citations tab now displays real data from Bing
- Citations load automatically when viewing audit

### Technical
- `packages/api-worker/src/citations-bing.ts` - Bing API client
- `packages/api-worker/src/citations.ts` - Smart fetch + cache logic
- `apps/app/src/components/Citations.tsx` - Lazy load + grouped display
- BING_SEARCH_ENDPOINT and CITATIONS_MAX_PER_QUERY configured

---

## [v0.13.0] - 2025-10-09

### Added
- **Multi-Project Onboarding**: Complete self-service onboarding flow
  - 3-step wizard at `/onboard`
  - Create project → Auto-generate API key
  - Add domain → Get verification instructions (DNS TXT or HTML)
  - Verify ownership → Run first audit
- **Project API**: `POST /v1/projects` (create project with API key)
- **Property API**: `POST /v1/properties` (add domain with verification)
- **Verification API**: `POST /v1/properties/:id/verify` (DNS TXT or HTML file)
- **ULID-based IDs**: `prj_*`, `prop_*` for new entities
- **DNS over HTTPS**: Cloudflare 1.1.1.1 JSON API for domain verification

### Changed
- Projects table: added `owner_email` and `api_key` columns
- Properties table: added `verify_method`, `verify_token`, `verified` columns
- Onboarding wizard integrated into dashboard navigation

### Technical
- `packages/api-worker/src/onboarding.ts` - Project/property creation + verification
- `apps/app/src/routes/Onboard.tsx` - 3-step wizard UI
- D1 migration: `db/migrations/0004_onboarding.sql`

---

## [v0.12.0] - 2025-10-08

### Added
- **Citations Infrastructure**: D1 table and API stub for citation tracking
- **Citations Tab**: Empty state in dashboard for future citation data
- D1 migration: `db/migrations/0003_citations.sql`

---

## [v0.11.0] - 2025-10-08

### Added
- **Entity Graph Recommendations**: sameAs URL suggestions for Organization schema
  - Detects missing sameAs properties in JSON-LD
  - Suggests 3-5 authoritative URLs (Wikipedia, LinkedIn, Crunchbase, etc.)
  - Copy-paste JSON-LD snippet
  - "Mark as applied" toggle (localStorage)
- **Organization Detection**: Extract org name from JSON-LD or H1

### Technical
- `packages/api-worker/src/entity.ts` - Entity graph logic
- `packages/api-worker/src/html.ts` - Organization extraction
- `apps/app/src/components/EntityRecommendations.tsx` - UI component

---

## [v0.10.0] - 2025-10-08

### Added
- **Dashboard**: React dashboard at `https://app.optiview.ai`
  - Run new audits with property_id
  - View audit results (scores, issues, pages)
  - Tab navigation (Overview, Issues, Pages, Entity, Citations)
- **Public Share Links**: `/a/:id` routes for shareable audit results
- **API Client**: `apps/app/src/services/api.ts` with typed endpoints
- **Score Cards**: Visual score display with color coding
- **Issues Table**: Sortable table with severity badges
- **Pages Table**: Crawled pages with title and status
- **API Key Hook**: `useApiKey()` for localStorage persistence

### Changed
- Vite + React + TypeScript setup for dashboard
- React Router for client-side routing
- Security headers (`_headers`) and SPA fallback (`_redirects`)

### Technical
- `apps/app/` - Complete dashboard application
- Deployed to Cloudflare Pages (production branch)
- Custom domain: `app.optiview.ai`

---

## [v0.9.0] - 2025-10-07

### Added
- **Production Baseline**: Initial stable release
- API Worker with audit engine
- Collector Worker for 1x1 GIF tracking
- D1 Database with full schema
- Rate limiting (10 audits/day per project)
- Cron jobs (Monday 06:00 UTC)

### Technical
- Cloudflare Workers + Pages + D1 + KV
- Custom domains: `api.optiview.ai`, `collector.optiview.ai`
- Security: API key auth, CORS, rate limits

---

## Release Notes

### Beta Roadmap Complete ✅
All planned beta features (v0.13-v0.15) have been delivered:
- Self-service onboarding (no SQL required)
- Real citations from Bing Web Search
- Beautiful weekly email reports
- Entity graph recommendations
- Public share links

### Setup Required
Before full production use:
1. **Bing Search API**: Set `BING_SEARCH_KEY` secret
2. **Resend**: Set `RESEND_API_KEY` secret and verify domain
3. **Owner Emails**: Configure `owner_email` on projects for email reports

See `V0_14_V0_15_QA_GUIDE.md` for detailed setup and QA steps.

---

**Next**: v0.16.0+ (TBD after beta feedback)
