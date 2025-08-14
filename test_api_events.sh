#!/bin/bash

# Test the updated events API endpoint
PROPERTY_ID="1"
KEY_ID="key_test_001"
API_URL="https://api.optiview.ai/api/events"

echo "Testing updated events API endpoint..."

# Test 1: ChatGPT referral to homepage
echo "Test 1: ChatGPT referral to homepage"
body='{"property_id":'$PROPERTY_ID',"key_id":"'$KEY_ID'","event_type":"view","metadata":{"p":"/","r":"https://chat.openai.com"}}'
response=$(curl -sS -X POST "$API_URL" \
  -H "content-type: application/json" \
  --data "$body")
echo "Response: $response"
echo ""

# Test 2: Perplexity referral to pricing page
echo "Test 2: Perplexity referral to pricing page"
body='{"property_id":'$PROPERTY_ID',"key_id":"'$KEY_ID'","event_type":"view","metadata":{"p":"/pricing","r":"https://www.perplexity.ai"}}'
response=$(curl -sS -X POST "$API_URL" \
  -H "content-type: application/json" \
  --data "$body")
echo "Response: $response"
echo ""

# Test 3: Claude referral to blog post
echo "Test 3: Claude referral to blog post"
body='{"property_id":'$PROPERTY_ID',"key_id":"'$KEY_ID'","event_type":"view","metadata":{"p":"/blog/post-1","r":"https://claude.ai"}}'
response=$(curl -sS -X POST "$API_URL" \
  -H "content-type: application/json" \
  --data "$body")
echo "Response: $response"
echo ""

# Test 4: Direct human visit (no referer)
echo "Test 4: Direct human visit (no referer)"
body='{"property_id":'$PROPERTY_ID',"key_id":"'$KEY_ID'","event_type":"view","metadata":{"p":"/","r":""}}'
response=$(curl -sS -X POST "$API_URL" \
  -H "content-type: application/json" \
  --data "$body")
echo "Response: $response"
echo ""

# Test 5: Custom event
echo "Test 5: Custom event"
body='{"property_id":'$PROPERTY_ID',"key_id":"'$KEY_ID'","event_type":"custom","metadata":{"p":"/","action":"button_click","button_id":"cta"}}'
response=$(curl -sS -X POST "$API_URL" \
  -H "content-type: application/json" \
  --data "$body")
echo "Response: $response"
echo ""

# Test 6: Invalid event type (should fail)
echo "Test 6: Invalid event type (should fail)"
body='{"property_id":'$PROPERTY_ID',"key_id":"'$KEY_ID'","event_type":"invalid","metadata":{"p":"/"}}'
response=$(curl -sS -X POST "$API_URL" \
  -H "content-type: application/json" \
  --data "$body")
echo "Response: $response"
echo ""

echo "API testing complete!"
