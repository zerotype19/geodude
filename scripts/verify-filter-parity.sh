#!/bin/bash

# Filter Parity Verification Script
# Tests that Events and Content pages return reconcilable data for the same filter slices
# Usage: ./scripts/verify-filter-parity.sh [staging|prod] [project_id]

set -euo pipefail

# Configuration
ENVIRONMENT=${1:-staging}
PROJECT_ID=${2:-"prj_UHoeticexample"}
SLACK_WEBHOOK=${SLACK_WEBHOOK:-""}

# API endpoints
if [ "$ENVIRONMENT" = "prod" ]; then
    API_BASE="https://api.optiview.ai"
    FRONTEND_URL="https://optiview.ai"
else
    API_BASE="https://staging-api.optiview.ai"
    FRONTEND_URL="https://staging.optiview.ai"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
FAILURE_DETAILS=()

# Helper functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# API request helper
api_request() {
    local endpoint="$1"
    local params="$2"
    local url="$API_BASE$endpoint?$params"
    
    log "Requesting: $url"
    
    local response
    response=$(curl -s -w "\n%{http_code}" "$url" \
        -H "Accept: application/json" \
        -H "Origin: $FRONTEND_URL" \
        --max-time 30)
    
    local http_code
    http_code=$(echo "$response" | tail -n1)
    local body
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" != "200" ]; then
        error "HTTP $http_code for $endpoint"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
    
    echo "$body"
}

# Calculate delta percentage
calculate_delta() {
    local events_total="$1"
    local content_sum="$2"
    
    if [ "$events_total" -eq 0 ] && [ "$content_sum" -eq 0 ]; then
        echo "0"
        return
    fi
    
    if [ "$events_total" -eq 0 ]; then
        echo "100"
        return
    fi
    
    local delta
    delta=$(echo "scale=2; (($content_sum - $events_total) / $events_total) * 100" | bc -l)
    echo "${delta#-}" # Absolute value
}

# Test a specific filter slice
test_filter_slice() {
    local test_name="$1"
    local events_params="$2"
    local content_params="$3"
    local expected_delta_threshold="${4:-1.0}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log "Testing: $test_name"
    
    # Get Events summary
    local events_response
    events_response=$(api_request "/api/events/summary" "$events_params") || {
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILURE_DETAILS+=("$test_name: Events API failed")
        return 1
    }
    
    local events_total
    events_total=$(echo "$events_response" | jq -r '.totals.events // 0')
    
    # Get Content list
    local content_response
    content_response=$(api_request "/api/content" "$content_params") || {
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILURE_DETAILS+=("$test_name: Content API failed")
        return 1
    }
    
    # Sum traffic_count and ai_referrals
    local traffic_sum
    traffic_sum=$(echo "$content_response" | jq -r '.items[]?.traffic_count // 0' | awk '{sum += $1} END {print sum}')
    local ai_referrals_sum
    ai_referrals_sum=$(echo "$content_response" | jq -r '.items[]?.ai_referrals // 0' | awk '{sum += $1} END {print sum}')
    
    # Calculate deltas
    local traffic_delta
    traffic_delta=$(calculate_delta "$events_total" "$traffic_sum")
    local ai_delta
    ai_delta=$(calculate_delta "$events_total" "$ai_referrals_sum")
    
    # Check thresholds
    local traffic_pass=false
    local ai_pass=false
    
    if (( $(echo "$traffic_delta <= $expected_delta_threshold" | bc -l) )); then
        traffic_pass=true
    fi
    
    if (( $(echo "$ai_delta <= $expected_delta_threshold" | bc -l) )); then
        ai_pass=true
    fi
    
    # Report results
    if [ "$traffic_pass" = true ] && [ "$ai_pass" = true ]; then
        success "$test_name: PASS"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        log "  Events: $events_total, Content Traffic: $traffic_sum (Δ: ${traffic_delta}%), AI: $ai_referrals_sum (Δ: ${ai_delta}%)"
    else
        error "$test_name: FAIL"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        local failure_msg="$test_name: Traffic Δ: ${traffic_delta}% (threshold: ${expected_delta_threshold}%), AI Δ: ${ai_delta}% (threshold: ${expected_delta_threshold}%)"
        FAILURE_DETAILS+=("$failure_msg")
        log "  Events: $events_total, Content Traffic: $traffic_sum, AI: $ai_referrals_sum"
    fi
}

# Test AI Traffic Only toggle
test_ai_traffic_only() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log "Testing: AI Traffic Only toggle"
    
    # Test with Human via AI + Perplexity
    local params="project_id=$PROJECT_ID&window=24h&class=human_via_ai&source=perplexity"
    
    # Without AI Traffic Only
    local content_response
    content_response=$(api_request "/api/content" "$params") || {
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILURE_DETAILS+=("AI Traffic Only: Content API failed")
        return 1
    }
    
    local total_without_ai
    total_without_ai=$(echo "$content_response" | jq -r '.total // 0')
    
    # With AI Traffic Only
    local content_ai_only_response
    content_ai_only_response=$(api_request "/api/content" "$params&aiOnly=true") || {
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILURE_DETAILS+=("AI Traffic Only: Content API failed")
        return 1
    }
    
    local total_with_ai
    total_with_ai=$(echo "$content_ai_only_response" | jq -r '.total // 0')
    
    # Check that AI Traffic Only returns fewer or equal rows
    if [ "$total_with_ai" -le "$total_without_ai" ]; then
        success "AI Traffic Only toggle: PASS"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        log "  Without AI Only: $total_without_ai, With AI Only: $total_with_ai"
    else
        error "AI Traffic Only toggle: FAIL"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILURE_DETAILS+=("AI Traffic Only: With AI Only ($total_with_ai) > Without AI Only ($total_without_ai)")
    fi
}

