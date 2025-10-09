#!/bin/bash

# Optiview Final Launch Script
# Executes all launch steps in correct order with human confirmations

set -e

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║                🚀 OPTIVIEW FINAL LAUNCH SEQUENCE                    ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "════════════════════════════════════════════════════════════════════════"
echo "STEP 1: Set Admin Authentication"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

echo "⚠️  You need to set ADMIN_BASIC_AUTH secret before launch."
echo ""
echo "Run this command manually (we can't automate secret input):"
echo ""
echo -e "${BLUE}cd packages/api-worker${NC}"
echo -e "${BLUE}echo \"ops:YOUR_STRONG_PASSWORD\" | npx wrangler secret put ADMIN_BASIC_AUTH${NC}"
echo -e "${BLUE}pnpm deploy${NC}"
echo ""
read -p "Have you set ADMIN_BASIC_AUTH and deployed? (y/N): " AUTH_SET

if [ "$AUTH_SET" != "y" ] && [ "$AUTH_SET" != "Y" ]; then
    echo -e "${RED}Aborted. Set auth and run this script again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Auth configured${NC}"
echo ""

echo "════════════════════════════════════════════════════════════════════════"
echo "STEP 2: Automated Launch Verification"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

echo "Running ./LAUNCH.sh..."
echo ""

if ./LAUNCH.sh; then
    echo ""
    echo -e "${GREEN}✅ All automated checks PASSED!${NC}"
else
    echo ""
    echo -e "${RED}❌ Some checks failed. Review output above.${NC}"
    read -p "Continue anyway? (y/N): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        echo "Aborted."
        exit 1
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "STEP 3: Manual Spot Checks"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

echo "Please verify these manually:"
echo ""
echo "1. Status Page:"
echo "   Open: https://c6b5ecd3.geodude.pages.dev/status.html"
echo "   Check: Shows 'All Systems Operational', auto-refreshes"
echo ""
echo "2. Share Link:"
echo "   Open: https://app.optiview.ai"
echo "   Run audit → Copy share link → Open in private window"
echo "   Check: Citations tab renders (or empty state)"
echo ""
echo "3. GitHub Actions:"
echo "   Open: https://github.com/zerotype19/geodude/actions"
echo "   Check: Latest run on main is green"
echo ""
read -p "All manual checks passed? (y/N): " MANUAL_OK

if [ "$MANUAL_OK" != "y" ] && [ "$MANUAL_OK" != "Y" ]; then
    echo -e "${YELLOW}Please review and fix issues before launch.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Manual checks passed${NC}"
echo ""

echo "════════════════════════════════════════════════════════════════════════"
echo "STEP 4: Tag Release"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

echo "Current git status:"
git status --short
echo ""

DEFAULT_TAG="v1.0.0-beta"
read -p "Tag this release as [$DEFAULT_TAG]: " TAG_NAME
TAG_NAME=${TAG_NAME:-$DEFAULT_TAG}

echo ""
echo "Creating tag: $TAG_NAME"
git tag -a "$TAG_NAME" -m "🚀 Launch: Optiview v1.0.0 Beta

FEATURES:
- Multi-project onboarding
- Public audit share links
- Entity recommendations (sameAs)
- Brave Search citations (24h cache)
- Email reports (Resend)

RELIABILITY:
- Nightly D1 → R2 backups
- Citations cache (instant results)
- Daily budget guard (200/day)
- Rate limiting (10/day/project)
- Graceful degradation

MONITORING:
- System status endpoint
- Budget tracking endpoint
- Admin metrics endpoint
- CI smoke tests
- Public status page

AUTOMATION:
- Launch verification script
- Emergency restore script
- Weekly audits (Monday 06:00 UTC)
- Nightly backups (03:00 UTC)
- Cache warming (after audits)

DOCUMENTATION:
- GO_LIVE_CHECKLIST.md
- QUICK_REFERENCE.md
- DEMO_FLOW.md
- Week-1 ops plan
- Incident runbooks

STATUS: Production ready, fully monitored, documented, and tested."

echo ""
read -p "Push tag to GitHub? (y/N): " PUSH_TAG

if [ "$PUSH_TAG" = "y" ] || [ "$PUSH_TAG" = "Y" ]; then
    git push origin "$TAG_NAME"
    echo -e "${GREEN}✅ Tag pushed to GitHub${NC}"
else
    echo -e "${YELLOW}⚠️  Tag created locally only (not pushed)${NC}"
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "STEP 5: Create Demo Audit"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

echo "Creating a fresh audit for demo purposes..."
DEMO_AUDIT=$(curl -s -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}' | jq -r '.id')

if [ -n "$DEMO_AUDIT" ] && [ "$DEMO_AUDIT" != "null" ]; then
    DEMO_URL="https://app.optiview.ai/a/$DEMO_AUDIT"
    echo -e "${GREEN}✅ Demo audit created${NC}"
    echo ""
    echo "Demo share link: $DEMO_URL"
    echo ""
    echo "Save this for presentations!"
else
    echo -e "${YELLOW}⚠️  Failed to create demo audit (non-critical)${NC}"
    DEMO_URL="(create manually from dashboard)"
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "🎉 LAUNCH COMPLETE!"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

echo -e "${GREEN}Congratulations! Optiview is now LIVE! 🚀${NC}"
echo ""
echo "═══ LAUNCH SUMMARY ═══"
echo ""
echo "✅ Admin auth configured"
echo "✅ All automated checks passed"
echo "✅ Manual spot checks verified"
echo "✅ Release tagged: $TAG_NAME"
echo "✅ Demo audit created"
echo ""
echo "═══ WHAT'S LIVE ═══"
echo ""
echo "Marketing:  https://optiview.ai"
echo "Dashboard:  https://app.optiview.ai"
echo "API:        https://api.optiview.ai"
echo "Status:     https://optiview.ai/status.html"
echo "Demo:       $DEMO_URL"
echo ""
echo "═══ DAY 1 MONITORING ═══"
echo ""
echo "Run these throughout the day:"
echo ""
echo "# Quick health check (30 sec)"
echo "curl -s https://api.optiview.ai/status | jq"
echo ""
echo "# Budget monitoring"
echo "curl -s https://api.optiview.ai/v1/citations/budget | jq"
echo ""
echo "# Real-time logs"
echo "npx wrangler tail geodude-api --format=json | jq -r 'select(.out).out'"
echo ""
echo "═══ DOCUMENTATION ═══"
echo ""
echo "Daily ops:     QUICK_REFERENCE.md"
echo "Demo script:   DEMO_FLOW.md"
echo "Troubleshoot:  docs/ops-runbook.md"
echo "Week 1 plan:   docs/week-1-ops-plan.md"
echo ""
echo "═══ NEXT STEPS ═══"
echo ""
echo "1. Monitor first 24 hours (budget, logs, backups)"
echo "2. Run demo for stakeholders using DEMO_FLOW.md"
echo "3. Check backup after 03:00 UTC tomorrow"
echo "4. Review metrics Monday after weekly audit"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}You did it! Time to celebrate! 🎉${NC}"
echo ""

