# Changelog

All notable changes to the Geodude project will be documented in this file.

## [0.9.0-mvp] - 2025-10-09

### 🎉 MVP Release - Complete Rebuild

Complete project rebuild with all core features operational.

### M0 - Scaffolding
- Monorepo structure with pnpm + TurboRepo
- Workspace configuration (apps/, packages/, db/)
- Build system with parallel execution

### M1 - Marketing Live
- Static site deployed to optiview.ai (Cloudflare Pages)
- robots.txt with AI crawler allowlist (GPTBot, ClaudeBot, PerplexityBot, CCBot, etc.)
- sitemap.xml with structured URLs
- JSON-LD structured data (Organization + FAQ schemas)
- Security headers (_headers)

### M2 - API Heartbeat
- API worker deployed to api.optiview.ai
- `/health` endpoint (public)
- D1 database connected (6 tables)
- Legacy endpoint deprecation (410 with Deprecation/Sunset headers)
- Migration tracking system (db/MIGRATIONS.md)

### M3 - Collector Online
- Collector worker deployed
- `/px` endpoint - 1x1 GIF tracking
- Bot classification (9 bot types via User-Agent regex)
- IP hashing (SHA-256, privacy-first, no raw IPs stored)
- Hit logging to D1

### M4 - Audit v1
- Complete audit engine
- Robots.txt analysis
- Sitemap parsing
- Page crawling (max 30, 1 RPS rate limit)
- HTML parsing (title, H1, JSON-LD, FAQ detection)
- 4-factor scoring model:
  - Crawlability (40%)
  - Structured Data (30%)
  - Answerability (20%)
  - Trust (10%)
- Issue detection (critical/warning/info severity levels)
- Audit persistence (audits, audit_pages, audit_issues tables)

### M5 - Dashboard Shell
- Vite + React + TypeScript dashboard (apps/app)
- Tailwind CSS styling
- Audit UI components:
  - Property input form
  - Circular score gauges (Overall, Crawlability, Structured, Answerability, Trust)
  - Issues table (severity badges, type, message, page URL)
  - Pages table (URL, status, title, JSON-LD, FAQ, load time)
- Environment: VITE_API_BASE=https://api.optiview.ai
- Build output: dist/ (149KB JS, gzipped: 47KB)

### M6 - Docs Hub
- 3 documentation pages:
  - `/docs/audit.html` - Audit checks explained
  - `/docs/bots.html` - AI bots tracked
  - `/docs/security.html` - Privacy & security policy
- FAQ JSON-LD schema on all docs (dogfooding)
- Sitemap updated with all docs
- Home page footer links
- SEO optimization

### M7 - Ops Polish
- **Authentication**:
  - x-api-key header required for /v1/audits/start
  - D1-backed API key validation
  - Property ownership verification
  - 401 Unauthorized for missing/invalid keys
- **Rate Limiting**:
  - KV-backed daily limits per project
  - Default: 10 audits/day (configurable via AUDIT_DAILY_LIMIT)
  - 429 Too Many Requests with X-RateLimit headers
  - Counter key: rl:{project_id}:{YYYY-MM-DD}
  - 2-day TTL on counters
- **Cron Re-Audits**:
  - Weekly schedule (Mondays 6am UTC: `0 6 * * 1`)
  - Audits all verified properties
  - 1 RPS throttle
  - Console logging for monitoring
  - Error handling per property

### Infrastructure
- Cloudflare Workers (2 deployed)
- Cloudflare Pages (1 deployed, 1 ready)
- D1 Database (optiview_db, 6 tables)
- KV Storage (RATE_LIMIT_KV)
- Migrations: 2 applied (0001_init, 0002_seed)

### Database Schema
- `projects` - Project management
- `properties` - Domain tracking
- `hits` - Traffic/bot events
- `audits` - Audit orchestration
- `audit_pages` - Page-level results
- `audit_issues` - Issues discovered

### Documentation
- README.md - Project overview
- SUMMARY.md - Complete work summary
- DEPLOYMENT.md - Deployment guide
- STATUS.md - Current status
- PROGRESS_CHECK.md - M0-M4 verification
- VALIDATION_REPORT.md - M0-M4 validation
- M5-M7_COMPLETE.md - M5-M7 completion report
- QA_REPORT.md - Final QA results
- db/MIGRATIONS.md - Migration tracking
- CHANGELOG.md - This file

### Testing
- All smoke tests passing ✅
- Auth: 401 without key, 200 with valid key ✅
- Rate limit: 429 after limit exceeded ✅
- Bot detection: GPTBot confirmed ✅
- Audit score: 0.99/1.0 (optiview.ai) ✅

### Guardrails Maintained
- AUDIT_MAX_PAGES = 30 ✅
- 1 RPS crawl throttle ✅
- No background queues (cron only) ✅
- Simple x-api-key auth (no OAuth yet) ✅

---

## [Unreleased]

### Planned - M8 (Dashboard Deployment)
- Deploy apps/app to app.optiview.ai
- Shareable audit links (/a/:id)
- API key input in UI (localStorage)

### Planned - M9 (Citations Lite)
- Perplexity-first citation tracking
- New table: citations
- UI: Citations tab

### Planned - M10 (Entity Graph)
- Organization.sameAs detection
- Recommendation generator
- JSON-LD snippet suggestions

---

## Release Notes

### v0.9.0-mvp Summary
**Complete rebuild** of Geodude AI audit platform with full feature parity and production-ready infrastructure.

**Key Achievements**:
- 🚀 Production deployment ready
- 🔐 Authentication & rate limiting
- 📊 Audit score: 0.99/1.0
- 🤖 Bot tracking (9 types)
- 📚 Documentation hub (3 pages)
- 🎨 Dashboard UI (ready to deploy)
- ⏰ Automated re-audits (cron)

**Tech Stack**:
- Cloudflare Workers (edge compute)
- D1 Database (SQLite at edge)
- KV Storage (rate limiting)
- Cloudflare Pages (static hosting)
- React + TypeScript + Tailwind (dashboard)

**Status**: ✅ Production Ready

