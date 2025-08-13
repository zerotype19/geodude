# geodude-api

Cloudflare Worker API backend for geodude link tracking and analytics.

## Routes

- **`/health`** - Health check endpoint
- **`/r/:token`** - Token-based redirector with event tracking
- **`/v1/events`** - Batch event ingestion (POST, requires API key)
- **`/ingest/ai-citations`** - AI citation data ingestion (POST, requires API key)

## Bindings

- **`GEO_DB`** - D1 database for event storage
- **`AI_CAPTURES`** - R2 bucket for AI surface screenshots
- **`CLICK_EVENTS`** - Queue for click event processing
- **`CONVERSION_EVENTS`** - Queue for conversion event processing
- **`CRAWLER_VISITS`** - Queue for crawler visit processing

## Environment Variables

- **`HMAC_KEY`** - Secret for token verification
- **`INGEST_API_KEY`** - API key for event ingestion
- **`CANONICAL_BASE`** - Fallback destination URL

## Development

```bash
# Copy environment variables
cp ../../.dev.vars.example .dev.vars
# Edit .dev.vars with your values

# Run locally
wrangler dev

# Deploy
wrangler deploy
```

## Database Setup

```bash
# Create local D1 database
wrangler d1 execute geodude-db --local --file ../../migrations/d1/001_init.sql
```
# Trigger deployment
