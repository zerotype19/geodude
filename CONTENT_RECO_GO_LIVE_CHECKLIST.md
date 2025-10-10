# Content Recommendations: Go-Live Checklist

## ✅ Hardening Upgrades Complete

All production-ready safeguards are now implemented:

- ✅ **Medical brand-safe prompt** (6th-8th grade, screening vs diagnostic language)
- ✅ **Enhanced FAQ extraction** (ARIA accordions + role=button + fallback to H2/H3)
- ✅ **Cache bypass** (⚡ refresh checkbox in UI)
- ✅ **SSRF protection** (blocks localhost, private IPs, metadata endpoints)
- ✅ **Enhanced Schema.org validation** (character limits, URL host matching)
- ✅ **Improved error handling** and validation messages

---

## 🚀 Go / No-Go Checklist (10 minutes)

### 1. Bindings & Secrets ✓

```bash
# Check BROWSER binding
curl https://api.optiview.ai/v1/debug/env
# Expected: {"ok":true,"hasBrowser":true}

# Verify KV namespace ID in both workers
cat packages/api-worker/wrangler.toml | grep -A2 "RECO_CACHE"
cat packages/reco-consumer/wrangler.toml | grep -A2 "RECO_CACHE"
# IDs should match (not "placeholder-will-be-created")

# Check queue exists
npx wrangler queues list | grep reco-queue

# Verify consumer deployed
npx wrangler deployments list --name geodude-reco-consumer
```

**Manual checks:**
- [ ] `BROWSER` shows `true` at `/v1/debug/env`
- [ ] `RECO_CACHE` KV ID present in **both** workers (matching IDs)
- [ ] Queue `reco-queue` exists
- [ ] Consumer worker `geodude-reco-consumer` deployed and healthy
- [ ] `OPENAI_API_KEY` set on **API** worker (already done)
- [ ] `OPENAI_API_KEY` set on **consumer** worker (⚠️ action required)

### 2. Allowlist Configuration ✓

```bash
# Check allowed domains
cat packages/api-worker/wrangler.toml | grep RECO_ALLOWED_DOMAINS
```

**Expected:**
```toml
RECO_ALLOWED_DOMAINS = "cologuard.com,www.cologuard.com,learnings.org,www.learnings.org"
```

- [ ] `cologuard.com` included in allowlist

### 3. Database Migration ✓

```bash
# Check if reco_jobs table exists
npx wrangler d1 execute optiview_db --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='reco_jobs';"
```

**Expected:** Returns `reco_jobs`

- [ ] `reco_jobs` table exists in D1 (remote)

### 4. CORS Configuration ✓

The API worker automatically allows all origins via `corsHeaders`. No action needed.

- [ ] API worker allows `app.optiview.ai` origin (✓ automatic)

### 5. Browser Rendering ✓

```bash
# Check recent audits
npx wrangler tail geodude-api --format pretty | grep "\[render\]"
```

**Look for:**
- `[render] browser: https://... -> 800+ words` (JS-heavy pages)
- `[render] html: https://... -> 200 words` (fallback for simple pages)

- [ ] Logs show `mode: browser` for JS-heavy pages
- [ ] Fallback to HTML only on errors (not all the time)

---

## 🧪 90-Second Smoke Test

```bash
# Create job
curl -sX POST https://api.optiview.ai/v1/reco \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.cologuard.com/faq"}' | tee /tmp/job.json && jq . /tmp/job.json

# Expected response:
# {
#   "ok": true,
#   "id": "abc-123-...",
#   "status": "queued",
#   "refresh": false
# }

# Poll for status
jid=$(jq -r .id /tmp/job.json)
echo "Job ID: $jid"

# Watch status (runs every 1 second, Ctrl+C when done)
watch -n 1 "curl -s https://api.optiview.ai/v1/reco/$jid | jq '.job.status'"

# Expected progression:
# "queued" → "rendering" → "analyzing" → "done" (20-30 seconds)

# When done, fetch result
curl -s https://api.optiview.ai/v1/reco/$jid | jq -r '.job.result' | jq

# Expected output:
# {
#   "detected_intent": "FAQPage",
#   "missing_schemas": ["FAQPage", "WebPage"],
#   "suggested_jsonld": [
#     {
#       "@context": "https://schema.org",
#       "@type": "FAQPage",
#       "url": "https://www.cologuard.com/faq",
#       "mainEntity": [ ... ]
#     }
#   ],
#   "content_suggestions": [ ... ]
# }
```

### Success Criteria

- [ ] Job created successfully (status 202)
- [ ] Status progresses: `queued` → `rendering` → `analyzing` → `done`
- [ ] Total time: 20-40 seconds
- [ ] Result includes:
  - [ ] `detected_intent` = "FAQPage" or "WebPage"
  - [ ] `suggested_jsonld` array with valid Schema.org JSON-LD
  - [ ] `content_suggestions` with priority/note fields
- [ ] FAQPage has 5+ questions in `mainEntity`
- [ ] All URLs in JSON-LD match `cologuard.com` domain

---

## 🛡️ Validation Tests

### SSRF Protection
```bash
# Should reject localhost
curl -sX POST https://api.optiview.ai/v1/reco \
  -H 'content-type: application/json' \
  -d '{"url":"http://localhost:3000/test"}' | jq

# Expected: Job queues but consumer fails with "Invalid URL" error

# Should reject private IP
curl -sX POST https://api.optiview.ai/v1/reco \
  -H 'content-type: application/json' \
  -d '{"url":"http://192.168.1.1"}' | jq

# Expected: Job queues but consumer fails with "Invalid URL" error
```

