# Partner Onboarding Email Template

**Subject:** Access to Optiview **Visibility Intelligence** (Beta)

Hi <Name>,

We've enabled the new **Visibility** dashboard for your org. You'll see:

* **Top domains** cited by AI assistants (Perplexity live; ChatGPT/Claude when links present)
* **Daily scores** (0–100) and **weekly share-of-voice**
* **Recent citations feed** with sources & timestamps

Getting started (2 min):

1. Open **Insights → Visibility**
2. Switch the assistant chip to explore coverage
3. Click any domain for its score & drift
4. Optional: ask assistants prompts like "Top resources for <topic> (include URLs)" to generate fresh signals

We'll monitor for 72 hours and share a summary. Feedback welcome!

— Team Optiview

---

## What's New (In-App Card)

**Visibility Intelligence (Beta)** — see which domains AI assistants cite most for your topics.

* Perplexity live; ChatGPT & Claude signals present (URLs when provided by the model)
* Scores update daily; rankings show 7-day share of voice
* Export CSV data for analysis in Sheets/Excel

## Methodology (Link in Card)

* We collect assistant answers, extract citations (native where available, heuristic otherwise)
* Rollups compute **Visibility Score (0–100)** per domain/day, **weekly rankings** (share of voice)
* Per-assistant filters; times in UTC; daily rollup at 04:00 UTC

## Demo Script (5 minutes, zero surprises)

1. Open **/insights/visibility** → KPIs populate
2. Assistant = **Perplexity** → show top domains + share
3. Click a domain → **Score drawer** shows 0–100 + drift
4. **Recent Citations** → click through to sources
5. Click **📥 CSV** button → download rankings data

## Quick Commands for Support

**Health check:**
```bash
curl -s https://api.optiview.ai/api/health/visibility | jq .
```

**Cost tracking:**
```bash
curl -s https://api.optiview.ai/api/visibility/cost | jq .
```

**Manual rollup:**
```bash
curl -s -X POST "https://api.optiview.ai/api/visibility/rollup?day=today" | jq .
```
