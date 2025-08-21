#!/usr/bin/env tsx

/**
 * Test script for hardened AI detection classifier
 * Tests various scenarios to ensure proper precedence and classification
 */

import { classifyTraffic } from '../apps/geodude-api/src/ai-lite/classifier';

// Mock Request object for testing
function createMockRequest(headers: Record<string, string> = {}): Request {
  const mockHeaders = new Map(Object.entries(headers));
  return {
    headers: {
      get: (name: string) => mockHeaders.get(name) || null
    }
  } as any;
}

// Test cases
const testCases = [
  // 1. Verified crawlers → ai_agent_crawl (highest priority)
  {
    name: "Googlebot with CF verified",
    cf: { verifiedBotCategory: "Search Engine Crawler" },
    headers: {},
    referrer: null,
    userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    expectedClass: "ai_agent_crawl",
    expectedSlug: "google"
  },
  {
    name: "Bingbot with CF verified",
    cf: { verifiedBotCategory: "Search Engine Crawler" },
    headers: {},
    referrer: null,
    userAgent: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    expectedClass: "ai_agent_crawl",
    expectedSlug: "microsoft_bing"
  },
  
  // 2. Known crawler UAs (never mark as human)
  {
    name: "Googlebot UA without CF",
    cf: {},
    headers: {},
    referrer: null,
    userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    expectedClass: "ai_agent_crawl",
    expectedSlug: "google"
  },
  {
    name: "DuckDuckBot UA",
    cf: {},
    headers: {},
    referrer: null,
    userAgent: "DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)",
    expectedClass: "ai_agent_crawl",
    expectedSlug: "duckduckgo"
  },
  {
    name: "Applebot UA",
    cf: {},
    headers: {},
    referrer: null,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)",
    expectedClass: "ai_agent_crawl",
    expectedSlug: "apple"
  },
  
  // 3. Preview/unfurl bots
  {
    name: "Slackbot preview",
    cf: {},
    headers: {},
    referrer: null,
    userAgent: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    expectedClass: "ai_agent_crawl",
    expectedSlug: "slack"
  },
  {
    name: "Facebook external hit",
    cf: {},
    headers: {},
    referrer: null,
    userAgent: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    expectedClass: "ai_agent_crawl",
    expectedSlug: "meta"
  },
  {
    name: "Discord bot",
    cf: {},
    headers: {},
    referrer: null,
    userAgent: "Discordbot/2.0 (+https://discordapp.com)",
    expectedClass: "ai_agent_crawl",
    expectedSlug: "discord"
  },
  
  // 4. From header checks (supporting signal)
  {
    name: "From header googlebot.com",
    cf: {},
    headers: { "from": "googlebot@googlebot.com" },
    referrer: null,
    userAgent: "Mozilla/5.0 (compatible; GenericBot/1.0)",
    expectedClass: "ai_agent_crawl",
    expectedSlug: "google"
  },
  
  // 5. AI assistant referrers → human_via_ai
  {
    name: "ChatGPT referrer",
    cf: {},
    headers: {},
    referrer: "https://chat.openai.com/c/abc123",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    expectedClass: "human_via_ai",
    expectedSlug: "openai_chatgpt"
  },
  {
    name: "Claude referrer",
    cf: {},
    headers: {},
    referrer: "https://claude.ai/chats/def456",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    expectedClass: "human_via_ai",
    expectedSlug: "anthropic_claude"
  },
  {
    name: "Perplexity referrer",
    cf: {},
    headers: {},
    referrer: "https://www.perplexity.ai/search?q=test",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    expectedClass: "human_via_ai",
    expectedSlug: "perplexity"
  },
  {
    name: "Bing chat referrer",
    cf: {},
    headers: {},
    referrer: "https://www.bing.com/chat?q=test",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    expectedClass: "human_via_ai",
    expectedSlug: "microsoft_copilot"
  },
  
  // 6. Search engines → search
  {
    name: "Google search referrer",
    cf: {},
    headers: {},
    referrer: "https://www.google.com/search?q=test",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    expectedClass: "search",
    expectedSlug: undefined
  },
  {
    name: "Bing search referrer",
    cf: {},
    headers: {},
    referrer: "https://www.bing.com/search?q=test",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    expectedClass: "search",
    expectedSlug: undefined
  },
  {
    name: "DuckDuckGo search referrer",
    cf: {},
    headers: {},
    referrer: "https://duckduckgo.com/?q=test",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    expectedClass: "search",
    expectedSlug: undefined
  },
  
  // 7. Direct / unknown → direct_human
  {
    name: "No referrer",
    cf: {},
    headers: {},
    referrer: null,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    expectedClass: "direct_human",
    expectedSlug: undefined
  },
  {
    name: "Unknown referrer",
    cf: {},
    headers: {},
    referrer: "https://example.com/page",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    expectedClass: "direct_human",
    expectedSlug: undefined
  }
];

// Edge cases and precedence tests
const edgeCases = [
  // Crawler precedence over AI referrer
  {
    name: "Googlebot with AI referrer (crawler should win)",
    cf: { verifiedBotCategory: "Search Engine Crawler" },
    headers: {},
    referrer: "https://chat.openai.com/c/abc123",
    userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    expectedClass: "ai_agent_crawl", // Crawler should win over AI referrer
    expectedSlug: "google"
  },
  
  // Preview bot precedence
  {
    name: "Slackbot with search referrer (preview bot should win)",
    cf: {},
    headers: {},
    referrer: "https://www.google.com/search?q=test",
    userAgent: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    expectedClass: "ai_agent_crawl", // Preview bot should win over search referrer
    expectedSlug: "slack"
  }
];

function runTests() {
  console.log("🧪 Testing Hardened AI Detection Classifier\n");
  
  let passed = 0;
  let failed = 0;
  
  // Run main test cases
  console.log("📋 Main Test Cases:");
  for (const testCase of testCases) {
    const result = runTest(testCase);
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log("\n🔍 Edge Cases and Precedence Tests:");
  for (const testCase of edgeCases) {
    const result = runTest(testCase);
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }
  
  // Summary
  console.log("\n📊 Test Summary:");
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log("\n🎉 All tests passed! The hardened classifier is working correctly.");
  } else {
    console.log("\n⚠️  Some tests failed. Please review the classifier implementation.");
  }
}

function runTest(testCase: any) {
  try {
    const mockReq = createMockRequest(testCase.headers);
    const result = classifyTraffic(mockReq, testCase.cf, testCase.referrer, testCase.userAgent);
    
    const classCorrect = result.class === testCase.expectedClass;
    const slugCorrect = result.aiSourceSlug === testCase.expectedSlug;
    const passed = classCorrect && slugCorrect;
    
    const status = passed ? "✅" : "❌";
    console.log(`${status} ${testCase.name}`);
    
    if (!passed) {
      console.log(`   Expected: ${testCase.expectedClass} (${testCase.expectedSlug || 'none'})`);
      console.log(`   Got:      ${result.class} (${result.aiSourceSlug || 'none'})`);
      console.log(`   Reason:   ${result.reason}`);
    }
    
    return { passed, result };
  } catch (error) {
    console.log(`❌ ${testCase.name} - Error: ${error.message}`);
    failed++;
    return { passed: false, error };
  }
}

// Run tests if this file is executed directly
if (import.meta.main) {
  runTests();
}