### Domain Allowlist
```bash
# Should reject non-allowed domain
curl -sX POST https://api.optiview.ai/v1/reco \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/page"}' | jq

# Expected: 403 Forbidden with "Domain example.com not allowed" message
```

### Cache Bypass
```bash
# First run (cache miss)
curl -sX POST https://api.optiview.ai/v1/reco \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.cologuard.com/faq"}' | jq -r '.id' | xargs -I{} bash -c 'sleep 30 && curl -s https://api.optiview.ai/v1/reco/{} | jq ".job.input_hash"' | tee /tmp/hash1.txt

# Second run (cache hit - should be instant)
curl -sX POST https://api.optiview.ai/v1/reco \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.cologuard.com/faq"}' | jq -r '.id' | xargs -I{} bash -c 'sleep 5 && curl -s https://api.optiview.ai/v1/reco/{} | jq ".job.status"'
# Expected: "done" in < 5 seconds

# Third run with refresh (bypasses cache)
curl -sX POST https://api.optiview.ai/v1/reco \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.cologuard.com/faq","refresh":true}' | jq

# Expected: takes 20-30 seconds again (fresh generation)
```

---

## 📊 Expected Results for Test Pages

### `/faq` Page (e.g., cologuard.com/faq)

```json
{
  "detected_intent": "FAQPage",
  "missing_schemas": ["FAQPage", "WebPage"],
  "suggested_jsonld": [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "url": "https://www.cologuard.com/faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Who can use Cologuard?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Cologuard is intended for adults at average risk..."
          }
        }
        // ... 5-20 questions
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "url": "https://www.cologuard.com/faq",
      "name": "Frequently Asked Questions | Cologuard",
      "description": "Plain-language answers about at-home collection, who the test is for, and what to do next."
    }
  ],
  "content_suggestions": [
    {
      "title": "Add a descriptive H1",
      "priority": "High",
      "note": "Ensure one H1 summarizes the page scope (e.g., 'Cologuard FAQ')."
    }
  ]
}
```

### Homepage or Simple Page

```json
{
  "detected_intent": "WebPage",
  "missing_schemas": ["WebPage"],
  "suggested_jsonld": [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "url": "https://www.cologuard.com/",
      "name": "Cologuard® Colon Cancer Screening Test | At-Home Collection",
      "description": "Learn how at-home stool-based screening is collected and processed, with links to eligibility and test information."
    }
  ],
  "content_suggestions": [
    {
      "title": "Add concise meta description",
      "priority": "Low",
      "note": "Keep to ~155 characters; summarize value and next actions."
    }
  ]
}
```

---

## 🔧 Troubleshooting

| Issue | Check | Fix |
|-------|-------|-----|
| "Service unavailable" | `npx wrangler queues list` | Create queue: `npx wrangler queues create reco-queue` |
| "Domain not allowed" | `RECO_ALLOWED_DOMAINS` in wrangler.toml | Add domain, redeploy API worker |
| Jobs stuck "queued" | `npx wrangler deployments list --name geodude-reco-consumer` | Deploy consumer worker |
| "OpenAI error 401" | Consumer worker has `OPENAI_API_KEY` | Run: `cd packages/reco-consumer && npx wrangler secret put OPENAI_API_KEY` |
| Browser errors | `/v1/debug/env` shows `hasBrowser: false` | Enable Browser Rendering in Cloudflare Dashboard |
| Cache not working | KV namespace IDs match | Check both wrangler.toml files |
| Invalid Schema.org | Check validation errors in logs | Model may need prompt refinement |

---

## 📝 Pre-Production Checklist

Before enabling for customers:

- [ ] All smoke tests pass
- [ ] Validation tests pass (SSRF, allowlist, cache)
- [ ] Expected results match for `/faq` and homepage
- [ ] Consumer worker logs show no errors
- [ ] Cost tracking enabled (Cloudflare Analytics)
- [ ] Rate limiting configured (if needed)
- [ ] Customer domains added to `RECO_ALLOWED_DOMAINS`
- [ ] Documentation shared with team
- [ ] Rollback plan documented

---

## 🚀 Rollout Plan

### Stage 1: Internal Testing (Week 1)
- Enable for `cologuard.com`, `learnings.org` only
- Limit: 5 generations/day per domain
- Monitor: error rates, validation failures, costs

### Stage 2: Beta (Week 2-3)
- Add 3-5 friendly customers to allowlist
- Gather feedback on JSON-LD quality
- Iterate on prompt if needed

### Stage 3: General Availability (Week 4+)
- Remove domain allowlist (or expand significantly)
- Add per-org rate limiting (e.g., 20/day)
- Enable "⚡ Bypass cache" for all users
- Add cost dashboard in `/admin`

---

## 📊 Success Metrics

Track these in production:

- **Jobs created**: Total per day/week
- **Success rate**: `done` / `total` (target: >95%)
- **Average duration**: Queued → Done (target: <30s)
- **Cache hit rate**: Cached / Total (target: >70% after warm-up)
- **Validation errors**: Should be <1%
- **Cost per generation**: Should be ~$0.02-0.05
- **Customer satisfaction**: NPS from users who try the feature

---

## 🎯 Go / No-Go Decision

**GO** if:
- ✅ All smoke tests pass
- ✅ Validation tests pass
- ✅ Expected results match examples
- ✅ No critical errors in logs
- ✅ Cost estimates acceptable
- ✅ Team trained on troubleshooting

**NO-GO** if:
- ❌ Jobs failing >20% of the time
- ❌ Browser Rendering not working
- ❌ Schema.org validation errors
- ❌ SSRF protection not working
- ❌ Cost concerns

---

**Status:** ✅ Ready for smoke testing!  
**Next:** Run the 90-second smoke test above and verify results.

