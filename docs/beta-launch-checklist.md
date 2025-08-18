# Beta Launch – Readiness Checklist

## 0) Environment & Config Parity

- [ ] **Wrangler parity**: wrangler.toml and production env have identical non-secret values (no "0" vs "false" drift)
  - Verify: dump `/admin/env-check` in prod and diff against local
  - Fix: normalize booleans to "true"/"false" strings; remove unused flags

- [ ] **Required env present**: SMTP (magic link), Slack webhook (alerts), KV bindings (rules/metrics), D1 binding, PUBLIC_APP_URL, PUBLIC_API_URL
  - Verify: `/admin/env-check` returns `ok: true`

- [ ] **Demo data OFF in prod**: turn off synthetic generators for partner projects
  - Fix: gate with DEMO_MODE=0; don't seed demo orgs in prod

## 1) Security & Compliance

- [ ] **CORS allowlist is property-scoped**
  - Verify: Responses to `/api/events` include `Access-Control-Allow-Origin: https://<property.domain>` only (never `*`)
  - Fix/Implement: In the ingestion handler, resolve property_id → domain; set ACAO to that origin. Reject mismatches with 403 origin_denied

- [ ] **OPTIONS preflight everywhere**
  - Verify: `OPTIONS /api/events`, `/api/conversions` return 204 with correct CORS headers
  - Fix: Add a shared preflight branch

- [ ] **Cookie-auth POSTs guarded**
  - Verify: Admin/API-key/Rules endpoints check Origin/Referer host matches PUBLIC_APP_URL
  - Fix: Add `requireSameSiteOrigin(req)` to all cookie-auth POST routes

- [ ] **PII scrubber enabled**
  - Verify: Ingest drops email/phone/SSN/password-like keys; values truncated to limits
  - Fix: Ensure sanitizer runs before DB insert; add tests for typical payloads

- [ ] **Logging is safe**
  - Verify: No secrets (API key hash/headers) or full payloads are logged; request IDs used
  - Fix: Redact headers/body, include x-optiview-request-id

- [ ] **Robots & headers**
  - Verify: `/robots.txt` blocks `/admin/*` and `/api/*`; CSP & Referrer-Policy present on app pages, not on tag.js responses

## 2) Data Model & Migrations

- [ ] **Schema canonical**:
  - `interaction_events.project_id TEXT`
  - `content_assets.property_id INTEGER, project_id TEXT`
  - `ai_sources.slug TEXT UNIQUE`
  - `conversion_event` rebuilt schema
  - `visitor`, `session_v1`, `session_event_map` present
  - Verify: `PRAGMA table_info` & `PRAGMA foreign_key_check` clean

- [ ] **Indexes exist for hot paths**:
  - `interaction_events(project_id, occurred_at)`, `(project_id, ai_source_id, occurred_at)`
  - `ai_referrals(project_id, detected_at)`
  - `conversion_event(project_id, occurred_at)`
  - session tables
  - Fix: Add missing ones; re-run migrations

- [ ] **KV manifests present**:
  - `rules:manifest`, `rules:heuristics`, and `sources:index`
  - Verify: `/admin/health` shows rules manifest version and non-zero length

## 3) Tag Runtime (Hosted /v1/tag.js)

- [ ] **apiBase detection works**
  - Verify: `?debug=1` logs the correct apiBase; no console errors

- [ ] **Batching, backoff, sendBeacon**
  - Verify: pageview sent, batched clicks fire; beacon used on unload

- [ ] **Sessions on by default**
  - Verify: `ov_vid` (365d) and `ov_sid` set; journey API shows linked events

- [ ] **Event size & frequency limits**
  - Verify: Batch size clamp (1–50), flushMs clamp (500–10000), payload ≤ ~32KB
  - Fix: truncate metadata server-side (already implemented), reject oversize with 413

- [ ] **No secrets in the browser**
  - Verify: only `data-key-id`, no secret/hash

## 4) API Contracts & Rate Limits

- [ ] **Public ingestion** (`/api/events`, `/api/conversions`):
  - Verify: header `x-optiview-key-id` required; 60 rpm per key enforced; 400 on schema invalid

- [ ] **Read APIs** (Events/Content/Referrals/Conversions/Funnels/Journeys/Citations/Recommendations):
  - Verify: all accept `project_id` + `window`; return ISO strings; obey 60 rpm; cache headers present

- [ ] **Admin APIs gated**: rules, sources catalog, health, purge
  - Verify: admin middleware enforced; 30 rpm per IP; CORS locked