# Test empty state handling
test_empty_state() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log "Testing: Empty state handling"
    
    # Test with a combination that should return no results
    local params="project_id=$PROJECT_ID&window=24h&class=human_via_ai&source=nonexistent_source"
    
    local content_response
    content_response=$(api_request "/api/content" "$params") || {
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILURE_DETAILS+=("Empty state: Content API failed")
        return 1
    }
    
    local total
    total=$(echo "$content_response" | jq -r '.total // 0')
    local items_count
    items_count=$(echo "$content_response" | jq -r '.items | length')
    
    if [ "$total" -eq 0 ] && [ "$items_count" -eq 0 ]; then
        success "Empty state handling: PASS"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        log "  Empty result handled correctly: total=$total, items=$items_count"
    else
        error "Empty state handling: FAIL"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILURE_DETAILS+=("Empty state: Expected 0 results, got total=$total, items=$items_count")
    fi
}

# Main test execution
main() {
    log "Starting Filter Parity Verification for $ENVIRONMENT"
    log "Project ID: $PROJECT_ID"
    log "API Base: $API_BASE"
    echo
    
    # Test 1: All traffic (24h)
    test_filter_slice \
        "All traffic (24h)" \
        "project_id=$PROJECT_ID&window=24h" \
        "project_id=$PROJECT_ID&window=24h&q=&type=&aiOnly=false&page=1&pageSize=50"
    
    # Test 2: Human via AI + Google (24h)
    test_filter_slice \
        "Human via AI + Google (24h)" \
        "project_id=$PROJECT_ID&window=24h&traffic_class=human_via_ai&ai_source=google" \
        "project_id=$PROJECT_ID&window=24h&q=&type=&aiOnly=false&page=1&pageSize=50&class=human_via_ai&source=google"
    
    # Test 3: Crawler + AI Training (24h)
    test_filter_slice \
        "Crawler + AI Training (24h)" \
        "project_id=$PROJECT_ID&window=24h&traffic_class=crawler&bot_category=ai_training" \
        "project_id=$PROJECT_ID&window=24h&q=&type=&aiOnly=false&page=1&pageSize=50&class=crawler&botCategory=ai_training"
    
    # Test 4: Search (7d)
    test_filter_slice \
        "Search (7d)" \
        "project_id=$PROJECT_ID&window=7d&traffic_class=search" \
        "project_id=$PROJECT_ID&window=7d&q=&type=&aiOnly=false&page=1&pageSize=50&class=search"
    
    # Test 5: Human via AI + Perplexity (15m)
    test_filter_slice \
        "Human via AI + Perplexity (15m)" \
        "project_id=$PROJECT_ID&window=15m&traffic_class=human_via_ai&ai_source=perplexity" \
        "project_id=$PROJECT_ID&window=15m&q=&type=&aiOnly=false&page=1&pageSize=50&class=human_via_ai&source=perplexity"
    
    # Test 6: URL search filter
    test_filter_slice \
        "URL search filter" \
        "project_id=$PROJECT_ID&window=24h&q=example" \
        "project_id=$PROJECT_ID&window=24h&q=example&type=&aiOnly=false&page=1&pageSize=50"
    
    # Test 7: AI Traffic Only toggle
    test_ai_traffic_only
    
    # Test 8: Empty state handling
    test_empty_state
    
    # Summary
    echo
    log "=== FILTER PARITY VERIFICATION SUMMARY ==="
    log "Environment: $ENVIRONMENT"
    log "Project: $PROJECT_ID"
    log "Total Tests: $TOTAL_TESTS"
    log "Passed: $PASSED_TESTS"
    log "Failed: $FAILED_TESTS"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        success "🎉 ALL TESTS PASSED! Filter parity verified."
        echo "0" > .parity_test_result
    else
        error "❌ $FAILED_TESTS TESTS FAILED! Filter parity issues detected."
        echo "1" > .parity_test_result
        
        echo
        log "Failure Details:"
        for detail in "${FAILURE_DETAILS[@]}"; do
            error "  $detail"
        done
    fi
    
    # Slack notification if webhook provided
    if [ -n "$SLACK_WEBHOOK" ]; then
        send_slack_notification
    fi
    
    exit $FAILED_TESTS
}

# Slack notification
send_slack_notification() {
    local color
    local text
    
    if [ $FAILED_TESTS -eq 0 ]; then
        color="good"
        text="✅ Filter Parity Verification PASSED for $ENVIRONMENT"
    else
        color="danger"
        text="❌ Filter Parity Verification FAILED for $ENVIRONMENT ($FAILED_TESTS/$TOTAL_TESTS failed)"
    fi
    
    local payload
    payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "Filter Parity Verification - $ENVIRONMENT",
            "text": "$text",
            "fields": [
                {
                    "title": "Project",
                    "value": "$PROJECT_ID",
                    "short": true
                },
                {
                    "title": "Results",
                    "value": "$PASSED_TESTS/$TOTAL_TESTS passed",
                    "short": true
                }
            ],
            "footer": "Optiview Filter Parity Monitor",
            "ts": $(date +%s)
        }
    ]
}
EOF
)
    
    curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" "$SLACK_WEBHOOK" > /dev/null || true
}

# Run main function
main "$@"
