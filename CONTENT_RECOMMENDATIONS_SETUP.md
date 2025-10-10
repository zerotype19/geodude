# AI Content Recommendations Feature

## Overview

This feature uses **Cloudflare Browser Rendering** + **GPT-4o** to generate ready-to-paste Schema.org JSON-LD and content improvements for any page on your site.

**Status:** ✅ Code complete, ready for deployment

---

## Architecture

### Components

1. **API Worker** (`packages/api-worker`)
   - `POST /v1/reco` - Create recommendation job
   - `GET /v1/reco/:id` - Poll job status

2. **Queue Consumer** (`packages/reco-consumer`)
   - Renders page with Browser Rendering
   - Extracts structured facts (H1/H2/H3, meta, JSON-LD, FAQ pairs)
   - Calls GPT-4o with strict JSON schema
   - Validates output (Ajv + Schema.org sanity checks)
   - Caches results in KV (7 days)

3. **Frontend** (`apps/app`)
   - Button on Page Report → Recommendations tab
   - Polls job status every 1.2s
   - Displays generated JSON-LD + content suggestions

---

## Setup Steps

### 1. Create Required Infrastructure

#### Create KV Namespace
```bash
cd packages/api-worker
npx wrangler kv:namespace create RECO_CACHE
```

**Output:**
```
Created namespace with id "abc123..."
```

**Update `packages/api-worker/wrangler.toml`:**
```toml
[[kv_namespaces]]
binding = "RECO_CACHE"
id = "abc123..."  # Use the ID from output above
```

**Also update `packages/reco-consumer/wrangler.toml` with the same ID.**

#### Create Queue
```bash
npx wrangler queues create reco-queue
```

---

### 2. Set Secrets

#### Consumer Worker Secret
```bash
cd packages/reco-consumer
npx wrangler secret put OPENAI_API_KEY
```

**Paste your OpenAI API key when prompted** (use the same key already set in `geodude-api`).

**Note:** The API worker (`geodude-api`) already has `OPENAI_API_KEY` configured as a secret, so you only need to add it to the consumer worker.

---

### 3. Run Database Migration

```bash
cd geodude
npx wrangler d1 migrations apply optiview_db --remote
```

**This creates the `reco_jobs` table.**

---

### 4. Deploy Workers

#### Deploy API Worker
```bash
cd packages/api-worker
npm run deploy
```

#### Deploy Consumer Worker
```bash
cd packages/reco-consumer
pnpm install  # First time only
npm run deploy
```

#### Deploy Frontend
```bash
cd apps/app
npm run build
npx wrangler pages deploy dist --project-name=geodude-app
```

---

## Configuration

### Environment Variables (`packages/api-worker/wrangler.toml`)

```toml
OPENAI_API_BASE = "https://api.openai.com/v1"
OPENAI_MODEL = "gpt-4o"
RECO_ALLOWED_DOMAINS = "cologuard.com,www.cologuard.com,learnings.org,www.learnings.org"
```

**Add your domains to the allowlist for security.**

### Consumer Settings (`packages/reco-consumer/wrangler.toml`)

```toml
[[queues.consumers]]
queue = "reco-queue"
max_batch_size = 1      # Process one job at a time
max_batch_timeout = 30  # 30 seconds
max_retries = 2         # Retry failed jobs twice
```

---

## How It Works

### 1. User Clicks "Generate Content"

Frontend calls:
```
POST https://api.optiview.ai/v1/reco
{
  "url": "https://www.cologuard.com/faq",
  "audit_id": "abc123",
  "page_id": "xyz789"
}
```

Response:
```json
{
  "ok": true,
  "id": "job-uuid",
  "status": "queued"
}
```

### 2. Job Enters Queue

Queue consumer picks up the job and:

1. **Renders page** using Cloudflare Browser Rendering
   - Blocks images/media/fonts for speed
   - Waits for JS to execute
   - Extracts HTML content

2. **Extracts facts** in browser context:
   ```javascript
   {
     title: "FAQ | Cologuard",
     h1: "Frequently Asked Questions",
     h2: ["Who can use Cologuard?", "How does it work?", ...],
     faqPairs: [
       { q: "Who can use Cologuard?", a: "Cologuard is intended for..." },
       ...
     ],
     existingLD: ["<json-ld-1>", "<json-ld-2>"],
     canonical: "https://www.cologuard.com/faq"
   }
   ```

3. **Calls GPT-4o** with structured JSON schema:
   ```javascript
   {
     model: "gpt-4o",
     temperature: 0.25,
     response_format: { 
       type: "json_schema",
       json_schema: { strict: true, schema: { ... } }
     }
   }
   ```

4. **Validates output** (Ajv + Schema.org checks)

5. **Caches result** in KV (7 days)

6. **Updates DB** with status=done

### 3. Frontend Polls for Status

Every 1.2 seconds:
```
GET https://api.optiview.ai/v1/reco/job-uuid
```

