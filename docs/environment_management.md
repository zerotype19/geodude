# Environment Management Guide

## Overview

This document describes the new config-as-code approach for managing environment variables in the Optiview API worker. This system prevents configuration drift and ensures all non-secret variables are managed through code.

## Key Principles

1. **Non-secret variables live in wrangler.toml** - Never set these in Cloudflare dashboard
2. **Secrets are managed via wrangler secret put** - Never commit secrets to code
3. **Predeploy checks prevent drift** - Automatic validation before deployment
4. **Environment-specific configurations** - Separate configs for test/staging/production

## Configuration Structure

### wrangler.toml Structure

```toml
name = "geodude-api"
main = "src/worker.js"
compatibility_date = "2025-08-01"

# Default/local fallback (rarely used)
[vars]
PUBLIC_APP_URL = "http://localhost:3000"
PUBLIC_BASE_URL = "http://127.0.0.1:8787"
CSP_MODE = "development"
# ... other defaults

# Production environment
[env.production.vars]
PUBLIC_APP_URL = "https://app.optiview.ai"
PUBLIC_BASE_URL = "https://api.optiview.ai"
CSP_MODE = "production"
TEST_MODE = "0"
# ... production-specific values

# Staging environment
[env.staging.vars]
PUBLIC_APP_URL = "https://staging.app.optiview.ai"
PUBLIC_BASE_URL = "https://staging.api.optiview.ai"
# ... staging-specific values

# Test/Development environment
[env.test.vars]
PUBLIC_APP_URL = "http://localhost:3000"
PUBLIC_BASE_URL = "http://127.0.0.1:8787"
CSP_MODE = "development"
TEST_MODE = "1"
# ... test-specific values

# Shared bindings (D1, KV, etc.)
[[d1_databases]]
binding = "OPTIVIEW_DB"
database_name = "optiview_db"
database_id = "975fb94d-9fac-4fd9-b8e2-41444f488334"

[[kv_namespaces]]
binding = "AI_FINGERPRINTS"
id = "571e1b9f739c4d0a9027b350cf091d20"
preview_id = "dev_ai_fingerprints"
```

## Available Scripts

### Development
```bash
# Local development with test environment
pnpm dev

# Remote development with test environment
pnpm dev:remote
```

### Deployment
```bash
# Deploy to test environment
pnpm deploy:test

# Deploy to staging (with predeploy check)
pnpm deploy:staging

# Deploy to production (with predeploy check)
pnpm deploy:prod
```

### Predeploy Checks
```bash
# Check staging environment configuration
pnpm predeploy:staging

# Check production environment configuration
pnpm predeploy:prod
```

## Environment Variables

### Core Settings
- `NODE_ENV` - Environment mode (development/production/test)
- `CSP_MODE` - Content Security Policy mode
- `TEST_MODE` - Enable/disable test endpoints
- `DEV_MAIL_ECHO` - Echo emails to console in development

### URLs
- `PUBLIC_APP_URL` - Frontend application URL
- `PUBLIC_BASE_URL` - API base URL

### Auth & Session
- `SESSION_TTL_HOURS` - Session timeout in hours
- `OTP_EXP_MIN` - OTP expiration in minutes
- `MAGIC_LINK_EXP_MIN` - Magic link expiration in minutes
- `MAGIC_LINK_RPM_PER_IP` - Magic link rate limit per IP per minute
- `MAGIC_LINK_RPD_PER_EMAIL` - Magic link rate limit per email per day
- `INVITE_EXP_DAYS` - Invite expiration in days
- `ADMIN_RPM_PER_IP` - Admin endpoint rate limit per IP per minute

### Rate Limiting
- `INGEST_RATE_LIMIT_RPS` - Event ingestion rate limit per second
- `INGEST_RATE_LIMIT_BURST` - Event ingestion burst limit
- `RATE_LIMIT_RETRY_AFTER` - Retry-after header value in seconds
- `CSV_EXPORT_RATE_LIMIT_RPS` - CSV export rate limit per second
- `RULES_REFRESH_TTL_SEC` - Rules refresh TTL in seconds

### Email Settings
- `EMAIL_SENDER_NAME` - Email sender display name
- `EMAIL_FROM` - Email sender address

## Secrets Management

### Required Production Secrets
These must be set via `wrangler secret put` for production:

