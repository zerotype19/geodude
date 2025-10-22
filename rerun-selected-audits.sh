#!/bin/bash

# Rerun specific failed audits that have a chance of succeeding
# These are audits that failed due to timeouts or transient issues

API_BASE="https://api.optiview.ai"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║       🔄 RERUNNING SELECTED FAILED AUDITS 🔄                        ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Array of audits to retry (timeout/transient failures only)
declare -a AUDITS=(
  # Princess Cruises (timeout - might work now)
  "a082dfe9-197f-4aaa-8212-f173790d8839|https://www.princess.com/en-us/|princess_test2|Princess Cruises - cruise line"
  
  # StockX (403 - but let's try, it might work)
  "c86b3339-ce08-42de-b268-c6701825246e|https://stockx.com|Stockx|sneaker and apparel resales"
)

SUCCESS=0
FAILED=0

for audit_data in "${AUDITS[@]}"; do
  IFS='|' read -r audit_id root_url project_id site_description <<< "$audit_data"
  
  echo "🔄 Rerunning: $root_url"
  echo "   Old Audit ID: $audit_id"
  
  # Build JSON payload
  json_payload=$(cat <<EOF
{
  "project_id": "$project_id",
  "root_url": "$root_url",
  "site_description": "$site_description",
  "max_pages": 100
}
EOF
)
  
  # Make the API call
  response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/audits" \
    -H "Content-Type: application/json" \
    -d "$json_payload")
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
    new_audit_id=$(echo "$body" | grep -o '"audit_id":"[^"]*"' | cut -d'"' -f4)
    if [ -z "$new_audit_id" ]; then
      new_audit_id=$(echo "$body" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    fi
    
    echo "   ✅ Success! New Audit ID: $new_audit_id"
    echo "   🔗 https://app.optiview.ai/audits/$new_audit_id"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "   ❌ Failed with HTTP $http_code"
    echo "   Response: $body"
    FAILED=$((FAILED + 1))
  fi
  
  echo ""
  sleep 3  # Wait between requests
done

echo "═════════════════════════════════════════════════════════════════════"
echo ""
echo "📊 SUMMARY"
echo ""
echo "✅ Successfully rerun: $SUCCESS"
echo "❌ Failed to rerun: $FAILED"
echo ""
echo "💡 Wait a few minutes for the audits to complete, then check them"
echo "   to see the new industry classification and Scorecard V2 features!"
echo ""