When `status === 'done'`, display result.

---

## Model Output Format

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
            "text": "Cologuard is intended for adults..."
          }
        }
      ]
    }
  ],
  "content_suggestions": [
    {
      "title": "Add a descriptive H1",
      "priority": "High",
      "note": "Ensure one H1 summarizes the page scope."
    }
  ]
}
```

---

## UI Flow

1. User navigates to Page Report → Recommendations tab
2. Sees "🤖 AI Content Generation" card with button
3. Clicks "Generate Content"
4. Button shows status: "Queued..." → "Rendering..." → "Analyzing..."
5. When complete, displays:
   - Detected Intent badge
   - Missing Schemas pills
   - Suggested JSON-LD (with Copy/Validate buttons)
   - Content Suggestions (with Priority badges)
6. User can click "Generate New" to reset and try again

---

## Safety & Guardrails

### Domain Allowlist
Only configured domains can request content generation:
```toml
RECO_ALLOWED_DOMAINS = "cologuard.com,www.cologuard.com"
```

Returns 403 for other domains.

### Schema.org Validation
Consumer validates output before saving:
- FAQPage must have `mainEntity` array
- Each Question must have `name` and `acceptedAnswer.text`
- All JSON-LD must have `@context` and `@type`

### Caching
De-duplicates by URL + HTML hash:
- Same content = instant cache hit (no API call)
- 7-day TTL (604,800 seconds)

### Browser Rendering Optimization
- Blocks images, media, fonts, CSS
- Only loads JS + HTML
- 30-second timeout

---

## Testing

### Test with cologuard.com

1. Run an audit for `cologuard.com`
2. Navigate to any page in the Pages tab
3. Click "Recommendations" tab
4. Click "Generate Content"
5. Watch status updates
6. Verify JSON-LD and suggestions appear

### Check Logs

**API Worker:**
```bash
cd packages/api-worker
npx wrangler tail
```

**Consumer Worker:**
```bash
cd packages/reco-consumer
npx wrangler tail
```

Look for:
```
[reco] Processing job abc-123 for https://www.cologuard.com/faq
[reco] Launching browser for https://...
[reco] Extracted facts: Frequently Asked Questions, 12 Q&A pairs, 2 LD-JSON
[reco] Calling gpt-4o for https://...
[reco] Job abc-123 completed successfully
```

---

## Troubleshooting

### "Service unavailable"
- Check `RECO_PRODUCER` binding exists in API worker
- Run: `npx wrangler queues list` to verify queue exists

### "Domain not allowed"
- Add domain to `RECO_ALLOWED_DOMAINS` in `wrangler.toml`
- Redeploy API worker

### Jobs stuck in "queued"
- Check consumer worker is deployed: `npx wrangler deployments list --name geodude-reco-consumer`
- Check queue consumer binding in `packages/reco-consumer/wrangler.toml`

### "OpenAI error 401"
- Set `OPENAI_API_KEY` secret (see Step 2 above)
- Verify key is valid: `echo $OPENAI_API_KEY | wrangler secret put OPENAI_API_KEY`

### Jobs failing with "Browser Rendering" errors
- Verify `BROWSER` binding is enabled in Cloudflare Dashboard
- See `BROWSER_RENDERING_SETUP.md` for setup guide

### Cache not working
- Check `RECO_CACHE` KV namespace ID matches in both workers
- Run: `npx wrangler kv:namespace list` to verify

---

## Cost Estimates

### Per Generation

| Service | Cost |
|---------|------|
| Browser Rendering | ~$0.001/page render |
| GPT-4o API | ~$0.02-0.05/call (varies by page size) |
| KV writes | ~$0.0000005/write |
| **Total** | **~$0.02-0.05 per generation** |

### With Caching

- Cache hit = $0 (instant)
- Cache duration = 7 days
- Same page requested 10x = only 1 API call

---

## Future Enhancements

- [ ] Batch generation (process all pages in audit)
- [ ] Custom prompt templates per domain
- [ ] Diff view (show before/after JSON-LD)
- [ ] Export to CMS integration
- [ ] A/B test suggestions

---

## File Reference

### Backend
- `db/migrations/0009_reco_jobs.sql` - D1 table
- `packages/api-worker/src/index.ts` - API routes (lines 501-633)
- `packages/api-worker/wrangler.toml` - Queue producer binding
- `packages/reco-consumer/src/index.ts` - Queue consumer worker
- `packages/reco-consumer/wrangler.toml` - Queue consumer config

### Frontend
- `apps/app/src/pages/PageReport.tsx` - UI button + polling

---

## Status

✅ **Ready for production**
- [x] D1 migration created
- [x] Queue + KV bindings configured
- [x] API routes implemented
- [x] Consumer worker complete
- [x] Frontend UI wired
- [ ] Deployed + tested end-to-end (pending user test)

**Next:** Follow setup steps above to deploy! 🚀

