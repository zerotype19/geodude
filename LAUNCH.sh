#!/bin/bash

# Optiview Go-Live Launch Script
# Run this after setting ADMIN_BASIC_AUTH to verify all systems

set -e

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║              🚀 OPTIVIEW GO-LIVE VERIFICATION SCRIPT                ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS="${GREEN}✅ PASS${NC}"
FAIL="${RED}❌ FAIL${NC}"
WARN="${YELLOW}⚠️  WARN${NC}"

FAILURES=0

# Function to check if command succeeded
check() {
    if [ $? -eq 0 ]; then
        echo -e "$PASS"
        return 0
    else
        echo -e "$FAIL"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

echo "════════════════════════════════════════════════════════════════════════"
echo "STEP 1: Environment Check"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# Check for required commands
echo -n "Checking for curl... "
command -v curl >/dev/null 2>&1 && check || check

echo -n "Checking for jq... "
command -v jq >/dev/null 2>&1 && check || check

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "STEP 2: API Endpoints Verification"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# Test status endpoint
echo -n "Testing /status endpoint... "
STATUS_RESPONSE=$(curl -s https://api.optiview.ai/status)
echo "$STATUS_RESPONSE" | jq -e '.status=="ok"' >/dev/null 2>&1 && check || check

if echo "$STATUS_RESPONSE" | jq -e '.status=="ok"' >/dev/null 2>&1; then
    echo "  Latest audit: $(echo "$STATUS_RESPONSE" | jq -r '.latest_audit.completed_at // "none"')"
    echo "  Budget used: $(echo "$STATUS_RESPONSE" | jq -r '.citations_budget.used // 0')/$(echo "$STATUS_RESPONSE" | jq -r '.citations_budget.max // 200')"
fi

echo ""

# Test budget endpoint
echo -n "Testing /v1/citations/budget endpoint... "
BUDGET_RESPONSE=$(curl -s https://api.optiview.ai/v1/citations/budget)
echo "$BUDGET_RESPONSE" | jq -e 'has("used") and has("remaining") and has("max")' >/dev/null 2>&1 && check || check

if echo "$BUDGET_RESPONSE" | jq -e 'has("remaining")' >/dev/null 2>&1; then
    REMAINING=$(echo "$BUDGET_RESPONSE" | jq -r '.remaining')
    echo "  Remaining: $REMAINING"
    if [ "$REMAINING" -lt 20 ]; then
        echo -e "  ${WARN} Budget low! Consider increasing CITATIONS_DAILY_BUDGET"
    fi
fi

echo ""

# Test admin metrics endpoint (requires auth)
echo "Testing /v1/admin/metrics endpoint..."
echo "  Note: This requires ADMIN_BASIC_AUTH to be set"
echo -n "  Checking if auth required (should 401)... "
curl -s -o /dev/null -w "%{http_code}" https://api.optiview.ai/v1/admin/metrics | grep -q "401" && check || check

echo ""
echo "  To test with auth, run:"
echo "  curl -s -u ops:YOUR_PASSWORD https://api.optiview.ai/v1/admin/metrics | jq"
echo ""

echo "════════════════════════════════════════════════════════════════════════"
echo "STEP 3: Fresh Audit Test"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

echo "Starting new audit..."
AUDIT_RESPONSE=$(curl -s -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}')

AUDIT_ID=$(echo "$AUDIT_RESPONSE" | jq -r '.id // empty')

if [ -z "$AUDIT_ID" ]; then
    echo -e "${FAIL} Failed to start audit"
    echo "Response: $AUDIT_RESPONSE"
    FAILURES=$((FAILURES + 1))
else
    echo -e "${PASS} Audit started: $AUDIT_ID"
    
    # Check citations
    echo -n "Checking citations endpoint... "
    CITATIONS_RESPONSE=$(curl -s "https://api.optiview.ai/v1/audits/$AUDIT_ID/citations")
    echo "$CITATIONS_RESPONSE" | jq -e 'has("items")' >/dev/null 2>&1 && check || check
    
    CITATION_COUNT=$(echo "$CITATIONS_RESPONSE" | jq '.items | length')
    echo "  Citations found: $CITATION_COUNT"
    
    # Check full audit
    echo -n "Checking full audit endpoint... "
    FULL_AUDIT=$(curl -s "https://api.optiview.ai/v1/audits/$AUDIT_ID")
    echo "$FULL_AUDIT" | jq -e 'has("scores") and has("pages") and has("issues")' >/dev/null 2>&1 && check || check
    
    echo ""
    echo "  Share link: https://app.optiview.ai/a/$AUDIT_ID"
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "STEP 4: R2 Backups Check"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

TODAY=$(date -u +%F)
echo "Checking for backups on $TODAY..."
echo "(Note: First backup runs at 03:00 UTC, may be empty before then)"
echo ""

BACKUP_COUNT=$(npx wrangler r2 object list geodude-backups --prefix "backups/$TODAY/" 2>/dev/null | grep -c "\.jsonl" || echo "0")

if [ "$BACKUP_COUNT" -eq 4 ]; then
    echo -e "${PASS} All 4 backup files present"
elif [ "$BACKUP_COUNT" -eq 0 ]; then
    echo -e "${WARN} No backups yet (expected if before 03:00 UTC)"
else
    echo -e "${WARN} Found $BACKUP_COUNT/4 backup files"
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "STEP 5: Status Page Check"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

echo "Status page deployed at:"
echo "  Preview:    https://c6b5ecd3.geodude.pages.dev/status.html"
echo "  Production: https://optiview.ai/status.html (once DNS live)"
echo ""

echo -n "Checking if page is accessible... "
STATUS_PAGE=$(curl -s -o /dev/null -w "%{http_code}" "https://c6b5ecd3.geodude.pages.dev/status.html")
[ "$STATUS_PAGE" = "200" ] && check || check

echo -n "Checking for noindex meta tag... "
curl -s "https://c6b5ecd3.geodude.pages.dev/status.html" | grep -q 'content="noindex,nofollow"' && check || check

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "STEP 6: CI/CD Status"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

echo "Check GitHub Actions at:"
echo "  https://github.com/zerotype19/geodude/actions"
echo ""
echo "Expected:"
echo "  ✅ Latest workflow run: green checkmark"
echo "  ✅ Citations shape test: passing"
echo "  ✅ Status endpoint test: passing"
echo ""

echo "════════════════════════════════════════════════════════════════════════"
echo "SUMMARY"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED! SYSTEM IS GO-LIVE READY! 🎉${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Set ADMIN_BASIC_AUTH if not already set"
    echo "  2. Test metrics endpoint with auth"
    echo "  3. Verify CI is green on GitHub Actions"
    echo "  4. Monitor first 24 hours (budget, backups, latency)"
    echo ""
    echo "Monitoring commands:"
    echo "  curl -s https://api.optiview.ai/status | jq"
    echo "  curl -s https://api.optiview.ai/v1/citations/budget | jq"
    echo "  npx wrangler tail --format=json | jq -r 'select(.out).out'"
    echo ""
    exit 0
else
    echo -e "${RED}❌ $FAILURES CHECK(S) FAILED${NC}"
    echo ""
    echo "Review failures above and:"
    echo "  1. Check worker logs: npx wrangler tail geodude-api"
    echo "  2. Verify secrets are set: npx wrangler secret list"
    echo "  3. Confirm deployments: npx wrangler deployments list"
    echo ""
    exit 1
fi

