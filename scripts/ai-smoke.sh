#!/usr/bin/env bash
set -euo pipefail

# ====== Config ======
: "${API_BASE:=https://api.optiview.ai}"
: "${ADMIN_TOKEN:?Set ADMIN_TOKEN env var}"
MODE="${1:-probe}"   # probe (no DB) | ingest (write rows)

auth=(-H "Authorization: Bearer ${ADMIN_TOKEN}")

ji() { jq -r "$1" <<<"$2"; }

green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*"; }
blue()  { printf "\033[34m%s\033[0m\n" "$*"; }

pass=0; fail=0

# ---- Helpers ----
probe() {
  local name="$1"; shift
  local qs="$*"
  local url="${API_BASE}/admin/debug/classify?${qs}"
  local res; res="$(curl -fsS "${auth[@]}" "$url")" || { red "✗ $name (HTTP error)"; echo "$url"; return 1; }
  echo "$res"
}

ingest() {
  local name="$1"; shift
  local body="$*"
  local url="${API_BASE}/admin/tools/ingest-test-event"
  local res; res="$(curl -fsS "${auth[@]}" -H 'Content-Type: application/json' -X POST -d "$body" "$url")" || { red "✗ $name (HTTP error)"; echo "$body"; return 1; }
  echo "$res"
}

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    return 0
  else
    red "    • ASSERT FAIL $label   expected=[$expected] got=[$actual]"
    return 1
  fi
}

ok()   { green "✓ $*"; }
bad()  { red   "✗ $*"; }

# ---- Test runners ----
run_case_probe() {
  local name="$1" expect_class="$2" expect_src="$3" expect_bot="$4" qs="$5"
  blue "• ${name} (probe)"
  local res; res="$(probe "$name" "$qs")" || { ((fail++)); return; }

  local got_class got_src got_bot
  got_class="$(ji '.classification.class // .class' "$res")"
  got_src="$(ji '.classification.aiSourceSlug // .aiSourceSlug // ""' "$res")"
  got_bot="$(ji '.classification.evidence.botCategory // .classification.botCategory // .botCategory // ""' "$res")"

  local ok_all=1
  assert_eq "class" "$expect_class" "$got_class" || ok_all=0
  if [[ -n "$expect_src" ]]; then assert_eq "aiSourceSlug" "$expect_src" "$got_src" || ok_all=0; fi
  if [[ -n "$expect_bot" ]]; then assert_eq "botCategory" "$expect_bot" "$got_bot" || ok_all=0; fi

  if (( ok_all )); then ok "$name"; ((pass++)); else bad "$name"; ((fail++)); fi
}

run_case_ingest() {
  local name="$1" expect_class="$2" expect_src="$3" expect_bot="$4" body="$5"
  blue "• ${name} (ingest)"
  local res; res="$(ingest "$name" "$body")" || { ((fail++)); return; }

  local got_class got_src got_bot
  got_class="$(ji '.saved.classification.class // .saved.traffic_class // ""' "$res")"
  got_src="$(ji '.saved.classification.aiSourceSlug // .saved.ai_source_slug // ""' "$res")"
  got_bot="$(ji '.saved.classification.botCategory // .saved.bot_category // ""' "$res")"

  local ok_all=1
  assert_eq "class" "$expect_class" "$got_class" || ok_all=0
  if [[ -n "$expect_src" ]]; then assert_eq "aiSourceSlug" "$expect_src" "$got_src" || ok_all=0; fi
  if [[ -n "$expect_bot" ]]; then assert_eq "botCategory" "$expect_bot" "$got_bot" || ok_all=0; fi

  if (( ok_all )); then ok "$name"; ((pass++)); else bad "$name"; ((fail++)); fi
}

# ====== Test Matrix ======

# --- A) AI Crawlers (CF precedence must force class=crawler, with botCategory) ---

# GPTBot (OpenAI) – documented UA substring "GPTBot"
# https://platform.openai.com/docs/gptbot
export UA_GPTBOT="Mozilla/5.0 (compatible; GPTBot/1.0; +https://platform.openai.com/docs/gptbot)"

