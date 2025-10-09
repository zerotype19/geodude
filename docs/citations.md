# Citations API

## Overview

The Citations API tracks where your domain appears in search engine results, providing evidence of brand mentions and visibility.

## Search Engine

**Default**: Brave Search (free tier: 2,000 queries/month)

**Setup**: Set the `BRAVE_SEARCH` secret in Cloudflare Workers

**Alternative**: To use Bing instead, set `BING_SEARCH_KEY` secret (requires Azure account)

## Endpoints

### GET /v1/audits/:id/citations

Returns normalized citations list.

**Response**:
```json
{
  "items": [
    {
      "engine": "brave",
      "query": "optiview site:optiview.ai",
      "url": "https://optiview.ai/",
      "title": "Optiview - AI Optimization",
      "cited_at": 1760034246863
    }
  ]
}
```

### GET /v1/audits/:id/citations?full=1

Returns full audit object with citations (legacy format).

### GET /v1/citations/budget

Check daily citations API budget.

**Response**:
```json
{
  "used": 2,
  "remaining": 198,
  "max": 200,
  "date": "2025-10-09"
}
```

## Features

### 24h Cache

- Citations are cached in D1 for 24 hours per (domain, query)
- Reduces API calls by ~90% after first audit
- Cache hit: ~10ms vs ~500ms for API call

### Daily Budget Guard

- Default limit: 200 queries/day
- Configurable via `CITATIONS_DAILY_BUDGET` env var
- Gracefully returns `[]` when budget exceeded
- Protects against exceeding free tier limits

### Politeness

- 250ms delay between uncached API queries
- No delay for cached results
- Respects search engine rate limits

## Monitoring

### Logs

- `"Brave cache hit: <query> (N results)"` - Cache hit
- `"Brave API call: <query> (N results cached)"` - Cache miss
- `"Citations daily budget exceeded: X/200"` - Budget limit reached

### Status Endpoint

GET `/status` includes citations budget in response:

```json
{
  "status": "ok",
  "citations_budget": {
    "used": 2,
    "remaining": 198,
    "max": 200
  }
}
```

## Configuration

### Environment Variables

- `BRAVE_SEARCH` (secret) - Brave Search API key
- `BRAVE_SEARCH_ENDPOINT` (var) - API endpoint (default: official Brave endpoint)
- `CITATIONS_DAILY_BUDGET` (var) - Daily query limit (default: 200)
- `CITATIONS_MAX_PER_QUERY` (var) - Results per query (default: 5)

### Database

**Table**: `citations_cache`
- Stores search results for 24h
- Indexed on (domain, query)
- Primary key: (domain, query, url)

**Table**: `citations`
- Stores audit-specific citations
- One-to-many with audits table
- Includes engine, query, url, title, cited_at

## Best Practices

1. **Monitor Budget**: Check `/v1/citations/budget` daily
2. **Review Logs**: Look for Brave API errors weekly
3. **Cache Warming**: Optionally prefetch for active domains after cron
4. **Alert on Errors**: Set up monitoring for "brave search failed" logs

## Troubleshooting

### No Citations Returned

- Check `BRAVE_SEARCH` secret is set
- Verify domain has indexed pages
- Check budget hasn't been exceeded
- Review worker logs for API errors

### Budget Exhausted

- Increase `CITATIONS_DAILY_BUDGET`
- Implement cache warming for known domains
- Review query patterns for duplicates

### API Errors

- Check Brave API key validity
- Verify endpoint is accessible
- Review rate limits (free tier: 1 query/sec)

