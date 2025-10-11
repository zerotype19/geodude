# Phase G: QA Checklist & Test Script

**Date**: January 11, 2025  
**Version**: Parts 1-3 Complete  
**Status**: ✅ Ready for Testing

---

## 🎯 Test Overview

Phase G introduces real AI crawler tracking with:
1. ✅ Backend infrastructure (DB + API)
2. ✅ Audit response enrichment
3. ✅ Frontend UI (chips, columns, panels)
4. ✅ Documentation

---

## 📋 QA Checklist

### Part 1: Backend Infrastructure

#### ✅ D1 Schema
- [ ] Table `ai_crawler_hits` exists
- [ ] Indexes created (domain_ts, domain_path, domain_bot_ts)
- [ ] Can insert test records

#### ✅ API Endpoints
- [ ] `POST /v1/botlogs/ingest` requires admin auth (401 without)
- [ ] Accepts valid JSON payloads
- [ ] Returns `{accepted, rejected, reasons}`
- [ ] `GET /v1/audits/:id/crawlers` returns summary

#### ✅ Bot Detection
- [ ] Detects GPTBot, Claude-Web, PerplexityBot, etc.
- [ ] Rejects non-AI bot traffic
- [ ] Handles various UA formats

---

### Part 2: Audit Integration

#### ✅ API Response
- [ ] `GET /v1/audits/:id` includes `site.crawlers`
- [ ] `site.crawlers` has `{total, byBot, lastSeen}`
- [ ] Each page has `aiHits` field
- [ ] Returns 0 when no data (not null/undefined)

#### ✅ Scoring
- [ ] Crawlability score includes +2 bonus for real hits
- [ ] `breakdown.crawlability.realCrawlerBonus` exists
- [ ] Bonus only applies when `crawlersTotal30d > 0`

---

### Part 3: Frontend UI

#### ✅ PublicAudit Header
- [ ] Shows "AI Bot Traffic (30d)" chip when data exists
- [ ] Displays top 4 bots with counts
- [ ] Ellipsis (...) shows for 5+ bots
- [ ] Hidden when `total === 0`

#### ✅ Pages Table
- [ ] "AI Hits" column visible
- [ ] Green/bold for pages with hits
- [ ] Gray for pages with 0 hits
- [ ] Numbers accurate per page

#### ✅ Page Report
- [ ] "AI Crawlers (30d)" panel shows when data exists
- [ ] Table shows bot / hits / last seen
- [ ] Bottom shows page-specific hit count
- [ ] Hidden when no site-level data

#### ✅ Admin Dashboard
- [ ] "Real AI hits (30d)" summary row
- [ ] Per-bot badge pills
- [ ] Top 5 bots shown
- [ ] Green styling

---

## 🧪 Test Script

### Step 1: Verify Backend Deployment

```bash
# Check API worker version
curl -s https://api.optiview.ai/status | jq '.version'

# Expected: Latest version with Phase G
```

### Step 2: Test Ingestion Endpoint (Auth)

```bash
# Should fail without auth
curl -X POST https://api.optiview.ai/v1/botlogs/ingest \
  -H "content-type: application/json" \
  -d '{"data": []}'

# Expected: {"error": "Unauthorized"}
```

### Step 3: Ingest Sample Data

**Note**: Replace `PASSWORD` with actual admin password.

```bash
curl -u ops:PASSWORD -X POST https://api.optiview.ai/v1/botlogs/ingest \
  -H "content-type: application/json" \
  -d '{
    "data": [
      {
        "domain": "learnings.org",
        "path": "/",
        "user_agent": "GPTBot/1.0",
        "status": 200,
        "timestamp": "2025-01-11T10:00:00Z"
      },
      {
        "domain": "learnings.org",
        "path": "/about",
        "user_agent": "Claude-Web/1.0",
        "status": 200,
        "timestamp": "2025-01-11T09:17:00Z"
      },
      {
        "domain": "learnings.org",
        "path": "/about",
        "user_agent": "PerplexityBot/1.0",
        "status": 200,
        "timestamp": "2025-01-10T15:30:00Z"
      },
      {
        "domain": "learnings.org",
        "path": "/faq",
        "user_agent": "GPTBot/1.0",
        "status": 200,
        "timestamp": "2025-01-09T12:00:00Z"
      }
    ]
  }'

# Expected: {"ok": true, "accepted": 4, "rejected": 0, "reasons": {}}
```

### Step 4: Query Crawler Summary

