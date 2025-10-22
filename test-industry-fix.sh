#!/bin/bash

API_BASE="https://api.optiview.ai"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║       🧪 TESTING AI INDUSTRY CLASSIFIER FIX 🧪                      ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Testing audits that should now get correct industry classification:"
echo ""

# Test sites with known industries
declare -a TEST_SITES=(
  "https://www.hollandamerica.com|holland_retest|Holland America cruise line"
  "https://www.carvana.com|carvana_retest|Online car buying and selling platform"
  "https://www.carnival.com|carnival_test|Carnival Cruise Line"
)

declare -a AUDIT_LINKS=()

for site_data in "${TEST_SITES[@]}"; do
  IFS='|' read -r root_url project_id site_description <<< "$site_data"
  
  echo "🚀 Testing: $root_url"
  
  json_payload=$(cat <<EOF
{
  "project_id": "$project_id",
  "root_url": "$root_url",
  "site_description": "$site_description",
  "max_pages": 30
}
EOF
)
  
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
    
    audit_link="https://app.optiview.ai/audits/$new_audit_id"
    echo "   ✅ Started: $new_audit_id"
    echo "   🔗 $audit_link"
    AUDIT_LINKS+=("$audit_link")
  else
    echo "   ❌ Failed with HTTP $http_code"
  fi
  
  echo ""
  sleep 2
done

echo "═════════════════════════════════════════════════════════════════════"
echo ""
echo "🔗 TEST AUDIT LINKS:"
for link in "${AUDIT_LINKS[@]}"; do
  echo "   $link"
done
echo ""
echo "⏰ Wait ~3-5 minutes for audits to complete"
echo ""
echo "🔍 WHAT TO CHECK:"
echo "   1. Open browser dev tools → Network tab"
echo "   2. Load audit page and find the /api/audits/{id} response"
echo "   3. Look for: \"industry\": \"travel_cruise\" (Holland/Carnival)"
echo "   4. Look for: \"industry_source\": \"ai_worker\" or \"ai_worker_medium_conf\""
echo "   5. Should NOT be \"generic_consumer\""
echo ""
