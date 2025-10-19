#!/bin/bash
# Phase 1: Universal Classification v1.0 - Deployment Script

set -e

echo "🚀 Deploying Universal Classification v1.0 (Phase 1)"
echo ""

# Step 1: Run D1 migration
echo "📦 Step 1/4: Running D1 migration..."
cd /Users/kevinmcgovern/geodude/geodude/packages/audit-worker
wrangler d1 migrations apply OPTIVIEW_DB --remote
echo "✅ Migration complete"
echo ""

# Step 2: Deploy worker
echo "🔧 Step 2/4: Deploying audit worker..."
wrangler deploy
echo "✅ Worker deployed"
echo ""

# Step 3: Deploy frontend
echo "🎨 Step 3/4: Deploying frontend..."
cd /Users/kevinmcgovern/geodude/geodude/apps/app
npm run build
wrangler pages deploy dist --project-name=geodude-app
echo "✅ Frontend deployed"
echo ""

# Step 4: Verification
echo "🔍 Step 4/4: Verification"
echo ""
echo "✅ Phase 1 deployment complete!"
echo ""
echo "📊 Next steps:"
echo "  1. Run test audits on 10-20 diverse domains"
echo "  2. Check /admin/classifier-compare for each domain"
echo "  3. Monitor telemetry for classification_v2_logged events"
echo "  4. Review confidence histogram after 1 week"
echo ""
echo "Admin compare view: https://app.optiview.ai/admin/classifier-compare"
echo "API endpoint: https://api.optiview.ai/api/admin/classifier-compare?host=nike.com"
echo ""
