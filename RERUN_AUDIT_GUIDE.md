# Re-run Audit - Operator's Guide

Quick reference for using the one-click audit re-run feature.

## 🚀 How to Use

### 1. Ensure API Key is Set

The Re-run button only appears if you have an API key in the browser.

**Option A: Via Onboarding Flow**
1. Visit `https://app.optiview.ai/onboard`
2. Create project → Add domain → Verify
3. API key is automatically saved to `localStorage`

**Option B: Manual (DevTools)**
```javascript
// Paste in browser DevTools console:
localStorage.setItem('ov_api_key', '<your_api_key>')
```

### 2. Open Any Audit Page

Example: `https://app.optiview.ai/a/aud_1760044010908_9rdkq1uvx`

### 3. Click "🔄 Re-run Audit"

Button location: **Top-right of page header**

- **Success**: Shows green toast → Auto-navigates to new audit
- **Error**: Shows red toast with error message (click to dismiss)

---

## 🧪 API Quick Test

Test the endpoint directly from terminal:

```bash
# Re-run an owned audit
curl -s -X POST "https://api.optiview.ai/v1/audits/<AUDIT_ID>/rerun" \
  -H "x-api-key: <YOUR_API_KEY>" \
  -H "content-type: application/json" | jq

# Expected response:
{
  "ok": true,
  "id": "aud_1760064218004_r9n4s3p4n",
  "rerun_of": "aud_1760064192453_wfdmgntu1",
  "property_id": "prop_demo",
  "domain": "optiview.ai",
  "url": "https://app.optiview.ai/a/aud_1760064218004_r9n4s3p4n"
}
```

---

## 🔐 What's Enforced

### Ownership Verification
- Audit → Property → Project chain is verified
- Only the project owner can re-run their audits
- **403 Forbidden** if API key doesn't own the audit's project

### Authentication Required
- Must provide valid `x-api-key` header
- **401 Unauthorized** without API key
- Public share links stay read-only (no button shown)

### Rate Limiting
- Same daily limit as starting a fresh audit
- Default: 10 audits per day per project
- **429 Rate Limit Exceeded** when budget exhausted
- Resets at 00:00 UTC daily

---

## 🛠️ Troubleshooting

### Button Not Visible

**Symptom**: Re-run button doesn't appear on audit page

**Solution**: API key missing from localStorage

```javascript
// Check if key exists:
console.log(localStorage.getItem('ov_api_key'))

// If null, set it:
localStorage.setItem('ov_api_key', '<your_api_key>')

// Refresh page
```

### 403 Forbidden Error

**Symptom**: "You do not own this audit" error

**Cause**: Trying to re-run an audit started by a different project

**Solution**: 
- Verify you're using the correct API key
- Check the audit's original property/project
- Start a fresh audit for your own property instead

### 429 Rate Limited

**Symptom**: "Daily audit budget reached. Try again after 00:00 UTC."

**Cause**: Exceeded daily audit limit (10 per day by default)

**Solutions**:
1. **Wait**: Limit resets at midnight UTC
2. **Check Admin**: Visit `/admin` to see current usage
3. **Check API**:
   ```bash
   curl -s "https://api.optiview.ai/v1/admin/metrics" \
     -u "admin:<password>" | jq '.audits_7d'
   ```

### Still on Old Page

**Symptom**: Button clicked but page doesn't change

**Causes**:
- Network hiccup during request
- Rate limit or auth error (check toast notification)
- Browser blocked navigation

**Solution**:
1. Check for error toast (top-right)
2. Open DevTools → Console for errors
3. Try clicking button again
4. Check network tab for failed requests

---

## 💡 Use Cases

### 1. Content Update Verification
```
Scenario: Updated page content
Action: Open old audit → Click Re-run
Result: New audit shows updated word counts
```

### 2. Deployment Verification
```
Scenario: Deployed code changes
Action: Re-run audit after deployment
Result: Verify improvements in new audit
```

### 3. Issue Resolution
```
Scenario: Fixed reported issues
Action: Re-run to confirm fixes
Result: Issues removed in new audit
```

### 4. Regular Monitoring
```
Scenario: Weekly site health check
Action: Bookmark audit URL → Re-run weekly
Result: Track changes over time
```

### 5. Before/After Comparison
```
Scenario: Testing SEO improvements
Action: Keep old audit open → Re-run → Compare tabs
Result: Side-by-side score comparison
```

---

## 🎨 UI Features

### Loading State
- Button shows spinner during request
- Text changes to "Re-running…"
- Button disabled to prevent double-taps
- Gray background indicates disabled state

