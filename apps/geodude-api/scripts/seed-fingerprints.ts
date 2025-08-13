#!/usr/bin/env tsx

import { D1Database, KVNamespace } from '@cloudflare/workers-types';

interface UAPattern {
  pattern: string;
  source: string;
  category: string;
  confidence: number;
}

interface HeuristicRule {
  needle: string;
  source: string;
  class: string;
}

interface HeaderRule {
  header: string;
  value: string;
  class: string;
}

interface FingerprintData {
  ua_list: UAPattern[];
  heuristics: {
    referer_contains: HeuristicRule[];
    headers: HeaderRule[];
  };
}

const FINGERPRINT_DATA: FingerprintData = {
  ua_list: [
    {"pattern": "PerplexityBot", "source": "Perplexity", "category": "search", "confidence": 0.95},
    {"pattern": "GPTBot", "source": "OpenAI", "category": "chat", "confidence": 0.9},
    {"pattern": "ChatGPT-User", "source": "OpenAI", "category": "chat", "confidence": 0.7},
    {"pattern": "Google-Extended", "source": "Google", "category": "chat", "confidence": 0.6},
    {"pattern": "GoogleOther", "source": "Google", "category": "crawler", "confidence": 0.6},
    {"pattern": "ClaudeBot", "source": "Anthropic", "category": "chat", "confidence": 0.8},
    {"pattern": "CCBot", "source": "CommonCrawl", "category": "crawler", "confidence": 0.4},
    {"pattern": "DuckAssist", "source": "DuckDuckGo", "category": "search", "confidence": 0.6},
    {"pattern": "FacebookBot", "source": "Meta", "category": "assistant", "confidence": 0.4},
    {"pattern": "Bard", "source": "Google", "category": "chat", "confidence": 0.7},
    {"pattern": "Gemini", "source": "Google", "category": "chat", "confidence": 0.7},
    {"pattern": "Copilot", "source": "Microsoft", "category": "assistant", "confidence": 0.8},
    {"pattern": "Claude-Web", "source": "Anthropic", "category": "chat", "confidence": 0.7}
  ],
  heuristics: {
    referer_contains: [
      {"needle": "perplexity.ai", "source": "Perplexity", "class": "human_via_ai"},
      {"needle": "chat.openai.com", "source": "OpenAI", "class": "human_via_ai"},
      {"needle": "gemini.google.com", "source": "Google", "class": "human_via_ai"},
      {"needle": "copilot.microsoft.com", "source": "Microsoft", "class": "human_via_ai"},
      {"needle": "claude.ai", "source": "Anthropic", "class": "human_via_ai"},
      {"needle": "bing.com/chat", "source": "Microsoft", "class": "human_via_ai"},
      {"needle": "duckduckgo.com", "source": "DuckDuckGo", "class": "search"},
      {"needle": "search.brave.com", "source": "Brave", "class": "search"}
    ],
    headers: [
      {"header": "sec-ai-client", "value": "*", "class": "ai_agent_crawl"},
      {"header": "x-ai-client", "value": "*", "class": "ai_agent_crawl"},
      {"header": "user-agent", "value": "*AI*", "class": "ai_agent_crawl"}
    ]
  }
};

async function seedFingerprints() {
  console.log("🌱 Seeding AI Fingerprint Library...");
  
  // This would normally use wrangler KV commands
  // For now, we'll create the data structure and instructions
  
  console.log("\n📋 KV Keys to create:");
  console.log("1. ua:list →", JSON.stringify(FINGERPRINT_DATA.ua_list, null, 2));
  console.log("2. rules:heuristics →", JSON.stringify(FINGERPRINT_DATA.heuristics, null, 2));
  
  console.log("\n🔧 To seed manually:");
  console.log("wrangler kv:key put --binding=AI_FINGERPRINTS ua:list '" + JSON.stringify(FINGERPRINT_DATA.ua_list) + "'");
  console.log("wrangler kv:key put --binding=AI_FINGERPRINTS rules:heuristics '" + JSON.stringify(FINGERPRINT_DATA.heuristics) + "'");
  
  console.log("\n✅ Fingerprint data ready for seeding!");
  console.log("📊 Total patterns:", FINGERPRINT_DATA.ua_list.length);
  console.log("🎯 Heuristic rules:", FINGERPRINT_DATA.heuristics.referer_contains.length + FINGERPRINT_DATA.heuristics.headers.length);
}

if (import.meta.main) {
  seedFingerprints().catch(console.error);
}

export { FINGERPRINT_DATA, type UAPattern, type HeuristicRule, type HeaderRule };
