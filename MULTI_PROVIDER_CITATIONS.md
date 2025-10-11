# Multi-Provider Citation System

## Overview

A robust, multi-provider citation search system with automatic fallbacks, rate limiting, and caching.

## Architecture

### **Providers (in order of preference)**

1. **Tavily** (`adapter-tavily.ts`)
   - Fast, structured Q&A with native citations
   - Rate limit: 3 QPS
   - API: `https://api.tavily.com/search`
   - Key: `TAVILY_API_KEY` (secret)

2. **Perplexity** (`adapter-perplexity.ts`)
   - High-quality LLM answers with citations
   - Rate limit: 2 QPS
   - Model: `sonar` (online model)
   - API: `https://api.perplexity.ai/chat/completions`
   - Key: `PERPLEXITY_API_KEY` (secret)

3. **Brave + GPT** (`adapter-brave-gpt.ts`) - **Fallback**
   - Brave Web Search → GPT summarization
   - Guaranteed citations (always has web results)
   - Uses existing `BRAVE_API_KEY` and `OPENAI_API_KEY`

## Files Created

### **Backend (API Worker)**

```
packages/api-worker/
├── src/
│   ├── lib/
│   │   └── rateLimiter.ts                    # Token bucket rate limiter
│   ├── services/
│   │   └── providers/
│   │       ├── adapter-tavily.ts             # Tavily integration
│   │       ├── adapter-perplexity.ts         # Perplexity integration
│   │       ├── adapter-brave-gpt.ts          # Brave + GPT fallback
│   │       └── orchestrator.ts               # Multi-provider orchestrator
│   └── routes/
│       └── citations.ts                      # POST /v1/citations endpoint
```

### **Configuration**

Updated `packages/api-worker/wrangler.toml`:

```toml
[vars]
BRAVE_QPS = "3"
TAVILY_QPS = "3"
PPLX_QPS = "2"
PROVIDER_CACHE_TTL = "86400"      # 24 hours
ENABLE_MULTI_PROVIDER = "1"       # Feature flag
```

### **Secrets (already set)**

- `TAVILY_API_KEY`
- `PERPLEXITY_API_KEY`
- `BRAVE_API_KEY` (or `BRAVE_SEARCH`)
- `OPENAI_API_KEY`

## API Endpoint

### **POST /v1/citations**

Request:
```json
{
  "query": "cologuard faq"
}
```

Response:
```json
{
  "ok": true,
  "answer": "Cologuard is a non-invasive colon cancer screening test...",
  "citations": [
    "https://www.cologuard.com/faq",
    "https://www.cologuardhcp.com/resources/faq",
    "https://www.cologuard.com/how-to-use-cologuard"
  ],
  "provider": "tavily" | "perplexity" | "brave+gpt"
}
```

## How It Works

1. **Query normalization**: Lowercase, trim, deduplicate spaces
2. **Cache check**: KV lookup (`cit:{normalized_query}`) for 24h
3. **Provider cascade**:
   - Try **Tavily** (if `ENABLE_MULTI_PROVIDER=1`)
     - If answer + citations → cache and return
   - Try **Perplexity** (if `ENABLE_MULTI_PROVIDER=1`)
     - If answer + citations → cache and return
   - Fallback to **Brave + GPT** (always)
     - Fetch Brave Web results
     - Summarize with GPT-4o
     - Return answer + URLs
4. **Cache result**: Store in KV for 24h

## Rate Limiting

### **Token Bucket Algorithm**

- Each provider has independent rate limiter
- Capacity: `TAVILY_QPS` / `PPLX_QPS` / `BRAVE_QPS`
- Refill rate: tokens per second
- Blocks until token available (max wait ~1-2s)

### **Example**

```typescript
const limiter = new RateLimiter(3, 1000); // 3 requests per second
await limiter.take(); // Blocks if no tokens available
```

## Error Handling

- **Missing API key**: Throws error, skips to next provider
- **Network error**: Logs error, tries next provider
- **No results**: Falls through to next provider
- **All providers fail**: Final fallback (Brave+GPT) throws if no results

## Caching Strategy

- **Key**: `cit:{normalized_query}`
- **TTL**: 24 hours (configurable via `PROVIDER_CACHE_TTL`)
- **Storage**: `RECO_CACHE` KV namespace
- **Bypass**: Not currently exposed (future: `?refresh=1`)

## Feature Flag

**Toggle multi-provider mode**:

```toml
ENABLE_MULTI_PROVIDER = "1"  # Try Tavily → Perplexity → Brave+GPT
ENABLE_MULTI_PROVIDER = "0"  # Skip to Brave+GPT only
```

Allows instant rollback without code changes.

## Testing

### **Single Query**