```bash
# Get learnings.org audit ID
AUDIT_ID=$(curl -s 'https://api.optiview.ai/v1/audits' | jq -r '.audits[] | select(.domain == "learnings.org") | .id' | head -1)

echo "Testing audit: $AUDIT_ID"

# Query crawler data
curl -s "https://api.optiview.ai/v1/audits/$AUDIT_ID/crawlers?days=30" | jq .

# Expected:
# {
#   "ok": true,
#   "summary": {
#     "total": 4,
#     "byBot": {
#       "gptbot": 2,
#       "claude-web": 1,
#       "perplexitybot": 1
#     },
#     "lastSeen": { ... }
#   },
#   "byPage": [
#     {"path": "/", "hits": 1, "byBot": {"gptbot": 1}},
#     {"path": "/about", "hits": 2, "byBot": {"claude-web": 1, "perplexitybot": 1}},
#     {"path": "/faq", "hits": 1, "byBot": {"gptbot": 1}}
#   ]
# }
```

### Step 5: Verify Audit Response

```bash
# Check audit includes crawler data
curl -s "https://api.optiview.ai/v1/audits/$AUDIT_ID" | jq '{
  crawlers: .site.crawlers,
  firstPageHits: .pages[0].aiHits,
  scoreBonus: .scores.breakdown.crawlability.realCrawlerBonus
}'

# Expected:
# {
#   "crawlers": {
#     "total": 4,
#     "byBot": {"gptbot": 2, "claude-web": 1, "perplexitybot": 1},
#     "lastSeen": {...}
#   },
#   "firstPageHits": 1,
#   "scoreBonus": 2
# }
```

### Step 6: Frontend UI Verification

1. **Open Audit**:
   ```
   https://app.optiview.ai/a/$AUDIT_ID
   ```

2. **Check Header Chip**:
   - Look for "AI Bot Traffic (30d): gptbot:2 • claude-web:1 • perplexitybot:1"
   - Should be green/bold text below Brave AI chip

3. **Check Pages Table**:
   - Scroll to "AI Hits" column (rightmost)
   - "/" should show **1** (green/bold)
   - "/about" should show **2** (green/bold)
   - "/faq" should show **1** (green/bold)
   - Other pages should show **0** (gray)

4. **Check Page Report**:
   - Click on any page with hits (e.g., "/about")
   - Scroll to "AI Crawlers (30d)" panel
   - Should show table with GPTBot, Claude-Web, PerplexityBot
   - Bottom should say "Page hits for this URL: 2"

5. **Check Admin Dashboard**:
   ```
   https://app.optiview.ai/admin
   ```
   - Look for "Real AI hits (30d): **4**"
   - Should show badge pills for each bot
   - Green styling with counts

---

## 🐛 Troubleshooting

### No Data Showing

**Problem**: Crawler summary returns 0 hits after ingestion.

**Solutions**:
1. Check domain matches property domain exactly
2. Verify timestamps are within 30 days
3. Confirm User-Agent was detected (check `rejected` count)
4. Query D1 directly:
   ```sql
   SELECT * FROM ai_crawler_hits WHERE domain = 'learnings.org' ORDER BY ts DESC LIMIT 10;
   ```

### Scoring Bonus Not Applied

**Problem**: Crawlability score doesn't increase after ingesting logs.

**Root Cause**: Scores are computed at audit time, not retroactively.

**Solutions**:
1. Re-run the audit after ingesting logs
2. Or manually verify `site.crawlers.total > 0` is being returned

### UI Not Updating

**Problem**: Frontend shows old data or 0 hits.

**Solutions**:
1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Clear site data in DevTools
3. Check network tab for API response
4. Verify frontend deployment:
   ```bash
   curl -I https://app.optiview.ai/ | grep -i cloudflare
   ```

### Auth Failures

**Problem**: 401 Unauthorized when uploading logs.

**Solutions**:
1. Verify admin password is correct
2. Use Basic Auth format: `ops:PASSWORD`
3. Check `ADMIN_BASIC_AUTH_USER` and `ADMIN_BASIC_AUTH_PASS` secrets in Wrangler

---

## 📊 Success Criteria

**Phase G Parts 1-3 are ✅ COMPLETE when**:

1. ✅ Sample data ingests successfully (4/4 accepted)
2. ✅ `/crawlers` endpoint returns accurate summary
3. ✅ Audit response includes `site.crawlers` and `pages[].aiHits`
4. ✅ Crawlability score adds +2 bonus for real traffic
5. ✅ UI header chip displays bot counts
6. ✅ Pages table shows "AI Hits" column
7. ✅ Page report shows "AI Crawlers (30d)" panel
8. ✅ Admin dashboard shows "Real AI hits (30d)" summary
9. ✅ Documentation (`docs/ai-bot-logs.md`) is accurate

---

## 🎉 Completion Status

- [x] Part 1: Backend Infrastructure
- [x] Part 2: Audit Integration & Scoring
- [x] Part 3: Frontend UI
- [ ] Part 4: Full QA with Real Data

**Next Steps**:
1. Run this QA script with real/sample data
2. Fix any discovered issues
3. Mark Part 4 complete
4. Begin Phase H (if planned) or close Phase G

---

**Last Updated**: January 11, 2025  
**Test Environment**: Production (api.optiview.ai, app.optiview.ai)

