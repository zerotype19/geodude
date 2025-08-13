# D1 Database Migrations

Database schema and migrations for geodude analytics.

## Current Schema

- **`edge_click_event`** - Click tracking events from redirects
- **`conversion_event`** - User conversion events (leads, signups, purchases)
- **`crawler_visit`** - Bot/crawler visit tracking
- **`ai_surface_capture`** - AI surface screenshots and metadata
- **`ai_citation_event`** - Individual citation events from AI surfaces

## Usage

```bash
# Apply migration locally
wrangler d1 execute geodude-db --local --file 001_init.sql

# Apply to production (after deployment)
wrangler d1 execute geodude-db --file 001_init.sql
```

## Next Migrations

Future migrations should be numbered sequentially (002_, 003_, etc.) and include both up and down scripts.
