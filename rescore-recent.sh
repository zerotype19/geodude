#!/bin/bash

# Re-score recent audits after moving preview criteria to production
# Usage: ./rescore-recent.sh [limit]

LIMIT=${1:-10}

echo "🔄 Re-scoring last $LIMIT audits..."
echo ""

curl -X POST https://api.optiview.ai/api/admin/rescore-recent \
  -H "Content-Type: application/json" \
  -H "Cookie: ov_sess=$(grep ov_sess ~/.optiview_cookies 2>/dev/null | cut -d'=' -f2 || echo '')" \
  -d "{\"limit\": $LIMIT}" \
  | jq '.'

echo ""
echo "✅ Re-score complete!"

