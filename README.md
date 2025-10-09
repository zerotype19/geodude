# Geodude - AI Optimization Platform

Monorepo for Optiview.ai - helping websites optimize for AI discovery.

## Structure

```
apps/
  web/                 # Marketing site (Cloudflare Pages)
packages/
  api-worker/          # API Worker (audits, analytics)
  collector-worker/    # 1px beacon + bot tracking
db/
  migrations/          # D1 SQL migrations
tools/
  samples/             # JSON fixtures
```

## Infrastructure

- **Pages**: `geodude` → www.optiview.ai
- **API Worker**: `geodude-api` → api.optiview.ai
- **Collector Worker**: `geodude-collector` → collector.optiview.ai
- **D1 Database**: `optiview_db`

## Quick Start

```bash
pnpm install
pnpm dev           # Run all apps in parallel
pnpm build         # Build all packages
pnpm migrate       # Apply D1 migrations to production
```

## Development

- `pnpm dev` - Start all services
- `pnpm -C packages/api-worker dev` - Run API worker only
- `pnpm -C packages/collector-worker dev` - Run collector only