```bash
# Session management
wrangler secret put SESSION_SECRET --env=production

# SMTP configuration
wrangler secret put SMTP_HOST --env=production
wrangler secret put SMTP_PORT --env=production
wrangler secret put SMTP_USER --env=production
wrangler secret put SMTP_PASS --env=production

# Optional integrations
wrangler secret put SLACK_WEBHOOK_URL --env=production
```

### Setting Secrets
```bash
# For production
wrangler secret put SECRET_NAME --env=production

# For staging
wrangler secret put SECRET_NAME --env=staging

# For test (local)
wrangler secret put SECRET_NAME --env=test
```

## Predeploy Environment Guard

The predeploy script (`scripts/predeploy-env-guard.ts`) automatically:

1. **Loads wrangler.toml** configuration for the target environment
2. **Calls the running worker's** `/admin/env-check` endpoint
3. **Compares configurations** to detect drift
4. **Aborts deployment** if any differences are found

### Drift Detection
The script checks for:
- Missing variables
- Different values
- Configuration errors
- Missing required secrets

### Example Output
```
🔍 Checking environment configuration for: production
📋 Found 20 variables in wrangler.toml
🔗 Checking worker at: https://api.optiview.ai/admin/env-check
✅ Worker responded with 20 variables

❌ CONFIGURATION DRIFT DETECTED!
The following variables have different values:
  PUBLIC_APP_URL:
    wrangler.toml: "https://app.optiview.ai"
    worker:        "https://old-domain.com"

🚫 Deployment aborted. Please fix the configuration drift first.
```

## Migration Steps

### 1. Export Current Dashboard Variables
1. Go to Cloudflare Dashboard → Workers → geodude-api → Settings → Variables
2. Copy all non-secret "Text" variables
3. Note which environment they belong to

### 2. Add to wrangler.toml
1. Add variables to appropriate `[env.production.vars]` block
2. Add variables to appropriate `[env.staging.vars]` block
3. Ensure all values match current dashboard settings

### 3. Remove from Dashboard
1. Remove all non-secret "Text" variables from dashboard
2. Keep only secrets in the "Secrets" section
3. Keep bindings (D1, KV, R2) unchanged

### 4. Deploy and Verify
1. Run `pnpm deploy:staging` to test staging
2. Verify `/admin/env-check` shows correct values
3. Run `pnpm deploy:prod` to update production
4. Verify production `/admin/env-check`

## Troubleshooting

### Common Issues

#### Configuration Drift
**Problem**: Predeploy check fails with drift detected
**Solution**: 
1. Check if variables were changed in Cloudflare dashboard
2. Ensure wrangler.toml matches current worker configuration
3. Redeploy worker to sync configurations

#### Missing Secrets
**Problem**: Production deployment fails with missing secrets
**Solution**:
1. Set required secrets: `wrangler secret put SECRET_NAME --env=production`
2. Verify with: `wrangler secret list --env=production`

#### TOML Parse Errors
**Problem**: Predeploy script fails to parse wrangler.toml
**Solution**:
1. Check TOML syntax (brackets, quotes, etc.)
2. Validate with online TOML validator
3. Ensure proper indentation and structure

### Debug Commands

```bash
# Check current worker configuration
curl https://api.optiview.ai/admin/env-check

# List current secrets
wrangler secret list --env=production

# Validate wrangler.toml syntax
wrangler d1 migrations list optiview_db --env=production
```

## Best Practices

1. **Always use scripts** - Never run `wrangler deploy` directly
2. **Test in staging first** - Deploy to staging before production
3. **Review predeploy output** - Ensure no drift before proceeding
4. **Keep secrets separate** - Never commit secrets to wrangler.toml
5. **Document changes** - Update this guide when adding new variables
6. **Version control** - Commit wrangler.toml changes with clear messages

## Security Notes

- **Non-secret variables** are visible in `/admin/env-check` endpoint
- **Secrets are never exposed** through configuration endpoints
- **Production secrets** are required and validated on startup
- **Configuration validation** prevents invalid values from being deployed
- **Rate limiting** protects admin endpoints from abuse

## Support

For issues with environment management:

1. Check this documentation first
2. Review predeploy script output
3. Verify wrangler.toml syntax
4. Check Cloudflare dashboard for conflicting variables
5. Contact the development team with specific error messages
