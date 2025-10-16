#!/bin/bash

# v2.1 Scoring System Rollout Script
# Usage: ./scripts/rollout-v21.sh [enable|disable|status]

set -e

# Get KV namespace ID from wrangler.toml
KV_RULES_ID="f448590f3aa9494cbd4d30d5fd6bc337"

case "${1:-status}" in
  "enable")
    echo "🚀 Enabling v2.1 scoring system..."
    wrangler kv:key put --namespace-id $KV_RULES_ID flags/audit_v21_scoring true
    wrangler kv:key put --namespace-id $KV_RULES_ID flags/crawl_sitemap_depth1 true
    echo "✅ v2.1 scoring enabled"
    ;;
  "disable")
    echo "🔄 Disabling v2.1 scoring system..."
    wrangler kv:key put --namespace-id $KV_RULES_ID flags/audit_v21_scoring false
    wrangler kv:key put --namespace-id $KV_RULES_ID flags/crawl_sitemap_depth1 false
    echo "✅ v2.1 scoring disabled"
    ;;
  "status")
    echo "📊 Checking v2.1 scoring status..."
    echo "Audit v2.1 scoring: $(wrangler kv:key get --namespace-id $KV_RULES_ID flags/audit_v21_scoring || echo 'not set')"
    echo "Crawl sitemap depth1: $(wrangler kv:key get --namespace-id $KV_RULES_ID flags/crawl_sitemap_depth1 || echo 'not set')"
    echo ""
    echo "Health check:"
    curl -s "https://geodude-api.kevin-mcgovern.workers.dev/status" | jq '.v21_scoring'
    ;;
  *)
    echo "Usage: $0 [enable|disable|status]"
    exit 1
    ;;
esac
