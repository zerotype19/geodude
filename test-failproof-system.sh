#!/bin/bash
# Failproof AI Classifier - End-to-End Test
# Tests: UI audit creation → AI classification → Prompt generation

set -e

API_BASE="https://api.optiview.ai"
COOKIE="ov_sess=test_cookie"  # Replace with real cookie if needed

echo "========================================="
echo "FAILPROOF AI CLASSIFIER - E2E TEST"
echo "========================================="
echo ""

# Test domains (never tested before)
declare -a domains=(
  "nordstrom.com|retail.fashion|High-end department store"
  "delta.com|travel.air|Major airline"
  "marriott.com|travel.hotels|Hotel chain"
  "wellsfargo.com|finance.bank|National bank"
  "bluecrossblueshield.com|health.payers|Health insurance"
)

for domain_info in "${domains[@]}"; do
  IFS='|' read -r domain expected_industry description <<< "$domain_info"
  
  echo "========================================="
  echo "Testing: $domain ($description)"
  echo "Expected Industry: $expected_industry"
  echo "========================================="
  
  # Create audit via API
  echo ""
  echo "[1/3] Creating audit..."
  response=$(curl -s -X POST "$API_BASE/api/audits" \
    -H "Content-Type: application/json" \
    -H "Cookie: $COOKIE" \
    -d "{
      \"project_id\": \"test\",
      \"root_url\": \"https://$domain\",
      \"site_description\": \"$description\",
      \"max_pages\": 5
    }")
  
  audit_id=$(echo "$response" | grep -o '"audit_id":"[^"]*' | cut -d'"' -f4)
  
  if [ -z "$audit_id" ]; then
    echo "❌ Failed to create audit"
    echo "Response: $response"
    continue
  fi
  
  echo "✅ Audit created: $audit_id"
  
  # Wait for audit to process
  echo ""
  echo "[2/3] Waiting for audit to process (30s)..."
  sleep 30
  
  # Check audit industry classification
  echo ""
  echo "[3/3] Checking industry classification..."
  audit_data=$(curl -s "$API_BASE/api/audits/$audit_id" \
    -H "Cookie: $COOKIE")
  
  classified_industry=$(echo "$audit_data" | grep -o '"industry":"[^"]*' | cut -d'"' -f4)
  industry_source=$(echo "$audit_data" | grep -o '"industry_source":"[^"]*' | cut -d'"' -f4)
  industry_confidence=$(echo "$audit_data" | grep -o '"industry_confidence":[0-9.]*' | cut -d':' -f2)
  
  echo "  Classified as: $classified_industry"
  echo "  Source: $industry_source"
  echo "  Confidence: $industry_confidence"
  
  # Verify classification
  if [ "$classified_industry" = "$expected_industry" ]; then
    echo "  ✅ CORRECT classification!"
  elif [[ "$classified_industry" == "${expected_industry%%.*}"* ]]; then
    echo "  ⚠️  PARTIAL match (correct top-level category)"
  else
    echo "  ❌ WRONG classification (expected: $expected_industry)"
  fi
  
  # Check if AI was used
  if [[ "$industry_source" == *"ai"* ]] || [[ "$industry_source" == "ai_worker" ]]; then
    echo "  ✅ Used AI classifier"
  elif [ "$industry_source" = "domain_rules" ]; then
    echo "  ℹ️  Used whitelist (domain rules)"
  else
    echo "  ⚠️  Used fallback: $industry_source"
  fi
  
  echo ""
  echo "Audit URL: https://app.optiview.ai/audits/$audit_id"
  echo ""
done

echo "========================================="
echo "TEST COMPLETE"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Check worker logs for [AI_CLASSIFY] messages"
echo "2. Wait 5-10 min for citations cron to run"
echo "3. Verify prompts are human-sounding"
echo ""
echo "Expected logs:"
echo "  [AI_CLASSIFY] nordstrom.com → retail.fashion (0.92) - ..."
echo "  [AI_CLASSIFY] delta.com → travel.air (0.95) - ..."
echo ""

