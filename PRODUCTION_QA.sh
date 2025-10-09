#!/bin/bash
set -e

# Production QA Script for v0.14 (Citations) & v0.15 (Email Reports)
# Run after setting secrets and deploying API worker

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║           🧪 PRODUCTION QA - v0.14 & v0.15                          ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Configuration
API_KEY="prj_live_8c5e1556810d52f8d5e8b179"
PROPERTY_ID="prop_demo"
API_BASE="https://api.optiview.ai"
APP_BASE="https://app.optiview.ai"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════════════════════════════════"
echo "STEP 1: Health Check"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

echo "Checking API health..."
HEALTH=$(curl -s $API_BASE/health)
if [[ $HEALTH == *"ok"* ]]; then
  echo -e "${GREEN}✅ API is healthy${NC}"
else
  echo -e "${RED}❌ API health check failed${NC}"
  echo "Response: $HEALTH"
fi
echo ""

echo "═══════════════════════════════════════════════════════════════════════"
echo "STEP 2: v0.14 QA - Real Citations (Bing)"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

echo "Starting fresh audit..."
AUDIT_RESPONSE=$(curl -s -X POST $API_BASE/v1/audits/start \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  -d "{\"property_id\":\"$PROPERTY_ID\"}")

AUDIT_ID=$(echo $AUDIT_RESPONSE | jq -r '.id')

if [[ $AUDIT_ID != "null" && $AUDIT_ID != "" ]]; then
  echo -e "${GREEN}✅ Audit started: $AUDIT_ID${NC}"
else
  echo -e "${RED}❌ Failed to start audit${NC}"
  echo "Response: $AUDIT_RESPONSE"
  exit 1
fi
echo ""

echo "Waiting 10 seconds for audit to process..."
sleep 10
echo ""

echo "Checking citations endpoint..."
CITATIONS=$(curl -s $API_BASE/v1/audits/$AUDIT_ID/citations)
CITATION_COUNT=$(echo $CITATIONS | jq '.items | length')

echo "Citations found: $CITATION_COUNT"
if [[ $CITATION_COUNT -gt 0 ]]; then
  echo -e "${GREEN}✅ Citations populated!${NC}"
  echo ""
  echo "Sample citation:"
  echo $CITATIONS | jq '.items[0]'
else
  echo -e "${YELLOW}⚠️  No citations yet (may need Bing API key or more time)${NC}"
  echo "Response: $CITATIONS"
fi
echo ""

echo "Public audit URL:"
echo -e "${GREEN}$APP_BASE/a/$AUDIT_ID${NC}"
echo ""

echo "═══════════════════════════════════════════════════════════════════════"
echo "STEP 3: v0.15 QA - Email Reports"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

echo "Triggering manual email for audit: $AUDIT_ID"
EMAIL_RESPONSE=$(curl -s -X POST $API_BASE/v1/audits/$AUDIT_ID/email \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json")

MESSAGE_ID=$(echo $EMAIL_RESPONSE | jq -r '.messageId')

if [[ $MESSAGE_ID != "null" && $MESSAGE_ID != "" ]]; then
  echo -e "${GREEN}✅ Email sent!${NC}"
  echo "Message ID: $MESSAGE_ID"
  echo "Sent to: $(echo $EMAIL_RESPONSE | jq -r '.sentTo')"
else
  ERROR=$(echo $EMAIL_RESPONSE | jq -r '.error')
  if [[ $ERROR == *"owner_email"* ]]; then
    echo -e "${YELLOW}⚠️  No owner_email set on project${NC}"
    echo ""
    echo "To fix, run:"
    echo "  cd packages/api-worker"
    echo "  wrangler d1 execute optiview_db --remote \\"
    echo "    --command \"UPDATE projects SET owner_email='you@example.com' WHERE id='prj_demo';\""
  elif [[ $ERROR == *"Resend"* ]]; then
    echo -e "${YELLOW}⚠️  Resend not configured${NC}"
    echo "Error: $ERROR"
    echo ""
    echo "To fix, run:"
    echo "  cd packages/api-worker"
    echo "  echo \"YOUR_RESEND_KEY\" | wrangler secret put RESEND_API_KEY"
  else
    echo -e "${RED}❌ Email failed${NC}"
    echo "Response: $EMAIL_RESPONSE"
  fi
fi
echo ""

echo "═══════════════════════════════════════════════════════════════════════"
echo "STEP 4: Rate Limiting Check"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

echo "Testing rate limits (hitting 10/day limit)..."
for i in {1..12}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST $API_BASE/v1/audits/start \
    -H "x-api-key: $API_KEY" \
    -H "content-type: application/json" \
    -d "{\"property_id\":\"$PROPERTY_ID\"}")
  
  if [[ $STATUS == "429" ]]; then
    echo -e "${GREEN}✅ Rate limit triggered at request $i (status: $STATUS)${NC}"
    echo ""
    echo "Checking rate-limit headers..."
    curl -s -D - -o /dev/null -X POST $API_BASE/v1/audits/start \
      -H "x-api-key: $API_KEY" \
      -H "content-type: application/json" \
      -d "{\"property_id\":\"$PROPERTY_ID\"}" | grep -i "rate-limit\|retry-after" || echo -e "${YELLOW}⚠️  Rate-limit headers not found${NC}"
    break
  elif [[ $STATUS == "200" || $STATUS == "201" ]]; then
    echo "Request $i: $STATUS (within limit)"
  else
    echo "Request $i: $STATUS (unexpected)"
  fi
done
echo ""

echo "═══════════════════════════════════════════════════════════════════════"
echo "QA SUMMARY"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""
echo "Audit ID: $AUDIT_ID"
echo "Public URL: $APP_BASE/a/$AUDIT_ID"
echo "Citations: $CITATION_COUNT items"
echo ""
echo "Next Steps:"
echo "1. Open public URL and check Citations tab"
echo "2. Check your email inbox for report"
echo "3. Verify email has score, issues, citations count"
echo "4. Test share link in private window"
echo ""
echo "═══════════════════════════════════════════════════════════════════════"

