#!/usr/bin/env bash
# Optiview AI Detection Smoke Tests (GET-based admin/debug/classify)
# - Works with GET + query params
# - Handles optional referrer (crawler cases)
# - Supports admin token via header
# - Continues on failures; prints summary; nonzero exit when any fail
# Requires: bash, curl, jq

# ---------- Config ----------
BASE_URL="${BASE_URL:-https://api.optiview.ai}"      # override with env or -u
PATHNAME="${PATHNAME:-/admin/debug/classify}"        # override with env or -p
ADMIN_TOKEN="${ADMIN_TOKEN:-}"                       # set env ADMIN_TOKEN=xxx
TIMEOUT="${TIMEOUT:-15}"                             # curl timeout seconds

# CLI flags
while getopts ":u:p:t:" opt; do
  case $opt in
    u) BASE_URL="$OPTARG" ;;
    p) PATHNAME="$OPTARG" ;;
    t) TIMEOUT="$OPTARG" ;;
    \?) echo "Invalid option: -$OPTARG" >&2; exit 2 ;;
  esac
done

REQ_URL="${BASE_URL%/}${PATHNAME}"

command -v curl >/dev/null 2>&1 || { echo "❌ curl is required"; exit 2; }
command -v jq >/dev/null 2>&1   || { echo "❌ jq is required"; exit 2; }

# ---------- Helpers ----------
urienc () { jq -rn --arg v "$1" '$v|@uri'; }

build_url () {
  local url="$1" ref="$2" ua="$3" hdrs_json="$4"
  local q="ua=$(urienc "$ua")"
  if [[ -n "$ref" ]]; then q="${q}&referrer=$(urienc "$ref")"; fi
  
  # Extract query parameters from the page URL and add them to the API call
  if [[ "$url" == *"?"* ]]; then
    local page_qs="${url#*\?}"
    q="${q}&${page_qs}"
  fi
  
  if [[ -n "$hdrs_json" && "$hdrs_json" != "null" ]]; then
    # Send headers object as compact JSON string param "headers"
    local hdrs_compact; hdrs_compact=$(echo "$hdrs_json" | jq -c .)
    q="${q}&headers=$(urienc "$hdrs_compact")"
  fi
  echo "${REQ_URL}?${q}"
}

do_call () {
  local name="$1" full_url="$2" expected_json="$3"
  local auth=()
  [[ -n "$ADMIN_TOKEN" ]] && auth=(-H "Authorization: Bearer ${ADMIN_TOKEN}")

  # Perform GET request; capture HTTP code separately
  local resp http_code
  resp=$(curl -sS -m "$TIMEOUT" -w $'\n%{http_code}' -G "${full_url}" "${auth[@]}")
  http_code="${resp##*$'\n'}"
  resp="${resp%$'\n'*}"

  # If response isn't JSON, mark failure (avoid set -e)
  if ! echo "$resp" | jq . >/dev/null 2>&1; then
    echo "❌ $name → Non‑JSON or parse error (HTTP $http_code)"
    echo "    URL: $full_url"
    echo "    Body: $resp"
    return 2
  fi

  if [[ "$http_code" != "200" ]]; then
    echo "❌ $name → HTTP $http_code"
    echo "    $(echo "$resp" | jq -c .)"
    return 2
  fi

  # Expected fields
  local want_tc want_src want_bot want_chain
  want_tc=$(echo "$expected_json"   | jq -r '.traffic_class')
  want_src=$(echo "$expected_json"  | jq -r '.ai_source_id // "__UNSET__"')
  want_bot=$(echo "$expected_json"  | jq -r '.bot_category // "__UNSET__"')
  want_chain=$(echo "$expected_json"| jq -r '.referral_chain // "__UNSET__"')

  # Got fields
  local got_tc got_src got_bot got_chain
  got_tc=$(echo "$resp"   | jq -r '.classification.class // ""')
  got_src=$(echo "$resp"  | jq -r '.classification.aiSourceSlug // "__UNSET__"')
  got_bot=$(echo "$resp"  | jq -r '.classification.evidence.botCategory // "__UNSET__"')
  got_chain=$(echo "$resp"| jq -r '.classification.evidence.referral_chain // "__UNSET__"')

  local ok=1
  [[ "$got_tc" == "$want_tc" ]] || ok=0
  [[ "$want_src"  == "__UNSET__"  || "$got_src"  == "$want_src"  ]] || ok=0
  [[ "$want_bot"  == "__UNSET__"  || "$got_bot"  == "$want_bot"  ]] || ok=0
  [[ "$want_chain" == "__UNSET__"  || "$got_chain" == "$want_chain" ]] || ok=0

  if [[ $ok -eq 1 ]]; then
    echo "✅ $name"
    return 0
  else
    echo "❌ $name"
    echo "    Expected: $(echo "$expected_json" | jq -c '{traffic_class,ai_source_id,bot_category,referral_chain}')"
    echo "    Got:      $(echo "$resp" | jq -c '{traffic_class,ai_source_id,bot_category,referral_chain,debug:.debug}')"
    return 1
  fi
}

