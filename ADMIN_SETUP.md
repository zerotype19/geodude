# 🔐 Admin Dashboard Setup Guide

## Overview

The `/admin` route is a **server-side protected** dashboard that shows operational metrics:
- Audits (7 days)
- Average score (7 days)
- Domains (7 days)
- Citations budget (today)

**Security Features:**
- ✅ Edge-protected with Basic Auth (browser prompt)
- ✅ Server-side API proxy (no secrets in browser)
- ✅ Noindex headers (not searchable)
- ✅ Auto-refresh every 30 seconds
- ✅ Logout functionality

---

## Architecture

### How It Works

1. **Browser** visits `/admin`
2. **Pages Function** intercepts request at edge
3. **Basic Auth** prompt (credentials checked server-side)
4. **React UI** loads and calls `/admin/api/metrics` (relative URL)
5. **Pages Function** proxies to `https://api.optiview.ai/v1/admin/metrics` with server-side Basic Auth
6. **Metrics** returned to browser (no credentials exposed)

### Files

```
apps/app/
├── functions/
│   └── admin/
│       ├── [[path]].ts          # Auth gate + API proxy
│       └── logout.ts             # Force clear auth cache
├── src/
│   └── pages/
│       └── Admin.tsx             # Dashboard UI
└── public/
    └── _headers                  # Noindex for /admin*
```

---

## Setup Steps

### 1. Set Pages Secret (One-Time)

**Option A: Cloudflare Dashboard**
1. Go to: Cloudflare Dashboard → Pages → `geodude-app`
2. Navigate to: Settings → Environment variables
3. Add secret: `ADMIN_BASIC_AUTH`
4. Value: `ops:YOUR_STRONG_PASSWORD` (same format as API worker)
5. Click "Save"

**Option B: CLI (from repo root)**
```bash
cd apps/app
npx wrangler pages secret put ADMIN_BASIC_AUTH --project-name=geodude-app
# Paste: ops:YOUR_STRONG_PASSWORD
```

**Important**: Use the **exact same value** as your API worker's `ADMIN_BASIC_AUTH` secret.

---

### 2. Deploy Dashboard

```bash
cd apps/app
pnpm build
npx wrangler pages deploy dist --project-name=geodude-app --commit-dirty=true --branch=main
```

---

### 3. Test Access

**Visit Admin Page:**
```bash
open https://app.optiview.ai/admin
```

**Expected behavior:**
1. Browser prompts for username and password
2. Enter credentials from `ADMIN_BASIC_AUTH` (e.g., username: `ops`, password: `YOUR_STRONG_PASSWORD`)
3. Dashboard loads showing metrics
4. Auto-refreshes every 30 seconds

**Test API Proxy:**
```bash
# Without auth - should return 401
curl -I https://app.optiview.ai/admin/api/metrics

# With auth - should return 200
curl -I -u ops:YOUR_PASSWORD https://app.optiview.ai/admin/api/metrics
```

---

## Features

### Dashboard Cards

1. **Audits (7d)**: Total audits completed in last 7 days
2. **Avg. Score (7d)**: Average readiness score across all audits
3. **Domains (7d)**: Unique domains audited in last 7 days

### Budget Bar

Shows daily citations budget consumption:
- **Green**: Remaining > 150 (healthy)
- **Yellow**: Remaining 50-150 (moderate)
- **Red**: Remaining < 20 (low, consider increasing)

### Auto-Refresh

Dashboard automatically refreshes every 30 seconds to show latest metrics.

### Manual Refresh

Click "Refresh" button to force immediate update.

### Logout

Click "Logout" button or visit `/admin/logout` to clear browser's cached credentials.

---

## Security

### What's Protected

- `/admin` - Dashboard UI (requires auth)
- `/admin/*` - All admin routes (requires auth)
- `/admin/api/*` - API proxy endpoints (requires auth)

### How Credentials Are Handled

1. **Browser prompt**: User enters username/password
2. **Edge validation**: Pages Function checks against `ADMIN_BASIC_AUTH` secret
3. **Server-side proxy**: Pages Function adds auth header when calling API
4. **No exposure**: Credentials never appear in browser JavaScript or DevTools

### Headers Applied

```
X-Robots-Tag: noindex, nofollow    # Not searchable
Cache-Control: no-store             # No caching
WWW-Authenticate: Basic             # Browser auth prompt
```

---

## Troubleshooting

### Issue: 401 Unauthorized

**Symptom**: Browser keeps prompting for credentials

**Fixes**:
1. Verify `ADMIN_BASIC_AUTH` secret is set in Pages project
   ```bash
   npx wrangler pages secret list --project-name=geodude-app
   ```
2. Ensure value matches format: `username:password` (no spaces)
3. Try clearing browser auth cache: Visit `/admin/logout`
4. Check value matches API worker secret exactly

---

### Issue: Blank Dashboard

**Symptom**: Dashboard loads but shows no data

**Fixes**:
1. Check browser console for errors (F12 → Console)
2. Verify API is responding:
   ```bash
   curl -u ops:PASSWORD https://api.optiview.ai/v1/admin/metrics
   ```
3. Check Pages Function logs:
   ```bash
   npx wrangler pages deployment tail --project-name=geodude-app
   ```
