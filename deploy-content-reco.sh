#!/bin/bash
# Deploy Content Recommendations Feature

set -e

echo "🚀 Deploying Content Recommendations Feature"
echo ""

# Check if we're in the right directory
if [ ! -f "pnpm-workspace.yaml" ]; then
  echo "❌ Error: Must run from geodude root directory"
  exit 1
fi

# Step 1: Run migration
echo "📊 Step 1: Running D1 migration..."
npx wrangler d1 migrations apply optiview_db --remote --config packages/api-worker/wrangler.toml
echo "✅ Migration complete"
echo ""

# Step 2: Install consumer dependencies
echo "📦 Step 2: Installing consumer dependencies..."
cd packages/reco-consumer
pnpm install
cd ../..
echo "✅ Dependencies installed"
echo ""

# Step 3: Deploy consumer worker
echo "🔄 Step 3: Deploying consumer worker..."
cd packages/reco-consumer
npm run deploy
cd ../..
echo "✅ Consumer worker deployed"
echo ""

# Step 4: Deploy API worker
echo "🔄 Step 4: Deploying API worker..."
cd packages/api-worker
npm run deploy
cd ../..
echo "✅ API worker deployed"
echo ""

# Step 5: Deploy frontend
echo "🔄 Step 5: Deploying frontend..."
cd apps/app
npm run build
npx wrangler pages deploy dist --project-name=geodude-app
cd ../..
echo "✅ Frontend deployed"
echo ""

echo "✨ Deployment complete!"
echo ""
echo "⚠️  IMPORTANT: You still need to:"
echo "1. Create KV namespace: npx wrangler kv:namespace create RECO_CACHE"
echo "2. Update both wrangler.toml files with the KV namespace ID"
echo "3. Set OPENAI_API_KEY secret in both workers"
echo "4. Create queue: npx wrangler queues create reco-queue"
echo ""
echo "See CONTENT_RECOMMENDATIONS_SETUP.md for detailed instructions"