# PerplexityBot – documented UA
# https://docs.perplexity.ai/guides/bots
export UA_PERPLEXITY="Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://docs.perplexity.ai/docs/perplexity-bot)"

# ClaudeBot / Claude-User – Anthropic support page (tokens ClaudeBot / Claude-User)
# https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl...
export UA_CLAUDEBOT="Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://www.anthropic.com/claudebot)"
export UA_CLAUDEUSER="Mozilla/5.0 (compatible; Claude-User/1.0; +https://www.anthropic.com/claude-user)"

# GoogleOther (Google AI fetching; Google-Extended control)
# https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers
export UA_GOOGLEOTHER="Mozilla/5.0 (compatible; GoogleOther)"

# Standard Googlebot (search crawler) – should map to search_crawler if CF verifies it
# https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
export UA_GOOGLEBOT="Mozilla/5.0 (Linux; Android 6.0.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

# --- B) AI Assistants (Referrers) — class=human_via_ai, correct aiSourceSlug ---
export REF_CHATGPT="https://chat.openai.com/"
export REF_PERPLEXITY="https://www.perplexity.ai/"
export REF_GEMINI="https://gemini.google.com/"
export REF_COPILOT="https://copilot.microsoft.com/"

# --- C) Search Engines (controls) — class=search ---
export REF_GOOGLE="https://www.google.com/search?q=optiview"
export REF_BING="https://www.bing.com/search?q=optiview"

# --- D) Param-based AI attribution (no referrer) ---
export URL_PERP_PARAM="https://site.test/article?ai_ref=perplexity"
export URL_CGPT_UTM="https://site.test/article?utm_source=chatgpt.com"
export URL_COPILOT_UTM="https://site.test/article?utm_source=copilot"

# --- E) Spoof-guard: search ref + AI UTM → still class=search
export URL_SPOOF="https://site.test/?utm_source=chatgpt.com"

# Common Chrome UA for human direct
export UA_CHROME="Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