4. Ensure API worker has `ADMIN_BASIC_AUTH` secret set

---

### Issue: CORS Errors

**Symptom**: Console shows CORS errors when calling `/admin/api/metrics`

**Fix**: This shouldn't happen since we're using a **relative URL** (`/admin/api/metrics`), which is proxied server-side. If you see CORS errors:
1. Verify you're not hardcoding `https://api.optiview.ai` in React code
2. Check that Pages Function is deployed and active
3. Ensure you're accessing via `app.optiview.ai`, not `localhost`

---

### Issue: Logout Doesn't Work

**Symptom**: Still authenticated after clicking "Logout"

**Why**: Browser caches Basic Auth credentials per domain/realm

**Fixes**:
1. Close all browser tabs for `app.optiview.ai`
2. Clear browser cache/cookies
3. Use private/incognito window for testing
4. Restart browser

---

## Usage

### Daily Operations

Visit `/admin` to check:
- ✅ Daily audits count (should be > 0 on active days)
- ✅ Average score trend (improving over time)
- ✅ Budget consumption (should be < 100/day)

### Weekly Review

Every Monday (after weekly cron):
1. Check audits count (should show Monday's batch)
2. Verify average score (look for trends)
3. Review budget (ensure it reset to 200)

### Incident Response

If alerts trigger:
1. Visit `/admin` to see current metrics
2. Check budget bar (if red, increase limit)
3. Review audit count (if 0, cron may have failed)
4. Cross-reference with `/status` endpoint

---

## API Proxy Endpoints

The Pages Function proxies these endpoints:

| Admin Path | API Upstream | Auth Required |
|------------|--------------|---------------|
| `/admin/api/metrics` | `/v1/admin/metrics` | Yes (server-side) |

**How to add more:**

Edit `apps/app/functions/admin/[[path]].ts`:

```typescript
// Add after existing proxy logic
if (url.pathname === "/admin/api/status") {
  const res = await fetch("https://api.optiview.ai/status", {
    headers: { accept: "application/json" }
  });
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": "application/json" }
  });
}
```

Then update `Admin.tsx` to fetch and display the new data.

---

## Development

### Local Testing

**Note**: Pages Functions don't run in local dev (`pnpm dev`). To test:

1. Deploy to a preview environment:
   ```bash
   pnpm build
   npx wrangler pages deploy dist --project-name=geodude-app --branch=preview
   ```

2. Visit the preview URL (check Cloudflare dashboard)

3. Or mock the auth locally by commenting out the auth check temporarily

### Adding New Metrics

1. **Backend**: Add metric to `/v1/admin/metrics` endpoint
2. **Proxy**: Already handled by wildcard proxy
3. **Frontend**: Update `Metrics` type in `Admin.tsx`
4. **UI**: Add new `<Card>` component or section

---

## Best Practices

### Security

- ✅ Use strong passwords (20+ characters, random)
- ✅ Rotate credentials every 90 days
- ✅ Don't share credentials in Slack/email
- ✅ Use separate credentials for staging/production
- ✅ Monitor for failed auth attempts (check logs)

### Monitoring

- ✅ Check daily during first week
- ✅ Set up alerts for budget < 20
- ✅ Review trends weekly
- ✅ Screenshot metrics for reports

### Performance

- ✅ Auto-refresh is lightweight (< 1KB response)
- ✅ Server-side proxy adds < 50ms latency
- ✅ Edge caching disabled (always fresh data)

---

## Future Enhancements

### Nice-to-Haves

- [ ] **Grafana/Datadog Integration**: Export metrics to external dashboards
- [ ] **Audit History Chart**: Line graph showing score trends
- [ ] **Real-time Logs**: Stream worker logs in admin UI
- [ ] **Alert Configuration**: Set custom thresholds in UI
- [ ] **Multi-User Support**: Different admin accounts with roles

### Implementation Notes

All enhancements should maintain:
- Server-side authentication (no secrets in browser)
- Noindex headers (admin pages not searchable)
- Edge-first design (minimal backend load)

---

## Reference Links

**Production:**
- Dashboard: https://app.optiview.ai/admin
- Logout: https://app.optiview.ai/admin/logout

**Monitoring:**
- API Metrics: https://api.optiview.ai/v1/admin/metrics (requires auth)
- System Status: https://api.optiview.ai/status (public)
- Budget: https://api.optiview.ai/v1/citations/budget (public)

**Admin:**
- Cloudflare Pages: https://dash.cloudflare.com → Pages → geodude-app
- GitHub Repo: https://github.com/zerotype19/geodude

---

## Quick Command Reference

```bash
# Set secret (one-time)
cd apps/app
npx wrangler pages secret put ADMIN_BASIC_AUTH --project-name=geodude-app

# Deploy dashboard
pnpm build
npx wrangler pages deploy dist --project-name=geodude-app --branch=main

# Test access
curl -I -u ops:PASSWORD https://app.optiview.ai/admin/api/metrics

# View logs
npx wrangler pages deployment tail --project-name=geodude-app

# List secrets
npx wrangler pages secret list --project-name=geodude-app
```

---

**Last Updated:** 2025-01-09  
**Version:** v1.0.0  
**Status:** Production Ready

