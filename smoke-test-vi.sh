#!/bin/bash

# Visibility Intelligence Smoke Test Script
# Run this after deploying to verify end-to-end functionality

set -e

BASE_URL="https://api.optiview.ai"
AUDIT_ID="${1:-aud_1760445900364_pclblknsv}"

echo "🧪 Visibility Intelligence Smoke Test"
echo "======================================"
echo "Base URL: $BASE_URL"
echo "Audit ID: $AUDIT_ID"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to check response
check_response() {
    local test_name="$1"
    local response="$2"
    local expected_status="$3"
    
    if echo "$response" | grep -q '"error"'; then
        echo -e "${RED}❌ $test_name: FAILED${NC}"
        echo "$response" | jq -r '.error // "Unknown error"'
        return 1
    else
        echo -e "${GREEN}✅ $test_name: PASSED${NC}"
        return 0
    fi
}

# 1. Check secrets and availability
echo "1️⃣  Checking secrets and source availability..."
SECRETS_RESPONSE=$(curl -s "$BASE_URL/api/vi/diag/secrets")
SOURCES_RESPONSE=$(curl -s "$BASE_URL/api/vi/diag/sources")

echo "Secrets status:"
echo "$SECRETS_RESPONSE" | jq -r 'to_entries[] | "  \(.key): \(.value)"'

echo "Available sources:"
echo "$SOURCES_RESPONSE" | jq -r '.sources // "[]"'

# Check if all three sources are available
AVAILABLE_SOURCES=$(echo "$SOURCES_RESPONSE" | jq -r '.sources // [] | length')
if [ "$AVAILABLE_SOURCES" -eq 3 ]; then
    echo -e "${GREEN}✅ All 3 sources available${NC}"
else
    echo -e "${RED}❌ Only $AVAILABLE_SOURCES sources available (expected 3)${NC}"
fi
echo ""

# 2. Test parser sanity
echo "2️⃣  Testing citation parser..."
PARSER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/vi/test/parser" \
  -H 'content-type: application/json' \
  --data '{
    "text": "- Cologuard® — https://www.cologuardtest.com\n- Insurance Coverage — https://www.cologuardtest.com/insurance-coverage\n- Medicare Coverage — https://www.medicare.gov/coverage/cologuard-test\n- FAQs — https://www.cologuardtest.com/faq"
  }')

CITATION_COUNT=$(echo "$PARSER_RESPONSE" | jq -r '.citations | length')
echo "Parser extracted $CITATION_COUNT citations"

if [ "$CITATION_COUNT" -eq 4 ]; then
    echo -e "${GREEN}✅ Parser test: PASSED (4 citations)${NC}"
else
    echo -e "${RED}❌ Parser test: FAILED (expected 4, got $CITATION_COUNT)${NC}"
fi

# Check if cologuardtest.com is present
if echo "$PARSER_RESPONSE" | jq -r '.citations[].ref_url' | grep -q "cologuardtest.com"; then
    echo -e "${GREEN}✅ Cologuard URLs detected${NC}"
else
    echo -e "${RED}❌ Cologuard URLs missing${NC}"
fi
echo ""

# 3. Force a fresh run
echo "3️⃣  Forcing fresh VI run..."
RUN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/vi/run?audit_id=$AUDIT_ID&regenerate_intents=true" \
  -H 'content-type: application/json' \
  --data '{
    "sources": ["perplexity", "chatgpt_search", "claude"],
    "max_intents": 5
  }')

RUN_ID=$(echo "$RUN_RESPONSE" | jq -r '.run_id // "null"')
if [ "$RUN_ID" != "null" ] && [ "$RUN_ID" != "" ]; then
    echo -e "${GREEN}✅ Fresh run created: $RUN_ID${NC}"
else
    echo -e "${RED}❌ Failed to create fresh run${NC}"
    echo "$RUN_RESPONSE"
    exit 1
fi
echo ""

# 4. Check provenance
echo "4️⃣  Checking data provenance..."
PROVENANCE_RESPONSE=$(curl -s "$BASE_URL/api/vi/debug/provenance?audit_id=$AUDIT_ID")

AUDIT_DOMAIN=$(echo "$PROVENANCE_RESPONSE" | jq -r '.audit.domain // "null"')
RUN_DOMAIN=$(echo "$PROVENANCE_RESPONSE" | jq -r '.run.domain // "null"')
ALIAS_MATCH=$(echo "$PROVENANCE_RESPONSE" | jq -r '.run.alias_match // []')

echo "Audit domain: $AUDIT_DOMAIN"
echo "Run domain: $RUN_DOMAIN"
echo "Alias match: $ALIAS_MATCH"

if [ "$AUDIT_DOMAIN" != "null" ] && [ "$RUN_DOMAIN" != "null" ]; then
    echo -e "${GREEN}✅ Provenance check: PASSED${NC}"
else
    echo -e "${RED}❌ Provenance check: FAILED${NC}"
fi
echo ""

# 5. Check grouped results
echo "5️⃣  Checking grouped results..."
GROUPED_RESPONSE=$(curl -s "$BASE_URL/api/vi/results:grouped?audit_id=$AUDIT_ID&source=chatgpt_search")

TOTAL_CITATIONS=$(echo "$GROUPED_RESPONSE" | jq -r '.counts.chatgpt_search.citations // 0')
TOTAL_PROMPTS=$(echo "$GROUPED_RESPONSE" | jq -r '.counts.chatgpt_search.prompts // 0')
AUDITED_COUNT=$(echo "$GROUPED_RESPONSE" | jq -r '.prompts[].citations[] | select(.was_audited == true) | .ref_url' | wc -l)

echo "ChatGPT citations: $TOTAL_CITATIONS"
echo "ChatGPT prompts: $TOTAL_PROMPTS"
echo "Audited citations: $AUDITED_COUNT"

if [ "$TOTAL_CITATIONS" -gt 0 ]; then
    echo -e "${GREEN}✅ Citations found${NC}"
else
    echo -e "${RED}❌ No citations found${NC}"
fi

if [ "$AUDITED_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Audited citations detected${NC}"
else
    echo -e "${YELLOW}⚠️  No audited citations found${NC}"
fi
echo ""

# 6. Summary
echo "📊 Test Summary"
echo "==============="
echo "Audit ID: $AUDIT_ID"
echo "Run ID: $RUN_ID"
echo "Total Citations: $TOTAL_CITATIONS"
echo "Audited Citations: $AUDITED_COUNT"

if [ "$TOTAL_CITATIONS" -gt 0 ] && [ "$AUDIT_DOMAIN" != "null" ]; then
    echo -e "${GREEN}🎉 All tests passed! VI system is working correctly.${NC}"
    exit 0
else
    echo -e "${RED}💥 Some tests failed. Check the output above.${NC}"
    exit 1
fi
