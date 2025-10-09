#!/bin/bash
# Production Verification Script
# Run this after custom domain is attached to verify everything works

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║           OPTIVIEW GEODUDE - PRODUCTION VERIFICATION           ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
  local name="$1"
  local url="$2"
  local expected="$3"
  
  echo -n "Testing $name... "
  result=$(curl -sI "$url" 2>&1 | head -1 | grep -o "HTTP/[0-9.]* [0-9]*" || echo "FAIL")
  
  if echo "$result" | grep -q "$expected"; then
    echo -e "${GREEN}✅ PASS${NC}"
    return 0
  else
    echo -e "${RED}❌ FAIL${NC} (got: $result)"
    return 1
  fi
}

# Counter
PASS=0
FAIL=0

echo "🔍 DNS VERIFICATION"
echo "===================="
echo ""

echo -n "app.optiview.ai DNS... "
DNS=$(dig app.optiview.ai +short | head -1)
if [ -n "$DNS" ]; then
  echo -e "${GREEN}✅ $DNS${NC}"
  ((PASS++))
else
  echo -e "${RED}❌ Not resolving${NC}"
  ((FAIL++))
fi
echo ""

echo "🌐 ENDPOINT HEALTH"
echo "===================="
echo ""

if test_endpoint "API" "https://api.optiview.ai/health" "200"; then ((PASS++)); else ((FAIL++)); fi
if test_endpoint "Collector" "https://collector.optiview.ai/px" "200"; then ((PASS++)); else ((FAIL++)); fi
if test_endpoint "Marketing" "https://optiview.ai/" "200"; then ((PASS++)); else ((FAIL++)); fi
if test_endpoint "Dashboard" "https://app.optiview.ai/" "200"; then ((PASS++)); else ((FAIL++)); fi

echo ""
echo "🔐 SECURITY HEADERS"
echo "===================="
echo ""

echo -n "Checking CSP... "
CSP=$(curl -sI https://app.optiview.ai/ | grep -i "content-security-policy")
if [ -n "$CSP" ]; then
  echo -e "${GREEN}✅ Present${NC}"
  ((PASS++))
else
  echo -e "${YELLOW}⚠️  Missing${NC}"
  ((FAIL++))
fi

echo -n "Checking X-Frame-Options... "
XFO=$(curl -sI https://app.optiview.ai/ | grep -i "x-frame-options")
if [ -n "$XFO" ]; then
  echo -e "${GREEN}✅ Present${NC}"
  ((PASS++))
else
  echo -e "${YELLOW}⚠️  Missing${NC}"
  ((FAIL++))
fi

echo ""
echo "🧪 FUNCTIONAL TESTS"
echo "===================="
echo ""

echo -n "Running audit... "
AUDIT_RESPONSE=$(curl -s -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}' 2>&1)

AUDIT_ID=$(echo "$AUDIT_RESPONSE" | jq -r '.id' 2>/dev/null)

if [ "$AUDIT_ID" != "null" ] && [ -n "$AUDIT_ID" ]; then
  echo -e "${GREEN}✅ $AUDIT_ID${NC}"
  ((PASS++))
  
  echo "Share link: https://app.optiview.ai/a/$AUDIT_ID"
  
  echo -n "Checking share link... "
  SHARE_STATUS=$(curl -sI "https://app.optiview.ai/a/$AUDIT_ID" 2>&1 | head -1 | grep -o "200" || echo "")
  if [ -n "$SHARE_STATUS" ]; then
    echo -e "${GREEN}✅ Accessible${NC}"
    ((PASS++))
  else
    echo -e "${RED}❌ Not accessible${NC}"
    ((FAIL++))
  fi
  
  echo -n "Checking audit data... "
  AUDIT_DATA=$(curl -s "https://api.optiview.ai/v1/audits/$AUDIT_ID")
  HAS_SCORES=$(echo "$AUDIT_DATA" | jq -r '.scores.total' 2>/dev/null)
  HAS_CITATIONS=$(echo "$AUDIT_DATA" | jq -r '.citations' 2>/dev/null)
  
  if [ "$HAS_SCORES" != "null" ] && [ "$HAS_CITATIONS" != "null" ]; then
    echo -e "${GREEN}✅ Complete (score: $HAS_SCORES)${NC}"
    ((PASS++))
  else
    echo -e "${RED}❌ Incomplete${NC}"
    ((FAIL++))
  fi
else
  echo -e "${RED}❌ Failed to create${NC}"
  ((FAIL++))
  echo "Response: $AUDIT_RESPONSE"
fi

echo ""
echo "📊 SUMMARY"
echo "===================="
echo ""
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED - PRODUCTION READY!${NC}"
  echo ""
  echo "🎉 Optiview Geodude is live and operational!"
  echo ""
  echo "Next steps:"
  echo "  1. Share on LinkedIn/Slack"
  echo "  2. Monitor logs for 24h"
  echo "  3. Gather user feedback"
  echo "  4. Plan next features"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo ""
  echo "Please review failures above and fix before launch."
  exit 1
fi