### Success Notification
- Green toast appears (top-right)
- Shows new audit ID
- Auto-dismisses after navigation
- Brief delay to show message (800ms)

### Error Notification
- Red toast appears (top-right)
- Shows error message
- Click to dismiss manually
- Auto-dismisses after 5 seconds
- Special message for rate limits

---

## 📊 API Responses

### Success (201 Created)
```json
{
  "ok": true,
  "id": "aud_1760064218004_r9n4s3p4n",
  "rerun_of": "aud_1760064192453_wfdmgntu1",
  "property_id": "prop_demo",
  "domain": "optiview.ai",
  "url": "https://app.optiview.ai/a/aud_1760064218004_r9n4s3p4n"
}
```

### Unauthorized (401)
```json
{
  "error": "Unauthorized",
  "message": "Valid x-api-key header required"
}
```

### Forbidden (403)
```json
{
  "error": "Forbidden",
  "message": "You do not own this audit"
}
```

### Not Found (404)
```json
{
  "error": "Audit not found"
}
```

### Rate Limited (429)
```json
{
  "error": "Rate limit exceeded",
  "message": "Daily limit of 10 audits reached. Current count: 10",
  "retry_after": "24 hours"
}
```

**Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
Retry-After: 86400
```

---

## 🔍 Monitoring

### Check Current Usage

**Via Admin Dashboard**:
```
1. Visit: https://app.optiview.ai/admin
2. Login with ADMIN_BASIC_AUTH
3. View "Audits (7d)" metric
```

**Via API**:
```bash
curl -s "https://api.optiview.ai/v1/admin/metrics" \
  -u "admin:<password>" | jq
```

**Via Logs**:
```bash
# Watch re-run requests live
npx wrangler tail geodude-api | grep "rerun"

# Watch audit completion
npx wrangler tail geodude-api | grep "audit completed"
```

---

## 🚨 Common Errors

| Error | Code | Cause | Fix |
|-------|------|-------|-----|
| Unauthorized | 401 | No API key | Add key to localStorage |
| Forbidden | 403 | Wrong project | Use correct API key |
| Not Found | 404 | Invalid audit ID | Check audit exists |
| Rate Limited | 429 | Daily limit hit | Wait for UTC reset |
| Server Error | 500 | Backend issue | Check logs, retry |

---

## 📈 Performance

### Expected Timing
- **API Response**: 1-3 seconds
- **Audit Completion**: 30-60 seconds (30 pages)
- **Toast Display**: 800ms before navigation
- **Total UX**: ~2 seconds from click to new page

### Network Optimization
- Request uses existing rate limit cache
- No additional database queries beyond ownership
- Reuses runAudit() infrastructure
- CORS pre-flight cached

---

## 🔄 Workflow Example

**Scenario**: SEO improvement verification

```
1. Initial State
   - Audit shows score: 65/100
   - Issues: 12 total
   - URL: /a/aud_old

2. Make Changes
   - Add H1 tags
   - Expand thin content
   - Implement JSON-LD

3. Click Re-run
   - Green toast appears
   - Shows: "Redirecting to audit aud_new..."
   - Auto-navigates after 800ms

4. View Results
   - New score: 89/100 ✅
   - Issues: 3 total ✅
   - Time elapsed: < 1 minute

5. Optional Comparison
   - Open old audit in new tab
   - Compare scores side-by-side
   - Document improvements
```

---

## 🔗 Related Documentation

- **Browser Rendering**: `BROWSER_RENDERING_SETUP.md`
- **API Reference**: API worker source
- **Onboarding Guide**: `docs/partner-onboarding.md`
- **Admin Dashboard**: `/admin` endpoint

---

## 📝 Notes

- Re-run creates a **new** audit (not updates old one)
- Original audit remains unchanged
- Both audits linked via `rerun_of` field (API only)
- No automatic comparison UI yet (manual)
- No audit history chain UI yet (manual)

---

## 🎯 Quick Reference

```bash
# Test endpoint
curl -X POST https://api.optiview.ai/v1/audits/<ID>/rerun \
  -H "x-api-key: <KEY>" | jq

# Check API key
console.log(localStorage.getItem('ov_api_key'))

# Set API key
localStorage.setItem('ov_api_key', '<KEY>')

# View admin metrics
curl -u admin:<PASS> https://api.optiview.ai/v1/admin/metrics | jq

# Watch logs
npx wrangler tail geodude-api
```

---

**Last Updated**: 2025-10-10  
**Version**: v0.16 + Re-run Feature

