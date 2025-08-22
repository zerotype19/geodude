#!/bin/bash

# Quick Filter Parity Test
# Tests basic functionality without full CI setup

set -euo pipefail

PROJECT_ID="prj_UHoetismrowc"
API_BASE="https://api.optiview.ai"

echo "🔍 Quick Filter Parity Test"
echo "Project: $PROJECT_ID"
echo "API: $API_BASE"
echo

# Test 1: Basic Events vs Content parity
echo "Test 1: Basic parity (24h, all traffic)"
echo "----------------------------------------"

# Get Events total
EVENTS_RESPONSE=$(curl -s "$API_BASE/api/events/summary?project_id=$PROJECT_ID&window=24h")
EVENTS_TOTAL=$(echo "$EVENTS_RESPONSE" | jq -r '.totals.events // 0')
echo "Events total: $EVENTS_TOTAL"

# Get Content total
CONTENT_RESPONSE=$(curl -s "$API_BASE/api/content?project_id=$PROJECT_ID&window=24h&q=&type=&aiOnly=false&page=1&pageSize=50")
CONTENT_TOTAL=$(echo "$CONTENT_RESPONSE" | jq -r '.total // 0')
echo "Content total: $CONTENT_TOTAL"

# Calculate delta
if [ "$EVENTS_TOTAL" -gt 0 ]; then
    DELTA=$(echo "scale=2; (($CONTENT_TOTAL - $EVENTS_TOTAL) / $EVENTS_TOTAL) * 100" | bc -l)
    DELTA_ABS=${DELTA#-}
    echo "Delta: ${DELTA}%"
    
    if (( $(echo "$DELTA_ABS <= 1.0" | bc -l) )); then
        echo "✅ PASS: Within 1% tolerance"
    else
        echo "❌ FAIL: Outside 1% tolerance"
    fi
else
    echo "⚠️  No events data available"
fi

echo

# Test 2: Human via AI slice
echo "Test 2: Human via AI slice (24h)"
echo "----------------------------------"

# Get Events Human via AI total
EVENTS_AI_RESPONSE=$(curl -s "$API_BASE/api/events/summary?project_id=$PROJECT_ID&window=24h&traffic_class=human_via_ai")
EVENTS_AI_TOTAL=$(echo "$EVENTS_AI_RESPONSE" | jq -r '.totals.events // 0')
echo "Events Human via AI total: $EVENTS_AI_TOTAL"

# Get Content Human via AI total
CONTENT_AI_RESPONSE=$(curl -s "$API_BASE/api/content?project_id=$PROJECT_ID&window=24h&q=&type=&aiOnly=false&page=1&pageSize=50&class=human_via_ai")
CONTENT_AI_TOTAL=$(echo "$CONTENT_AI_RESPONSE" | jq -r '.total // 0')
echo "Content Human via AI total: $CONTENT_AI_TOTAL"

if [ "$EVENTS_AI_TOTAL" -eq "$CONTENT_AI_TOTAL" ]; then
    echo "✅ PASS: Human via AI counts match exactly"
else
    echo "❌ FAIL: Human via AI counts don't match"
fi

echo

# Test 3: AI Traffic Only toggle
echo "Test 3: AI Traffic Only toggle"
echo "------------------------------"

# Without AI Traffic Only
CONTENT_NO_AI=$(curl -s "$API_BASE/api/content?project_id=$PROJECT_ID&window=24h&q=&type=&aiOnly=false&page=1&pageSize=50&class=human_via_ai&source=perplexity" | jq -r '.total // 0')
echo "Content without AI Only: $CONTENT_NO_AI"

# With AI Traffic Only
CONTENT_WITH_AI=$(curl -s "$API_BASE/api/content?project_id=$PROJECT_ID&window=24h&q=&type=&aiOnly=true&page=1&pageSize=50&class=human_via_ai&source=perplexity" | jq -r '.total // 0')
echo "Content with AI Only: $CONTENT_WITH_AI"

if [ "$CONTENT_WITH_AI" -le "$CONTENT_NO_AI" ]; then
    echo "✅ PASS: AI Traffic Only returns fewer or equal rows"
else
    echo "❌ FAIL: AI Traffic Only returns more rows"
fi

echo
echo "🎯 Quick test completed!"
echo "For comprehensive testing, run: ./scripts/verify-filter-parity.sh prod $PROJECT_ID"
