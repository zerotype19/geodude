# Optiview Audit System Deployment Guide

Complete deployment instructions for the new AEO/GEO audit system.

## Prerequisites

- Cloudflare account with Workers, D1, and KV access
- Wrangler CLI installed and authenticated
- Node.js and pnpm for frontend development

## Step 1: Create Cloudflare Resources

### Create D1 Database
```bash
cd packages/audit-worker
wrangler d1 create optiview
```

Copy the database ID and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "optiview"
database_id = "YOUR_DATABASE_ID_HERE"
```

### Create KV Namespace
```bash
wrangler kv:namespace create RULES
```

Copy the namespace ID and update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "RULES"
id = "YOUR_KV_NAMESPACE_ID_HERE"
```

## Step 2: Deploy Audit Worker

```bash
cd packages/audit-worker

# Install dependencies
pnpm install

# Apply database migrations
wrangler d1 migrations apply optiview --remote

# Deploy worker
wrangler deploy
```

Note the worker URL (e.g., `https://optiview-audit-worker.your-subdomain.workers.dev`)

## Step 3: Seed KV Rules

```bash
# Replace with your actual worker URL
curl -X POST https://optiview-audit-worker.your-subdomain.workers.dev/api/admin/seed-rules
```

## Step 4: Deploy Frontend App

```bash
cd apps/app

# Install dependencies
pnpm install

# Update API_BASE in all route files to match your worker URL
# Replace: const API_BASE = 'https://optiview-audit-worker.workers.dev';
# With: const API_BASE = 'https://YOUR_WORKER_URL';

# Build and deploy
pnpm build
pnpm deploy
```

## Step 5: Test the System

### Create Your First Audit
```bash
curl -X POST https://YOUR_WORKER_URL/api/audits \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test_audit",
    "root_url": "https://example.com",
    "max_pages": 50
  }'
```

### Check Audit Status
```bash
curl https://YOUR_WORKER_URL/api/audits/AUDIT_ID
```

### View Results
Visit your frontend app at `https://YOUR_APP_URL/audits` to see the audit dashboard.

## Configuration

### Custom Scoring Rules

You can modify the scoring rules by updating the KV store:

```bash
# Get current rules
wrangler kv:key get "rules:config" --namespace-id YOUR_KV_ID

# Update rules (example)
wrangler kv:key put "rules:config" '{
  "aeo": {"A1":20, "A2":15, ...},
  "geo": {"G1":20, "G2":15, ...},
  "patterns": {...}
}' --namespace-id YOUR_KV_ID
```

### Environment Variables

The worker uses these bindings:
- `DB`: D1 database for audit data
- `RULES`: KV namespace for configuration
- `BROWSER`: Browser rendering for SPA analysis

## Monitoring

### Check Worker Logs
```bash
wrangler tail optiview-audit-worker
```

### Monitor Database
```bash
wrangler d1 execute optiview --command "SELECT COUNT(*) FROM audits;"
```

### Check KV Data
```bash
wrangler kv:key get "rules:config" --namespace-id YOUR_KV_ID
```

## Troubleshooting

### Common Issues

1. **Migration Errors**: Ensure D1 database ID is correct in `wrangler.toml`
2. **KV Access**: Verify KV namespace ID and binding name
3. **Browser Rendering**: Check that Browser binding is enabled in your Cloudflare plan
4. **CORS Issues**: Worker includes CORS headers, but verify frontend URL

### Debug Commands

```bash
# Test worker locally
wrangler dev

# Check database schema
wrangler d1 execute optiview --command ".schema"

# List KV keys
wrangler kv:key list --namespace-id YOUR_KV_ID
```

## Production Checklist

- [ ] D1 database created and migrations applied
- [ ] KV namespace created and rules seeded
- [ ] Worker deployed and accessible
- [ ] Frontend deployed with correct API URL
- [ ] Test audit created successfully
- [ ] Results visible in frontend dashboard
- [ ] Browser rendering working (check parity_pass in results)
- [ ] All API endpoints responding correctly

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/audits` | Create new audit |
| GET | `/api/audits/:id` | Get audit details |
| GET | `/api/audits/:id/pages` | List pages |
| GET | `/api/audits/:id/pages/:pageId` | Get page details |
| POST | `/api/audits/:id/recompute` | Recompute scores |
| POST | `/api/audits/:id/recrawl` | Refetch pages |
| POST | `/api/admin/seed-rules` | Initialize KV rules |

## Next Steps

After deployment:
1. Create audits for your target websites
2. Analyze results and identify improvement opportunities
3. Customize scoring weights based on your priorities
4. Set up monitoring for regular audits
5. Integrate with your existing workflow

For support or questions, refer to the worker README or Cloudflare Workers documentation.
