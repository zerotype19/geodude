# M8 — Deploy Dashboard (app.optiview.ai) + Shareable Audit

**Goal**: Non-devs can run & share audits.

## Tasks

- [ ] Deploy `apps/app` to Cloudflare Pages → app.optiview.ai (output: `/apps/app/dist`)
- [ ] Add API key field in UI (persist to localStorage, header: `x-api-key`)
- [ ] Add route `/a/:audit_id` (read-only view). Fetch `GET /v1/audits/:id` and render scores, pages, issues.
- [ ] Server: GET `/v1/audits/:id` already public ✅ (no auth required)
- [ ] Footer link from marketing → app.optiview.ai

## Acceptance Criteria

- [ ] Navigate to app.optiview.ai, paste API key, run audit, see scores/issues/pages
- [ ] Open share URL `/a/<audit_id>` in a private window without key → renders read-only view
- [ ] Share link works for non-authenticated users

## Out of Scope

- Auth/OAuth
- Projects UI
- Multi-tenant UX

## Technical Notes

### API Key Storage (localStorage)
```typescript
// Store API key
localStorage.setItem('optiview_api_key', apiKey);

// Include in requests
headers: {
  'Content-Type': 'application/json',
  'x-api-key': localStorage.getItem('optiview_api_key') || ''
}
```

### Shareable Route
```typescript
// Route: /a/:audit_id
// Fetch: GET https://api.optiview.ai/v1/audits/:audit_id (no auth)
// Render: Scores, pages, issues (read-only)
```

### Cloudflare Pages Setup
- Build command: `pnpm build` (from apps/app)
- Build output: `apps/app/dist`
- Root directory: `/` (monorepo)
- Environment: `VITE_API_BASE=https://api.optiview.ai`
- Custom domain: app.optiview.ai

## Dependencies

- ✅ API worker deployed with public GET endpoint
- ✅ Dashboard UI built (apps/app)
- [ ] DNS configured for app.optiview.ai

## Testing Checklist

- [ ] API key input persists across refreshes
- [ ] Audit runs successfully with stored key
- [ ] Share link `/a/:id` accessible without auth
- [ ] Scores, issues, pages render correctly
- [ ] Private window test passes

---

**Target Release**: v0.10.0  
**Priority**: High (immediate user value)

