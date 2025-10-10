# Quick Start: Content Recommendations

## ✅ What's Been Done

All code is complete and committed! Here's what was implemented:

1. **D1 Migration**: `reco_jobs` table for job tracking
2. **API Routes**: `POST /v1/reco`, `GET /v1/reco/:id`
3. **Queue Consumer Worker**: Browser Rendering + GPT-4o extraction
4. **Frontend UI**: Button + polling on Page Report → Recommendations tab
5. **Brave AI Modal Fix**: White background, smaller fonts, compact table

---

## 🚀 Deploy (4 Steps)

### Step 1: Create Infrastructure (One-time)

```bash
cd /Users/kevinmcgovern/geodude/geodude/packages/api-worker

# Create KV namespace
npx wrangler kv:namespace create RECO_CACHE

# Note the ID from output, then update both:
# - packages/api-worker/wrangler.toml (line 17)
# - packages/reco-consumer/wrangler.toml (line 12)
# Replace "placeholder-will-be-created" with actual ID

# Create queue
npx wrangler queues create reco-queue
```

### Step 2: Set Secret (Consumer Only)

```bash
# Consumer Worker (API worker already has it)
cd packages/reco-consumer
npx wrangler secret put OPENAI_API_KEY
# Paste your OpenAI API key (same as geodude-api)
```

**Note:** `geodude-api` already has `OPENAI_API_KEY` set, so you only need to add it to the consumer worker.

### Step 3: Run Migration

```bash
cd /Users/kevinmcgovern/geodude/geodude
npx wrangler d1 migrations apply optiview_db --remote --config packages/api-worker/wrangler.toml
```

### Step 4: Deploy Everything

```bash
cd /Users/kevinmcgovern/geodude/geodude
./deploy-content-reco.sh
```

**Or manually:**
```bash
# Consumer
cd packages/reco-consumer
pnpm install
npm run deploy

# API
cd ../api-worker
npm run deploy

# Frontend
cd ../../apps/app
npm run build
npx wrangler pages deploy dist --project-name=geodude-app
```

---

## 🧪 Test

1. Go to https://app.optiview.ai
2. Run audit for `cologuard.com`
3. Click any page → "Recommendations" tab
4. Click "🤖 Generate Content"
5. Watch status: Queued → Rendering → Analyzing → Done (20-30 seconds)
6. See:
   - Detected Intent badge
   - Missing Schemas pills
   - Suggested JSON-LD (ready to copy)
   - Content Suggestions with priorities

---

## 🔧 Troubleshoot

| Issue | Fix |
|-------|-----|
| "Service unavailable" | Check `RECO_PRODUCER` binding, run `npx wrangler queues list` |
| "Domain not allowed" | Add to `RECO_ALLOWED_DOMAINS` in `packages/api-worker/wrangler.toml` |
| Jobs stuck "queued" | Check consumer deployed: `npx wrangler deployments list --name geodude-reco-consumer` |
| "OpenAI error 401" | Set `OPENAI_API_KEY` secret (see Step 2) |
| Browser errors | Verify Browser Rendering enabled (see `BROWSER_RENDERING_SETUP.md`) |

**Check logs:**
```bash
# API Worker
cd packages/api-worker && npx wrangler tail

# Consumer Worker  
cd packages/reco-consumer && npx wrangler tail
```

---

## 📝 What You'll See

**Button:**
```
🤖 AI Content Generation
Let GPT-4o analyze this page and suggest ready-to-paste Schema.org JSON-LD + content improvements

[Generate Content]
```

**Result Example (FAQ page):**
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
            "text": "Cologuard is intended for..."
          }
        }
      ]
    }
  ],
  "content_suggestions": [
    {
      "title": "Add descriptive H1",
      "priority": "High",
      "note": "Ensure one H1 summarizes the page scope."
    }
  ]
}
```

---

## 💰 Cost

- **Per generation**: ~$0.02-0.05 (GPT-4o + Browser Rendering)
- **Cache hit**: $0 (instant, 7-day TTL)
- **Same page 10x**: Only 1 API call

---

## 📚 Full Docs

See `CONTENT_RECOMMENDATIONS_SETUP.md` for:
- Architecture details
- How it works (step-by-step)
- Safety guardrails
- Advanced configuration
- Future enhancements

---

**Status:** ✅ Ready to deploy!
**Next:** Run Step 1-4 above, then test with cologuard.com

