#!/bin/bash

# V4 Polish Test Script
# Quick loop to sanity-check variety across finance brands

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 V4 POLISH TEST - Finance Brands"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for d in americanexpress.com chase.com stripe.com visa.com paypal.com; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🏢 $d"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  echo "📋 RULES-ONLY"
  curl -s "https://api.optiview.ai/api/llm/prompts?domain=$d" | jq -r '.source, .realism_score, "Branded:", (.branded[0:4] | join("\n  - ")), "NonBranded:", (.nonBranded[0:4] | join("\n  - "))'
  echo ""
  echo ""
  
  echo "🤖 AI-ONLY"
  curl -s "https://api.optiview.ai/api/llm/prompts?domain=$d&mode=ai" | jq -r '.source, .realism_score, "Branded:", (.branded[0:4] | join("\n  - ")), "NonBranded:", (.nonBranded[0:4] | join("\n  - "))'
  echo ""
  echo ""
  
  echo "🎨 BLENDED"
  curl -s "https://api.optiview.ai/api/llm/prompts?domain=$d&mode=blended" | jq -r '.source, .realism_score, "Branded:", (.branded[0:4] | join("\n  - ")), "NonBranded:", (.nonBranded[0:4] | join("\n  - "))'
  echo ""
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
done

echo "✅ Test complete! Review for:"
echo "  • Better verb variety (how do I, is it worth, vs)"
echo "  • Brand synonyms (Amex, BofA)"
echo "  • Fewer robotic stems"
echo ""

