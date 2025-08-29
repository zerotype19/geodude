#!/usr/bin/env bash
set -euo pipefail
BASE="${API_BASE:-}"
TOK="${ADMIN_TOKEN:-}"

ingest() {
  local name="$1"; shift
  local body="$1"
  local out id class bot
  out=$(curl -fsS -X POST -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
        -d "$body" "$BASE/admin/tools/ingest-test-event")
  id=$(jq -r '.id' <<<"$out")
  class=$(jq -r '.classification.class' <<<"$out")
  bot=$(jq -r '.classification.botCategory // empty' <<<"$out")
  printf "%-28s -> id:%-6s class:%-12s bot:%s\n" "$name" "$id" "$class" "${bot:--}"
}

# CF-verified crawlers
ingest "CF Search Crawler" '{
  "url":"https://example.com/page",
  "referrer":"",
  "ua":"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "cf_verified": true,
  "cf_category":"Search Engine Crawler",
  "cf_asn": 15169,
  "cf_org": "Google LLC"
}'

ingest "CF AI Training" '{
  "url":"https://example.com/whitepaper",
  "referrer":"",
  "ua":"GPTBot/1.0 (+https://openai.com/gptbot)",
  "cf_verified": true,
  "cf_category":"AI Model Training",
  "cf_asn": 396982,
  "cf_org": "OpenAI, L.L.C."
}'

# Assistant attribution (referrer)
ingest "ChatGPT ref" '{
  "url":"https://example.com/post",
  "referrer":"https://chat.openai.com/",
  "ua":"Mozilla/5.0 Chrome/120"
}'

# Assistant attribution (params; empty referrer)
ingest "ai_ref=perplexity" '{
  "url":"https://example.com/post?ai_ref=perplexity",
  "referrer":"",
  "ua":"Mozilla/5.0 Chrome/120"
}'

# Spoof guard (search referrer + AI param)
ingest "Google + chatgpt UTM" '{
  "url":"https://example.com/?utm_source=chatgpt.com",
  "referrer":"https://www.google.com/search?q=example",
  "ua":"Mozilla/5.0 Chrome/120"
}'

# Direct
ingest "Direct" '{
  "url":"https://example.com/",
  "referrer":"",
  "ua":"Mozilla/5.0 Chrome/138"
}'