# ---------- Test Matrix (no comments; valid JSON) ----------
read -r -d '' CASES_JSON <<'JSON'
[
  {"name":"ChatGPT web → site (referrer present)","referrer":"https://chat.openai.com/","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36","query":null,"headers":null,"expected":{"traffic_class":"human_via_ai","ai_source_id":"chatgpt"}},
  {"name":"Perplexity web → site (referrer present)","referrer":"https://www.perplexity.ai/","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36","query":null,"headers":null,"expected":{"traffic_class":"human_via_ai","ai_source_id":"perplexity"}},
  {"name":"Gemini web → site (referrer present)","referrer":"https://gemini.google.com/","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:11.0) like Gecko","query":null,"headers":null,"expected":{"traffic_class":"human_via_ai","ai_source_id":"google_gemini"}},
  {"name":"Bing Copilot (web chat) → site","referrer":"https://www.bing.com/chat","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0","query":null,"headers":null,"expected":{"traffic_class":"human_via_ai","ai_source_id":"microsoft_copilot"}},

  {"name":"ChatGPT app open (no referrer, utm_source=chatgpt.com)","referrer":null,"user_agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1","query":{"utm_source":"chatgpt.com"},"headers":null,"expected":{"traffic_class":"human_via_ai","ai_source_id":"chatgpt"}},
  {"name":"Perplexity iOS app open (no referrer, Perplexity UA)","referrer":null,"user_agent":"Perplexity/2.3.1 (iOS; iPhone16,2) CFNetwork/1410.0.3 Darwin/22.6.0","query":null,"headers":null,"expected":{"traffic_class":"direct_human","ai_source_id":null}},
  {"name":"Gemini masked (no ref, ai_ref=google_gemini)","referrer":null,"user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15","query":{"ai_ref":"google_gemini"},"headers":null,"expected":{"traffic_class":"human_via_ai","ai_source_id":"google_gemini"}},

  {"name":"GPTBot crawl","referrer":null,"user_agent":"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) GPTBot/1.0","query":null,"headers":null,"expected":{"traffic_class":"crawler","bot_category":"ai_training"}},
  {"name":"PerplexityBot crawl","referrer":null,"user_agent":"PerplexityBot/1.0 (+https://www.perplexity.ai/bot)","query":null,"headers":{"from":"bot@perplexity.ai"},"expected":{"traffic_class":"crawler","bot_category":"ai_training"}},
  {"name":"ClaudeBot crawl","referrer":null,"user_agent":"ClaudeBot/1.0","query":null,"headers":null,"expected":{"traffic_class":"crawler","bot_category":"ai_training"}},
  {"name":"GoogleOther (Gemini fetcher) crawl","referrer":null,"user_agent":"Mozilla/5.0 (compatible; GoogleOther)","query":null,"headers":null,"expected":{"traffic_class":"crawler","bot_category":"ai_training"}},

  {"name":"Direct type-in (no referrer)","referrer":null,"user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36","query":null,"headers":null,"expected":{"traffic_class":"direct_human","ai_source_id":null}},
  {"name":"Google Search → site (non-AI)","referrer":"https://www.google.com/","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36","query":null,"headers":null,"expected":{"traffic_class":"search","ai_source_id":"google"}},
  {"name":"Bing Search → site (non-Copilot)","referrer":"https://www.bing.com/","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64; Trident/7.0; rv:11.0) like Gecko","query":null,"headers":null,"expected":{"traffic_class":"search","ai_source_id":"microsoft_bing"}},

  {"name":"Slack share of ChatGPT answer (slack referrer + utm_source=chatgpt.com)","referrer":"https://app.slack.com/client/T123/C456","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36","query":{"utm_source":"chatgpt.com"},"headers":null,"expected":{"traffic_class":"human_via_ai","ai_source_id":"chatgpt","referral_chain":"slack"}},
  {"name":"Discord share of Perplexity answer (discord referrer + ai_ref=perplexity)","referrer":"https://discord.com/channels/123/456","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36","query":{"ai_ref":"perplexity"},"headers":null,"expected":{"traffic_class":"human_via_ai","ai_source_id":"perplexity","referral_chain":"discord"}}
]
JSON

# ---------- Runner ----------
echo "🔎 Optiview AI Detection Smoke Tests"
echo "→ Endpoint: $REQ_URL"
[[ -n "$ADMIN_TOKEN" ]] && echo "→ Auth: Authorization: Bearer ***"
echo

PASS=0; FAIL=0

len=$(echo "$CASES_JSON" | jq 'length')
for ((i=0;i<len;i++)); do
  c=$(echo "$CASES_JSON" | jq ".[$i]")
  name=$(echo "$c" | jq -r '.name')
  ref=$(echo "$c" | jq -r '.referrer // ""')
  ua=$(echo "$c" | jq -r '.user_agent')
  q=$(echo "$c" | jq -c '.query // null')
  hdrs=$(echo "$c" | jq -c '.headers // null')
  exp=$(echo "$c" | jq -c '.expected')

  # Build page URL with optional query string for realism
  base_page="https://example.com/"
  if [[ "$q" != "null" ]]; then
    # Build ?k=v&k2=v2
    qs=$(echo "$q" | jq -r 'to_entries|map("\(.key)=\(.value)")|join("&")')
    page_url="${base_page}?${qs}"
  else
    page_url="$base_page"
  fi

  full_url=$(build_url "$page_url" "$ref" "$ua" "$hdrs")

  do_call "$name" "$full_url" "$exp"
  rc=$?
  if [[ $rc -eq 0 ]]; then
    ((PASS++))
  else
    ((FAIL++))
  fi
done

echo
echo "======== Summary ========"
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "========================="

exit $(( FAIL > 0 ))
