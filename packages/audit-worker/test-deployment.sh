#!/bin/bash

# Optiview Audit Worker Deployment Test Script
# Usage: ./test-deployment.sh <worker-url>

if [ $# -eq 0 ]; then
    echo "Usage: $0 <worker-url>"
    echo "Example: $0 https://optiview-audit-worker.your-subdomain.workers.dev"
    exit 1
fi

WORKER_URL=$1
echo "Testing Optiview Audit Worker at: $WORKER_URL"

# Test 1: Seed Rules
echo "1. Testing KV rules seeding..."
SEED_RESPONSE=$(curl -s -X POST "$WORKER_URL/api/admin/seed-rules")
if echo "$SEED_RESPONSE" | grep -q "seeded"; then
    echo "✓ KV rules seeded successfully"
else
    echo "✗ Failed to seed KV rules"
    echo "Response: $SEED_RESPONSE"
    exit 1
fi

# Test 2: Create Audit
echo "2. Testing audit creation..."
AUDIT_RESPONSE=$(curl -s -X POST "$WORKER_URL/api/audits" \
    -H "Content-Type: application/json" \
    -d '{
        "project_id": "test_deployment",
        "root_url": "https://example.com",
        "max_pages": 10
    }')

AUDIT_ID=$(echo "$AUDIT_RESPONSE" | grep -o '"audit_id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$AUDIT_ID" ]; then
    echo "✓ Audit created successfully: $AUDIT_ID"
else
    echo "✗ Failed to create audit"
    echo "Response: $AUDIT_RESPONSE"
    exit 1
fi

# Test 3: Check Audit Status
echo "3. Testing audit status retrieval..."
STATUS_RESPONSE=$(curl -s "$WORKER_URL/api/audits/$AUDIT_ID")
if echo "$STATUS_RESPONSE" | grep -q "status"; then
    echo "✓ Audit status retrieved successfully"
else
    echo "✗ Failed to retrieve audit status"
    echo "Response: $STATUS_RESPONSE"
    exit 1
fi

# Test 4: Check Pages Endpoint
echo "4. Testing pages endpoint..."
PAGES_RESPONSE=$(curl -s "$WORKER_URL/api/audits/$AUDIT_ID/pages")
if echo "$PAGES_RESPONSE" | grep -q "pages"; then
    echo "✓ Pages endpoint working"
else
    echo "✗ Pages endpoint failed"
    echo "Response: $PAGES_RESPONSE"
fi

# Test 5: Wait for Processing (optional)
echo "5. Waiting for audit processing (30 seconds)..."
sleep 30

# Check if audit is progressing
FINAL_STATUS=$(curl -s "$WORKER_URL/api/audits/$AUDIT_ID")
echo "Final audit status:"
echo "$FINAL_STATUS" | jq '.' 2>/dev/null || echo "$FINAL_STATUS"

echo ""
echo "🎉 Deployment test completed!"
echo "Audit ID: $AUDIT_ID"
echo "Check the frontend at your app URL to see results:"
echo "https://your-app-url/audits/$AUDIT_ID"
