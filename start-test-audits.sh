#!/bin/bash

# Start some fresh test audits to showcase new features
API_BASE="https://api.optiview.ai"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║       🚀 STARTING TEST AUDITS FOR NEW FEATURES 🚀                   ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Test sites that should work and showcase different industries
declare -a TEST_SITES=(
  "https://www.toyota.com|toyota_test|Leading automotive manufacturer"
  "https://www.holland.com|holland_test|Holland America cruise line"
  "https://www.carvana.com|carvana_test|Online car buying platform"
)

SUCCESS=0
FAILED=0
declare -a AUDIT_LINKS=()

for site_data in "${TEST_SITES[@]}"; do
  IFS='|' read -r root_url project_id site_description <<< "$site_data"
  
  echo "🚀 Starting audit: $root_url"
  
  json_payload=$(cat <<EOF
{
  "project_id": "$project_id",
  "root_url": "$root_url",
  "site_description": "$site_description",
  "max_pages": 50
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
    
    echo "   ✅ Started! Audit ID: $new_audit_id"
    audit_link="https://app.optiview.ai/audits/$new_audit_id"
    echo "   🔗 $audit_link"
    AUDIT_LINKS+=("$audit_link")
    SUCCESS=$((SUCCESS + 1))
  else
    echo "   ❌ Failed with HTTP $http_code"
    FAILED=$((FAILED + 1))
  fi
  
  echo ""
  sleep 2
done

echo "═════════════════════════════════════════════════════════════════════"
echo ""
echo "📊 SUMMARY"
echo ""
echo "✅ Successfully started: $SUCCESS audits"
echo "❌ Failed to start: $FAILED"
echo ""
echo "🔗 AUDIT LINKS:"
for link in "${AUDIT_LINKS[@]}"; do
  echo "   $link"
done
echo ""
echo "⏰ Audits typically take 2-5 minutes to complete"
echo ""
echo "🎯 What to look for in the completed audits:"
echo "   • Category Breakdown (6 category score cards)"
echo "   • Fix First (top priority improvements)"
echo "   • Citation Summary (AI citation performance)"
echo "   • Industry classification (check audit details)"
echo ""
