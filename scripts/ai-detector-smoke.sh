#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# Optiview AI Detection Smoke Tests
# Requires: curl, jq
# Default endpoint: http://127.0.0.1:8787/admin/debug/classify
# Override with: ./scripts/ai-detector-smoke.sh -u https://api.optiview.ai -p /admin/debug/classify
# ------------------------------------------------------------

BASE_URL="http://127.0.0.1:8787"
PATHNAME="/admin/debug/classify"

while getopts ":u:p:" opt; do
  case $opt in
    u) BASE_URL="$OPTARG" ;;
    p) PATHNAME="$OPTARG" ;;
    \?) echo "Invalid option: -$OPTARG" >&2; exit 2 ;;
  esac
done

REQ_URL="${BASE_URL%/}${PATHNAME}"

command -v curl >/dev/null 2>&1 || { echo "❌ curl is required"; exit 2; }
command -v jq   >/dev/null 2>&1 || { echo "❌ jq is required"; exit 2; }

PASS=0
FAIL=0

# ---------- All test cases in one JSON blob ----------
CASES_JSON='
[
  {
    "name": "ChatGPT web → site (referrer present)",
    "referrer": "https://chat.openai.com/",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "query": null,
    "expected": { "traffic_class": "human_via_ai", "ai_source_id": "chatgpt" }
  },
  {
    "name": "Perplexity web → site (referrer present)",
    "referrer": "https://www.perplexity.ai/",
    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "query": null,
    "expected": { "traffic_class": "human_via_ai", "ai_source_id": "perplexity" }
  },
  {
    "name": "Gemini web → site (referrer present)",
    "referrer": "https://gemini.google.com/",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "query": null,
    "expected": { "traffic_class": "human_via_ai", "ai_source_id": "google_gemini" }
  },
  {
    "name": "Bing Copilot (web chat) → site",
    "referrer": "https://www.bing.com/chat",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "query": null,
    "expected": { "traffic_class": "human_via_ai", "ai_source_id": "microsoft_copilot" }
  },
  {
    "name": "ChatGPT app open (no referrer, utm_source=chatgpt.com)",
    "referrer": null,
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "query": { "utm_source": "chatgpt.com" },
    "expected": { "traffic_class": "human_via_ai", "ai_source_id": "chatgpt" }
  },
  {
    "name": "Perplexity iOS app open (no referrer, Perplexity UA)",
    "referrer": null,
    "user_agent": "Perplexity/2.3.1 (iOS; iPhone16,2) CFNetwork/1410.0.3 Darwin/22.6.0",
    "query": null,
    "expected": { "traffic_class": "human_via_ai", "ai_source_id": "perplexity" }
  },
  {
    "name": "Gemini masked (no ref, ai_ref=gemini)",
    "referrer": null,
    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
    "query": { "ai_ref": "gemini" },
    "expected": { "traffic_class": "human_via_ai", "ai_source_id": "google_gemini" }
  },
  {
    "name": "GPTBot crawl",
    "referrer": null,
    "user_agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) GPTBot/1.0",
    "query": null,
    "expected": { "traffic_class": "crawler", "bot_category": "ai_training" }
  },
  {
    "name": "PerplexityBot crawl",
    "referrer": null,
    "user_agent": "PerplexityBot/1.0 (+https://www.perplexity.ai/bot)",
    "query": null,
    "headers": { "from": "bot@perplexity.ai" },
    "expected": { "traffic_class": "crawler", "bot_category": "ai_training" }
  },
  {
    "name": "ClaudeBot crawl",
    "referrer": null,
    "user_agent": "ClaudeBot/1.0",
    "query": null,
    "expected": { "traffic_class": "crawler", "bot_category": "ai_training" }
  },
  {
    "name": "GoogleOther (Gemini fetcher) crawl",
    "referrer": null,
    "user_agent": "Mozilla/5.0 (compatible; GoogleOther)",
    "query": null,
    "expected": { "traffic_class": "crawler", "bot_category": "ai_training" }
  },
  {
    "name": "Direct type-in (no referrer)",
    "referrer": null,
    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "query": null,
    "expected": { "traffic_class": "direct_human", "ai_source_id": null }
  },
  {
    "name": "Google Search → site (non-AI)",
    "referrer": "https://www.google.com/",
    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "query": null,
    "expected": { "traffic_class": "search", "ai_source_id": "google" }
  },
  {
    "name": "Bing Search → site (non-Copilot)",
    "referrer": "https://www.bing.com/",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; Trident/7.0; rv:11.0) like Gecko",
    "query": null,
    "expected": { "traffic_class": "search", "ai_source_id": "microsoft_bing" }
  },
  {
    "name": "Slack share of ChatGPT answer (slack referrer + utm_source=chatgpt.com)",
    "referrer": "https://app.slack.com/client/T123/C456",
    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "query": { "utm_source": "chatgpt.com" },
    "expected": { "traffic_class": "human_via_ai", "ai_source_id": "chatgpt" }
  },
  {
    "name": "Discord share of Perplexity answer (discord referrer + ai_ref=perplexity)",
    "referrer": "https://discord.com/channels/123/456",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "query": { "ai_ref": "perplexity" },
    "expected": { "traffic_class": "human_via_ai", "ai_source_id": "perplexity" }
  }
]
'