# ====== Run ======
main() {
  if [[ "$MODE" == "probe" ]]; then
    # --- Crawlers (probe) ---
    run_case_probe "CF-GPTBot crawler"           "crawler" "" "ai_training" \
      "ua=$(python3 -c 'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("UA_GPTBOT","")))')"

    run_case_probe "CF-PerplexityBot crawler"    "crawler" "" "ai_training" \
      "ua=$(python3 -c 'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("UA_PERPLEXITY","")))')"

    run_case_probe "CF-ClaudeBot crawler"        "crawler" "" "ai_training" \
      "ua=$(python3 -c 'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("UA_CLAUDEBOT","")))')"

    run_case_probe "CF-GoogleOther crawler"      "crawler" "" "ai_training" \
      "ua=$(python3 -c 'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("UA_GOOGLEOTHER","")))')"

    run_case_probe "CF-Googlebot search crawler" "crawler" "" "search_crawler" \
      "ua=$(python3 -c 'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("UA_GOOGLEBOT","")))')"

    # --- Assistant referrers (probe) ---
    run_case_probe "ChatGPT referrer"            "human_via_ai" "chatgpt" "" \
      "referrer=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("REF_CHATGPT","")))')"

    run_case_probe "Perplexity referrer"         "human_via_ai" "perplexity" "" \
      "referrer=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("REF_PERPLEXITY","")))')"

    run_case_probe "Gemini referrer"             "human_via_ai" "google_gemini" "" \
      "referrer=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("REF_GEMINI","")))')"

    run_case_probe "Copilot referrer"            "human_via_ai" "microsoft_copilot" "" \
      "referrer=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("REF_COPILOT","")))')"

    # --- Search controls (probe) ---
    run_case_probe "Google Search referrer"      "search" "" "" \
      "referrer=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("REF_GOOGLE","")))')"

    run_case_probe "Bing Search referrer"        "search" "" "" \
      "referrer=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("REF_BING","")))')"

    # --- Param attribution (probe) ---
    run_case_probe "Param ai_ref=perplexity"     "human_via_ai" "perplexity" "" \
      "url=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("URL_PERP_PARAM","")))')&ua=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("UA_CHROME","")))')"

    run_case_probe "Param utm_source=chatgpt.com" "human_via_ai" "chatgpt" "" \
      "url=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("URL_CGPT_UTM","")))')&ua=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("UA_CHROME","")))')"

    run_case_probe "Param utm_source=copilot"    "human_via_ai" "microsoft_copilot" "" \
      "url=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("URL_COPILOT_UTM","")))')&ua=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("UA_CHROME","")))')"

    # --- Spoof guard (probe) ---
    run_case_probe "Spoof guard: Google ref + chatgpt UTM" "search" "" "" \
      "referrer=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("REF_GOOGLE","")))')&url=$(python3 - <<<'import urllib.parse,os;print(urllib.parse.quote(os.environ.get("URL_SPOOF","")))')"

  else
    # Ingest end-to-end (writes rows)
    # Minimal bodies: include url/referrer/ua headers that your admin tool expects.
    run_case_ingest "INGEST GPTBot"          "crawler" "" "ai_training" \
      "$(jq -n --arg ua "$UA_GPTBOT" --arg url "https://site.test/" '{ua:$ua,url:$url,referrer:""}')"

    run_case_ingest "INGEST PerplexityBot"   "crawler" "" "ai_training" \
      "$(jq -n --arg ua "$UA_PERPLEXITY" --arg url "https://site.test/" '{ua:$ua,url:$url,referrer:""}')"

    run_case_ingest "INGEST ClaudeBot"       "crawler" "" "ai_training" \
      "$(jq -n --arg ua "$UA_CLAUDEBOT" --arg url "https://site.test/" '{ua:$ua,url:$url,referrer:""}')"

    run_case_ingest "INGEST GoogleOther"     "crawler" "" "ai_training" \
      "$(jq -n --arg ua "$UA_GOOGLEOTHER" --arg url "https://site.test/" '{ua:$ua,url:$url,referrer:""}')"

    run_case_ingest "INGEST Googlebot"       "crawler" "" "search_crawler" \
      "$(jq -n --arg ua "$UA_GOOGLEBOT" --arg url "https://site.test/" '{ua:$ua,url:$url,referrer:""}')"

    run_case_ingest "INGEST ChatGPT ref"     "human_via_ai" "chatgpt" "" \
      "$(jq -n --arg ref "$REF_CHATGPT" --arg url "https://site.test/" --arg ua "$UA_CHROME" '{ua:$ua,url:$url,referrer:$ref}')"

    run_case_ingest "INGEST Perplexity ref"  "human_via_ai" "perplexity" "" \
      "$(jq -n --arg ref "$REF_PERPLEXITY" --arg url "https://site.test/" --arg ua "$UA_CHROME" '{ua:$ua,url:$url,referrer:$ref}')"

    run_case_ingest "INGEST Gemini ref"      "human_via_ai" "google_gemini" "" \
      "$(jq -n --arg ref "$REF_GEMINI" --arg url "https://site.test/" --arg ua "$UA_CHROME" '{ua:$ua,url:$url,referrer:$ref}')"

    run_case_ingest "INGEST Copilot ref"     "human_via_ai" "microsoft_copilot" "" \
      "$(jq -n --arg ref "$REF_COPILOT" --arg url "https://site.test/" --arg ua "$UA_CHROME" '{ua:$ua,url:$url,referrer:$ref}')"

    run_case_ingest "INGEST Param ai_ref"    "human_via_ai" "perplexity" "" \
      "$(jq -n --arg url "$URL_PERP_PARAM" --arg ua "$UA_CHROME" '{ua:$ua,url:$url,referrer:""}')"

    run_case_ingest "INGEST Spoof guard"     "search" "" "" \
      "$(jq -n --arg ref "$REF_GOOGLE" --arg url "$URL_SPOOF" --arg ua "$UA_CHROME" '{ua:$ua,url:$url,referrer:$ref}')"
  fi

  echo
  if (( fail == 0 )); then
    green "ALL TESTS PASS  ✅   (${pass} passed)"
    exit 0
  else
    red   "SOME TESTS FAILED ❌  (passed=${pass} failed=${fail})"
    exit 1
  fi
}

main "$@"