## 5) Observability & Alerts

- [ ] **`/admin/health` shows everything**: KV, D1, cron, error rate, latency p50/p95, sessions, recommendations, tag_served_5m, pending suggestions, conversions/referrals counters

- [ ] **Slack alerts wired**:
  - Verify: thresholds—error rate >1% AND ≥500 events (5m), p95 >200ms AND ≥500 events, cron stall >90m; 15-min dedupe works

- [ ] **Request correlation**: `x-optiview-request-id` on responses and logs

## 6) Onboarding & Project Ops

- [ ] **Project creation flow**: Only org owners/global admins can create
  - Verify: POST `/api/projects` validates org membership, normalizes domain (no localhost/IP), optionally creates property & key

- [ ] **Install wizard happy path**:
  - Select/create property
  - Select/create API key (masked reveal + copy)
  - Generated snippet reflects selections
  - Verification turns green after events

- [ ] **Invites**: Accept flow works; role inheritance enforced (member cannot invite owner)

- [ ] **Deep links**:
  - From API Keys → `/install?project_id=…&key_id=…` preselects
  - From Create Project → optional property_id

## 7) Navigation & UX polish (final pass)

- [ ] **Header**: one project switcher, one user menu; no horizontal scroll at 1280/1440/1920px
  - Verify: Setup items under gear menu; Health hidden if not admin

- [ ] **Page defaults**: `/` → last project's Events (if data), else `/install`
  - Verify: localStorage `ov:lastProjectId` respected

- [ ] **Empty states everywhere**: helpful CTAs to `/install`, `/sources`, `/api-keys`

- [ ] **Dates & timezones**: show human-friendly local times with ISO tooltips; bucketing correct per window

## 8) Partner Readiness (Runbook)

- [ ] **`docs/partner-onboarding.md` created** with the following steps:
  - Create org + owner (magic link)
  - Create project (name + optional domain); owner-only
  - Add property (apex like example.com or exact site domain)
  - Create API key → copy key id
  - Install hosted tag from `/install` (preselected)
  - Verify events (widget → green)
  - Enable sources needed for partner (Sources page)
  - Sanity dashboards: Events, Content, Journeys; confirm AI-influenced numbers move
  - Slack alerts: confirm channel receives a test alert
  - Data retention: confirm defaults (per plan) set; cron purge logs

## 9) Backups & Exports (minimum viable)

- [ ] **CSV exports working** for events/referrals/conversions with cursor pagination and per-user throttle (1 req/sec)

- [ ] **Manual DB export doc**: add a script/README to run `wrangler d1 export` to R2 or local file (weekly)
  - (Nice-to-have; acceptable manual for beta)

## 10) Final Smoke Tests (automate simple pings)

- [ ] **Add `/admin/selfcheck`** (admin-only) that returns:
  ```json
  {
    "ok": true,
    "kv": true,
    "d1": true,
    "cron_last_run_sec": <number>,
    "tag_etag_present": true,
    "events_ingest_2xx": true,
    "rules_manifest_version": <int>
  }
  ```

- [ ] **Hook a tiny cron** (every 5m) to call it and alert Slack if `ok:false`

## Small targeted fixes to implement now (if not already)

- [ ] **Origin/Referer enforcement** on cookie-auth POST endpoints
- [ ] **OPTIONS handler** for all public APIs
- [ ] **Property domain normalization** (lowercase, strip www?—decide policy; document it) and reject IP/localhost
- [ ] **Turn off demo generator** in prod; make sure it can never target partner projects
- [ ] **Health page**: add a little "Copy diagnostics JSON" button for support

## Nice-to-have (can follow within the beta)

- [ ] **Global overview** (internal): `/admin/overview` showing top projects by events/min, error rate, p95, active keys
- [ ] **Key abuse guard**: soft cap per key (e.g., 5k/min) with backoff + Slack alert
- [ ] **Data delete by project endpoint** (admin) for quick resets during beta

## What to send back after completing this checklist

A brief report pasting:
- `/admin/env-check`
- `/admin/health` (sessions + tag_served counts visible)
- `/admin/selfcheck`

Confirmation that three partner sites ran through the runbook and show live events/Journeys.

---

## Implementation Status

**Last Updated**: [Date]  
**Completed Items**: 0/[Total]  
**Ready for Beta**: ❌  

### Recent Changes
- [Add implementation notes here as items are completed]

### Blockers
- [List any blockers that need resolution]

### Next Actions
- [List immediate next steps]
