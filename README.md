# Optiview

A monorepo for AI-powered link tracking and analytics, built on Cloudflare's edge platform.

## Structure

- **`apps/geodude`** - Cloudflare Pages UI application
- **`apps/geodude-api`** - Cloudflare Worker API backend
- **`packages/shared`** - Shared utilities and types
- **`scripts/playwright`** - AI surface capture automation (placeholder)
- **`migrations/d1`** - Database schema and migrations

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run development servers
pnpm run dev

# Type checking
pnpm run typecheck
```

## Environment Variables

Copy `.dev.vars.example` to `apps/geodude-api/.dev.vars` and fill in your Cloudflare credentials and secrets.

## Development

### API (Worker)
```bash
cd apps/geodude-api
cp ../../.dev.vars.example .dev.vars
# Edit .dev.vars with your values
wrangler dev
```

### UI (Pages)
```bash
cd apps/geodude
wrangler pages dev
```

## Deployment

```bash
# Deploy both services
pnpm run cf:publish
```

## Next Steps

Before deploying, you'll need to provide:
- Cloudflare Account ID
- D1 database ID
- R2 bucket names
- Destination mapping rules for redirects
- Domain configuration
