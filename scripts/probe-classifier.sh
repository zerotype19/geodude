#!/usr/bin/env bash
set -euo pipefail
BASE="${API_BASE:-}"
TOK="${ADMIN_TOKEN:-}"

probe() {
  local name="$1" qs="$2" expect_class="$3" expect_slug="$4" expect_bot="$5"
  local url="$BASE/admin/debug/classify?$qs"
  local out
  out=$(curl -fsS -H "Authorization: Bearer $TOK" "$url")
  local got_class got_slug got_bot
  got_class=$(jq -r '.classification.class' <<<"$out")
  got_slug=$(jq -r '.classification.aiSourceSlug // empty' <<<"$out")
  got_bot=$(jq -r '.classification.botCategory // empty' <<<"$out")

  printf "%-34s | got:%-12s exp:%-12s | src:%-18s | bot:%-14s\n" \
    "$name" "$got_class" "$expect_class" "${got_slug:--}" "${got_bot:--}"

  [[ "$got_class" == "$expect_class" ]] || echo "❌ class mismatch: $name" >&2
  [[ -z "$expect_slug" || "$got_slug" == "$expect_slug" ]] || echo "❌ slug mismatch: $name" >&2
  [[ -z "$expect_bot" || "$got_bot" == "$expect_bot" ]] || echo "❌ bot mismatch: $name" >&2
}

# --- CF-verified bots (via injected CF fields in query) ---
probe "CF Search Crawler"  "ua=Googlebot&referrer=&cf_verified=1&cf_category=Search%20Engine%20Crawler" "crawler" "" "search_crawler"
probe "CF AI Training"     "ua=GPTBot/1.0&referrer=&cf_verified=1&cf_category=AI%20Model%20Training"     "crawler" "" "ai_training"

# --- Assistant referrers (www/m. normalization & path aliases) ---
probe "ChatGPT web ref"    "referrer=https%3A%2F%2Fchat.openai.com%2F&ua=Chrome"          "human_via_ai" "chatgpt" ""
probe "Perplexity web ref" "referrer=https%3A%2F%2Fwww.perplexity.ai%2F&ua=Chrome"        "human_via_ai" "perplexity" ""
probe "Copilot path ref"   "referrer=https%3A%2F%2Fwww.bing.com%2Fchat&ua=Chrome"         "human_via_ai" "microsoft_copilot" ""
probe "Gemini host ref"    "referrer=https%3A%2F%2Fgemini.google.com%2F&ua=Chrome"        "human_via_ai" "google_gemini" ""

# --- Param-only assistant attribution (empty referrer) ---
probe "ai_ref=perplexity"  "url=https%3A%2F%2Fsite.test%2F?ai_ref=perplexity&ua=Chrome" "human_via_ai" "perplexity" ""
probe "utm_source=chatgpt.com" "url=https%3A%2F%2Fsite.test%2F?utm_source=chatgpt.com&ua=Chrome" "human_via_ai" "chatgpt" ""

# --- Additional param variants ---
probe "aiSource=perplexity"  "url=https%3A%2F%2Fsite.test%2F?aiSource=perplexity&ua=Chrome" "human_via_ai" "perplexity" ""
probe "utm_source=copilot"   "url=https%3A%2F%2Fsite.test%2F?utm_source=copilot&ua=Chrome" "human_via_ai" "microsoft_copilot" ""

# --- Spoof guard (search referrer wins, ignore AI params) ---
probe "Google ref + chatgpt UTM" "referrer=https%3A%2F%2Fwww.google.com%2Fsearch%3Fq%3Dx&url=https%3A%2F%2Fsite.test%2F?utm_source=chatgpt.com&ua=Chrome" "search" "" ""

# --- Search engines (non-AI paths) ---
probe "Google search"      "referrer=https%3A%2F%2Fwww.google.com%2Fsearch%3Fq%3Dx&ua=Chrome" "search" "" ""
probe "Bing search"        "referrer=https%3A%2F%2Fwww.bing.com%2Fsearch%3Fq%3Dx&ua=Chrome"   "search" "" ""

# --- Plain direct ---
probe "Direct Chrome"      "referrer=&ua=Mozilla%2F5.0%20Chrome%2F138" "direct_human" "" ""

echo "Done."