# ---------- Helpers ----------
url_with_query () {
  local base="https://example.com/"
  local query_json="$1"
  if [[ "$query_json" == "null" || -z "$query_json" ]]; then
    echo "$base"; return
  fi
  local q
  q=$(echo "$query_json" | jq -r 'to_entries|map("\(.key)=\(.value)")|join("&")')
  if [[ -z "$q" ]]; then echo "$base"; else echo "${base}?${q}"; fi
}

get_and_expect () {
  local name="$1"
  local url="$2"
  local referrer="$3"
  local ua="$4"
  local headers_json="$5"
  local expected_json="$6"

  # Build query parameters
  local query_params=""
  if [[ -n "${referrer:-}" ]]; then
    query_params="?referrer=$(printf '%s' "$referrer" | jq -sRr @uri)&ua=$(printf '%s' "$ua" | jq -sRr @uri)"
  else
    query_params="?ua=$(printf '%s' "$ua" | jq -sRr @uri)"
  fi

  # GET request
  local resp http_code
  resp=$(curl -sS -w "\n%{http_code}" -X GET "${REQ_URL}${query_params}" \
        -H "Authorization: Bearer geodude-admin-2024")
  http_code="${resp##*$'\n'}"
  resp="${resp%$'\n'*}"

  if [[ "$http_code" != "200" ]]; then
    echo "❌ $name → HTTP $http_code"
    echo "Response: $resp"
    ((FAIL++))
    return
  fi

  # Parse expectations
  local want_tc want_src want_bot want_chain
  want_tc=$(echo "$expected_json"   | jq -r '.traffic_class')
  want_src=$(echo "$expected_json"  | jq -r '.ai_source_id // empty')
  want_bot=$(echo "$expected_json"  | jq -r '.bot_category // empty')
  want_chain=$(echo "$expected_json"| jq -r '.referral_chain // empty')

  local got_tc got_src got_bot got_chain
  got_tc=$(echo "$resp"   | jq -r '.classification.class // ""')
  got_src=$(echo "$resp"  | jq -r '.classification.aiSourceSlug // empty')
  got_bot=$(echo "$resp"  | jq -r '.classification.evidence.botCategory // empty')
  got_chain=$(echo "$resp"| jq -r '.classification.evidence.referral_chain // empty')

  local ok=1
  [[ "$got_tc" == "$want_tc" ]] || ok=0
  if [[ -n "$want_src" ]]; then [[ "$got_src" == "$want_src" ]] || ok=0; fi
  if [[ -n "$want_bot" ]]; then [[ "$got_bot" == "$want_bot" ]] || ok=0; fi
  if [[ -n "$want_chain" ]]; then [[ "$got_chain" == "$want_chain" ]] || ok=0; fi
  # If expectation explicitly wants null source:
  if echo "$expected_json" | jq -e '.ai_source_id == null' >/dev/null 2>&1; then
     [[ -z "$got_src" ]] || ok=0
  fi

  if [[ $ok -eq 1 ]]; then
    echo "✅ $name"
    ((PASS++))
  else
    echo "❌ $name"
    echo "Expected: $expected_json"
    echo "Got:      $(echo "$resp" | jq '{traffic_class: .classification.class, ai_source_id: .classification.aiSourceSlug, bot_category: .classification.evidence.botCategory}')"
    ((FAIL++))
  fi
}

# ---------- Runner ----------
echo "🔎 Running Optiview AI Detection Smoke Tests"
echo "→ Endpoint: $REQ_URL"
echo

# Loop through cases
count=$(echo "$CASES_JSON" | jq 'length')
for i in $(seq 0 $((count-1))); do
  c=$(echo "$CASES_JSON" | jq ".[$i]")
  name=$(echo "$c" | jq -r '.name')
  ref=$(echo "$c" | jq -r '.referrer // ""')
  ua=$(echo "$c" | jq -r '.user_agent')
  hdrs=$(echo "$c" | jq -r '.headers // null')
  q=$(echo "$c" | jq '.query')
  exp=$(echo "$c" | jq '.expected')

  url=$(url_with_query "$q")
  get_and_expect "$name" "$url" "$ref" "$ua" "$hdrs" "$exp"
done

echo
echo "======== Summary ========"
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "========================="

if [[ $FAIL -gt 0 ]]; then
  exit 1
else
  exit 0
fi
