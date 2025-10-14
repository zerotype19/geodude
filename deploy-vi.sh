#!/bin/bash

# Deploy Visibility Intelligence System
# This script deploys the new VI system to production

echo "🚀 Deploying Visibility Intelligence System..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the geodude root directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build the API worker
echo "🔨 Building API worker..."
cd packages/api-worker
pnpm build

# Run migrations
echo "🗄️ Running database migrations..."
pnpm migrate

# Deploy the worker
echo "🚀 Deploying API worker..."
pnpm deploy

# Go back to root
cd ../..

# Build and deploy the frontend
echo "🎨 Building frontend..."
cd apps/app
pnpm build

# Deploy frontend (if using Cloudflare Pages)
echo "🌐 Deploying frontend..."
pnpm deploy

# Go back to root
cd ../..

echo "✅ Visibility Intelligence deployment complete!"
echo ""
echo "🔗 Next steps:"
echo "1. Set up KV namespaces in Cloudflare dashboard"
echo "2. Configure environment variables in wrangler.toml"
echo "3. Test the /api/vi/health endpoint"
echo "4. Run a test visibility analysis from an audit page"
echo ""
echo "📊 Test URLs:"
echo "- Health: https://api.optiview.ai/api/vi/health"
echo "- Run: POST https://api.optiview.ai/api/vi/run"
echo "- Results: GET https://api.optiview.ai/api/vi/results?audit_id=<audit_id>"
echo ""
echo "🎯 To test:"
echo "1. Go to any audit page"
echo "2. Click the 'Visibility Intelligence' tab"
echo "3. Click 'Run Visibility Analysis'"
echo "4. Wait for processing to complete"
echo "5. Review results and export CSV if needed"
