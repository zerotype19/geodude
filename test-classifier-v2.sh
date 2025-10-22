#!/bin/bash

API_BASE="https://api.optiview.ai"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║       🧪 TESTING BOOSTED AI CLASSIFIER V2 🧪                        ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Testing with BOOSTED confidence scoring:"
echo "  - Domain match: 1 keyword = 0.70 confidence (was 0.30)"
echo "  - Domain weight: 50% (was 30%)"
echo "  - Threshold: 0.40-0.50 (was 0.50-0.60)"
echo ""

declare -a TEST_SITES=(
  "https://www.carvana.com|carvana_v2|Online car marketplace"
  "https://www.hollandamerica.com|holland_v2|Holland America cruise line"
  "https://www.carmax.com|carmax_test|Used car dealer"
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
echo "⏰ Wait ~3-5 minutes, then check Cloudflare logs for:"
echo ""
echo "   Expected for Carvana:"
echo "   [INDUSTRY_AI] ✅ carvana.com → automotive_oem (conf: 0.700+)"
echo ""
echo "   Expected for Holland America:"
echo "   [INDUSTRY_AI] ✅ hollandamerica.com → travel_cruise (conf: 0.950+)"
echo ""
echo "   Expected for CarMax:"
echo "   [INDUSTRY_AI] ✅ carmax.com → automotive_oem (conf: 0.700+)"
echo ""
