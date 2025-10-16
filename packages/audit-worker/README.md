# Optiview Audit Worker

A comprehensive AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization) audit system built on Cloudflare Workers.

## Features

- **Comprehensive Auditing**: 20 checks across AEO and GEO categories
- **Browser Rendering**: Uses Cloudflare Browser Rendering for SPA parity
- **Real-time Analysis**: Live scoring with configurable weights via KV
- **Detailed Reports**: Page-level analysis with evidence and recommendations

## Setup

### 1. Create D1 Database and KV Namespace

```bash
# Create D1 database
wrangler d1 create optiview

# Create KV namespace
wrangler kv:namespace create RULES
```

### 2. Update wrangler.toml

Replace the placeholders in `wrangler.toml` with your actual IDs:

```toml
[[d1_databases]]
binding = "DB"
database_name = "optiview"
database_id = "YOUR_D1_DATABASE_ID"

[[kv_namespaces]]
binding = "RULES"
id = "YOUR_KV_NAMESPACE_ID"
```

### 3. Apply Migrations

```bash
# Apply migrations to create tables
wrangler d1 migrations apply optiview --remote
```

### 4. Deploy Worker

```bash
wrangler deploy
```

### 5. Seed KV Rules

```bash
# Seed the default scoring rules and patterns
curl -X POST https://your-worker-domain.workers.dev/api/admin/seed-rules
```

## API Endpoints

### Audits

- `POST /api/audits` - Create new audit
- `GET /api/audits/:id` - Get audit details
- `GET /api/audits/:id/pages` - List pages in audit
- `GET /api/audits/:id/pages/:pageId` - Get page details
- `POST /api/audits/:id/recompute` - Recompute scores with current rules
- `POST /api/audits/:id/recrawl` - Refetch and reanalyze all pages

### Admin

- `POST /api/admin/seed-rules` - Initialize KV with default rules

## Usage

### Create an Audit

```bash
curl -X POST https://your-worker-domain.workers.dev/api/audits \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "prj_demo",
    "root_url": "https://example.com",
    "max_pages": 200
  }'
```

### Check Audit Status

```bash
curl https://your-worker-domain.workers.dev/api/audits/AUDIT_ID
```

## AEO Checks (Answer Engine Optimization)

| ID | Check | Weight | Description |
|----|-------|--------|-------------|
| A1 | Answer-first design | 15 | Concise summary with jump links |
| A2 | Topical cluster integrity | 15 | Internal linking and breadcrumbs |
| A3 | Site authority | 15 | Organization and author info |
| A4 | Originality & effort | 12 | Unique assets and content |
| A5 | Schema accuracy | 10 | Valid JSON-LD markup |
| A6 | Crawlability | 10 | Canonicals and unique titles |
| A7 | UX & performance | 8 | No CLS issues, proper images |
| A8 | Sitemaps | 6 | Fresh sitemap.xml |
| A9 | Freshness & stability | 5 | Updated content and stable URLs |
| A10 | AI Overviews readiness | 4 | Citations and structured content |

## GEO Checks (Generative Engine Optimization)

| ID | Check | Weight | Description |
|----|-------|--------|-------------|
| G1 | Citable facts block | 15 | Key facts with 3-7 points |
| G2 | Provenance schema | 15 | Complete author/publisher info |
| G3 | Evidence density | 12 | References and outbound links |
| G4 | AI crawler access | 12 | Bot permissions and content parity |
| G5 | Chunkability | 10 | Semantic headings and structure |
| G6 | Canonical fact URLs | 8 | Stable anchors and URLs |
| G7 | Dataset availability | 8 | Downloadable CSV/JSON |
| G8 | Policy transparency | 6 | Content license and AI policy |
| G9 | Update hygiene | 7 | Changelog and dateModified |
| G10 | Cluster linking | 7 | Sources hub and reciprocal links |

## Scoring

Each check is scored on a 0-3 scale:
- **3 (Exceeds)**: Clear presence with strong implementation
- **2 (Meets)**: Present but basic implementation
- **1 (Partial)**: Hints present but weak/incorrect
- **0 (Missing)**: Not detected

Final scores are weighted averages normalized to 100.

## Development

```bash
# Start local development
wrangler dev

# Run migrations locally
wrangler d1 migrations apply optiview --local

# Test locally
curl http://localhost:8787/api/admin/seed-rules
```

## Architecture

- **Worker**: Cloudflare Worker with D1, KV, and Browser bindings
- **Database**: D1 for audit data, page analysis, and results
- **KV**: Configuration storage for scoring rules and patterns
- **Browser**: Chromium rendering for SPA content analysis
- **Frontend**: React app consuming worker APIs
