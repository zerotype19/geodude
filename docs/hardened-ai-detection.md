# Hardened AI Detection System (Phase 4)

## Overview

The Hardened AI Detection System provides robust traffic classification with proper precedence rules, comprehensive crawler detection, and improved AI source mapping. This system ensures accurate classification of traffic while maintaining performance and reliability.

## Key Features

### 1. **Proper Precedence Order**
Traffic is classified in the following order (first match wins):

1. **Verified Crawlers** → `ai_agent_crawl`
   - Cloudflare verified bots (`cf.verifiedBotCategory`)
   - Known crawler user agents
   - Preview/unfurl bots (Slack, Facebook, Discord, etc.)

2. **AI Assistant Referrers** → `human_via_ai`
   - ChatGPT, Claude, Perplexity, etc.
   - Bing Chat, Google Gemini, etc.

3. **Search Engines** → `search`
   - Google, Bing, DuckDuckGo, etc.

4. **Direct/Unknown** → `direct_human`
   - No referrer or unmatched referrers

### 2. **Comprehensive Crawler Detection**
- **Cloudflare Verified Bots**: Authoritative bot detection
- **User Agent Patterns**: Extensive list of known crawler UAs
- **Header Analysis**: From headers, sec-ai-client, etc.
- **Preview Bots**: Slack, Facebook, Discord, LinkedIn, WhatsApp, Telegram

### 3. **AI Source Management**
- **Auto-creation**: New AI sources are automatically created in database
- **KV Mapping**: `sources:index` provides fast source ID resolution
- **Category Classification**: Crawler vs. Assistant categorization
- **Metrics**: `ai_source_autocreated_5m` tracks new source creation

## Implementation

### Core Classifier

```typescript
import { classifyTraffic } from '../ai-lite/classifier';

const classification = classifyTraffic(req, cf, referrer, userAgent);
```

**Returns:**
```typescript
{
  class: 'ai_agent_crawl' | 'human_via_ai' | 'search' | 'direct_human',
  aiSourceId?: number,
  aiSourceSlug?: string,
  aiSourceName?: string,
  reason: string,            // Human-readable explanation
  evidence: {                // Debug information
    cfVerifiedBot?: string,
    referrerHost?: string,
    uaHit?: string
  }
}
```

### AI Source Management

```typescript
import { ensureAISourceWithMapping } from '../ai-lite/ai-source-manager';

const sourceId = await ensureAISourceWithMapping(
  env, 
  'openai_chatgpt', 
  'OpenAI/ChatGPT', 
  'assistant'
);
```

## API Endpoints

### 1. **Debug Classification**
```
GET /admin/debug/classification?event_id=<EVENT_ID>
```
- Rate limited: 10 rpm per IP
- Returns classification details for a specific event
- Includes reasoning and evidence

### 2. **Backfill Rollups**
```
POST /admin/backfill/rollups
{
  "project_id": "prj_...",
  "hours_back": 24
}
```
- Rate limited: 5 rpm per IP
- Fixes missing rollups for recent events
- Useful after classification updates

## Health Monitoring

### Health Tiles
The `/admin/health` endpoint includes hardened classification metrics:

```json
{
  "hardened_classification": {
    "last_24h": {
      "ai_human_clicks": 156,
      "crawler_hits": 89,
      "search_vs_ai_split": "23% AI-influenced",
      "referrer_visibility": "95%"
    },
    "trends": {
      "ai_human": "↑",
      "crawlers": "→"
    },
    "baseline": {
      "ai_human_median": 142,
      "crawler_median": 78
    },
    "status": "healthy"
  }
}
```

## Testing

### Run Classifier Tests
```bash
pnpm run test-classifier
```

**Test Coverage:**
- ✅ Verified crawler detection
- ✅ Known crawler UA patterns
- ✅ Preview bot detection
- ✅ AI referrer classification
- ✅ Search engine detection
- ✅ Direct human fallback
- ✅ Precedence rules
- ✅ Edge cases

### Test Scenarios
1. **Googlebot with CF verified** → `ai_agent_crawl (Google)`
2. **ChatGPT referrer** → `human_via_ai (OpenAI/ChatGPT)`
3. **Google search referrer** → `search`
4. **No referrer** → `direct_human`
5. **Slack preview bot** → `ai_agent_crawl (Slack)`

## Configuration

### Environment Variables
- `AI_LITE_SAMPLE_PCT`: Sampling percentage for baseline traffic
- `ENFORCE_AI_LITE`: Force AI-Lite mode

### KV Storage
- `sources:index`: AI source ID mapping
- `rules:heuristics`: Legacy rules (fallback)

## Best Practices

### 1. **Always Use the Classifier**
```typescript
// ✅ Good: Use hardened classifier
const classification = classifyTraffic(req, cf, referrer, userAgent);

// ❌ Bad: Manual classification logic
if (userAgent.includes('googlebot')) { ... }
```

### 2. **Handle AI Sources Properly**
```typescript
// ✅ Good: Ensure source exists
if (classification.aiSourceSlug) {
  const sourceId = await ensureAISourceWithMapping(
    env, 
    classification.aiSourceSlug, 
    classification.aiSourceName, 
    classification.class === 'ai_agent_crawl' ? 'crawler' : 'assistant'
  );
}
```

### 3. **Respect Precedence**
- Crawlers always win over referrers
- Preview bots are never human
- AI referrers indicate human via AI

### 4. **Monitor Health**
- Check `/admin/health` regularly
- Watch for classification errors
- Monitor AI source creation metrics

## Troubleshooting

### Common Issues

1. **Events not being classified**
   - Check if `class` field is being set in database
   - Verify classifier is being called
   - Check for errors in logs

2. **AI sources not being created**
   - Verify `ensureAISourceWithMapping` is called
   - Check database permissions
   - Monitor `ai_source_autocreated_5m` metrics

3. **Rollups not updating**
   - Use debug endpoint to check classification
   - Run backfill if needed
   - Check rollup function calls

### Debug Commands

```bash
# Test classifier
pnpm run test-classifier

# Check health
curl https://api.optiview.ai/admin/health

# Debug specific event
curl "https://api.optiview.ai/admin/debug/classification?event_id=123"

# Backfill rollups
curl -X POST https://api.optiview.ai/admin/backfill/rollups \
  -H "Content-Type: application/json" \
  -d '{"project_id":"prj_...","hours_back":24}'
```

## Migration Guide

### From Legacy Classifier
1. Update imports to use `../ai-lite/classifier`
2. Replace `Classification` type with `TrafficClassification`
3. Update function calls to new signature
4. Use `ensureAISourceWithMapping` for AI source management

### Database Changes
- Ensure `interaction_events.class` field exists
- Verify `traffic_rollup_hourly` table structure
- Check `ai_sources` table permissions

## Performance Considerations

- **Caching**: AI source IDs are cached in KV
- **Sampling**: Baseline traffic can be sampled in AI-Lite mode
- **Rollups**: Hourly aggregation reduces query load
- **Rate Limiting**: Admin endpoints are rate-limited

## Security

- **Admin Endpoints**: Rate-limited and should be protected
- **Input Validation**: All inputs are validated and sanitized
- **Evidence Collection**: Only safe, non-sensitive data is collected
- **Rate Limiting**: Prevents abuse of classification endpoints