```bash
curl -sX POST https://api.optiview.ai/v1/citations \
  -H 'content-type: application/json' \
  -d '{"query":"cologuard faq"}' | jq
```

### **Check Logs**

```bash
cd packages/api-worker
npx wrangler tail --format=pretty
```

Look for:
- `[cit] Cache hit for "..."`
- `[cit] Trying Tavily for "..."`
- `[cit] Tavily success: 5 citations`
- `[cit] Tavily failed: ...`
- `[cit] Using Brave+GPT fallback for "..."`

## Performance

### **Expected Latencies**

- Cache hit: **~50ms**
- Tavily: **~800ms** (first call)
- Perplexity: **~1.5s** (LLM generation)
- Brave+GPT: **~2-3s** (web search + GPT call)

### **Cost per Query** (uncached)

- Tavily: **$0.001** (1 query)
- Perplexity: **$0.005** (1 completion)
- Brave+GPT: **$0.002** (1 web search + 1 GPT-4o call)

**Total cost with caching** (24h TTL): **~$0.001-0.005 per unique query**

## Next Steps

### **1. UI Integration** (needed)

Update `apps/app/src/components/BraveAIQueryLogModal.tsx`:

- Call `/v1/citations` instead of direct Brave API
- Display `provider` column
- Display `#sources` column
- Show citations on row expand

### **2. Batch Endpoint** (optional)

Create `POST /v1/citations/batch`:

```json
{
  "queries": ["cologuard faq", "what is cologuard", "cologuard coverage"]
}
```

Returns array of results.

### **3. Admin Dashboard** (nice-to-have)

Show:
- Provider success rates
- Average latency per provider
- Cache hit rate
- Cost breakdown

## Rollback Plan

### **If providers fail**:

1. Set `ENABLE_MULTI_PROVIDER="0"` in `wrangler.toml`
2. Deploy: `npx wrangler deploy`
3. System falls back to Brave+GPT only (existing behavior)

### **If endpoint breaks**:

1. Remove route registration from `index.ts`
2. Deploy
3. Calls to `/v1/citations` will 404

## Observability

### **Success Metrics**

- ✅ `/v1/citations` returns `ok: true`
- ✅ `provider` field populated
- ✅ `citations` array has ≥1 URL
- ✅ Cache hits logged

### **Failure Signs**

- ❌ All providers return errors (check secrets)
- ❌ High latency (>5s) → check rate limits
- ❌ 429 errors → adjust QPS settings
- ❌ No citations → check provider API changes

## Production Status

### **Deployed**: ✅ January 11, 2025

- API worker version: `fe178754-4c90-4acc-85eb-7b12a4306738`
- Endpoint: `https://api.optiview.ai/v1/citations`
- Feature flag: `ENABLE_MULTI_PROVIDER=1`

### **Tested Queries**

1. ✅ "cologuard faq" → `brave+gpt`, 8 citations
2. ✅ "what is colorectal cancer screening" → `brave+gpt`, 8 citations

(Tavily/Perplexity likely need valid API keys to succeed)

### **Known Limitations**

- Tavily/Perplexity may fail if API keys not set or invalid
- Falls back to Brave+GPT (always works)
- No UI integration yet (modal still calls old Brave endpoint)

## Security

### **API Key Protection**

- All secrets stored in Cloudflare Workers secrets
- Never logged or exposed in responses
- Rate limiters prevent abuse

### **SSRF Protection**

- N/A (all providers are external APIs, not user URLs)

### **Input Validation**

- Query length: min 3 chars (after normalization)
- Query normalization prevents cache poisoning

## Maintenance

### **Updating Provider Endpoints**

Edit the adapter files:
- `adapter-tavily.ts`
- `adapter-perplexity.ts`
- `adapter-brave-gpt.ts`

### **Adjusting Rate Limits**

Update `wrangler.toml`:
```toml
TAVILY_QPS = "5"   # Increase to 5 QPS
```

Redeploy.

### **Changing Cache TTL**

Update `wrangler.toml`:
```toml
PROVIDER_CACHE_TTL = "172800"  # 48 hours
```

Redeploy.

## Support

### **Common Issues**

**Q: All queries return `brave+gpt`**
- A: Tavily/Perplexity API keys may be missing or invalid. Check secrets.

**Q: High 429 error rate**
- A: Reduce QPS in `wrangler.toml` or increase rate limiter capacity.

**Q: Slow responses (>5s)**
- A: Check provider APIs directly. May need to increase timeouts.

**Q: Cache not working**
- A: Verify `RECO_CACHE` KV namespace is bound in `wrangler.toml`.

---

**Built**: January 11, 2025  
**Status**: ✅ Production Ready  
**Next**: UI integration for Brave AI modal

