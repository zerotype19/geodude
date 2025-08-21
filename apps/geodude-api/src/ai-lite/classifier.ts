export interface TrafficClassification {
  class: string;
  isAI: boolean;
  shouldSample: boolean;
  sampled: boolean;
}

export interface SamplingConfig {
  samplePct: number;
  enforceAI: boolean;
}

/**
 * Classify traffic based on referrer, headers, and user agent
 * Reuses existing heuristics and adds new AI source detection
 */
export function classifyTraffic(
  referrer: string | null,
  userAgent: string | null,
  headers: Headers,
  url: string | null
): TrafficClassification {
  const referrerLower = referrer?.toLowerCase() || '';
  const userAgentLower = userAgent?.toLowerCase() || '';
  const urlLower = url?.toLowerCase() || '';

  // Check for explicit AI source overrides
  const utmAI = new URLSearchParams(urlLower.split('?')[1] || '').get('utm_ai');
  const headerAI = headers.get('x-optiview-ai-source');
  
  if (utmAI || headerAI) {
    return {
      class: 'human_via_ai',
      isAI: true,
      shouldSample: false,
      sampled: false
    };
  }

  // AI Agent Crawl detection
  if (isAIAgentCrawl(userAgentLower, headers)) {
    return {
      class: 'ai_agent_crawl',
      isAI: true,
      shouldSample: false,
      sampled: false
    };
  }

  // AI-powered search detection
  if (isAIPoweredSearch(referrerLower, urlLower)) {
    return {
      class: 'human_via_ai',
      isAI: true,
      shouldSample: false,
      sampled: false
    };
  }

  // Direct human traffic
  if (isDirectHuman(referrerLower, userAgentLower)) {
    return {
      class: 'direct_human',
      isAI: false,
      shouldSample: true,
      sampled: false
    };
  }

  // Search traffic (classic)
  if (isSearchTraffic(referrerLower, userAgentLower)) {
    return {
      class: 'search',
      isAI: false,
      shouldSample: true,
      sampled: false
    };
  }

  // Default to direct human if unclear
  return {
    class: 'direct_human',
    isAI: false,
    shouldSample: true,
    sampled: false
  };
}

/**
 * Determine if traffic should be sampled based on class and configuration
 */
export function shouldSampleTraffic(
  classification: TrafficClassification,
  config: SamplingConfig
): boolean {
  // AI traffic is never sampled
  if (classification.isAI) {
    return false;
  }

  // Only sample baseline traffic (direct_human, search)
  if (!classification.shouldSample) {
    return false;
  }

  // Apply sampling percentage
  const random = Math.random() * 100;
  return random < config.samplePct;
}

/**
 * Detect AI agent crawls based on headers and user agent
 */
function isAIAgentCrawl(userAgent: string, headers: Headers): boolean {
  // Check for AI client headers
  if (headers.get('sec-ai-client') || headers.get('x-ai-client')) {
    return true;
  }

  // Check user agent for AI patterns
  const aiPatterns = [
    'gptbot',
    'anthropic',
    'google-extended',
    'claude',
    'chatgpt',
    'ai-client',
    'ai-bot'
  ];

  return aiPatterns.some(pattern => userAgent.includes(pattern));
}

/**
 * Detect AI-powered search traffic
 */
function isAIPoweredSearch(referrer: string, url: string): boolean {
  // Poe.com
  if (referrer.includes('poe.com')) {
    return true;
  }

  // You.com
  if (referrer.includes('you.com')) {
    return true;
  }

  // Phind.com
  if (referrer.includes('phind.com')) {
    return true;
  }

  // Arc.net/exp (The Browser Company's Arc Explore)
  if (referrer.includes('arc.net/exp')) {
    return true;
  }

  // Bing Copilot
  if (referrer.includes('copilot.microsoft.com') || 
      referrer.includes('bing.com/chat') ||
      referrer.includes('edgeservices.bing.com/edgesvc/turing')) {
    return true;
  }

  // Google AI Overviews / SGE markers
  if (referrer.includes('google.com') && 
      (url.includes('?sca_esv') || url.includes('&tbm=ovr'))) {
    return true;
  }

  // DuckDuckGo AI
  if (referrer.includes('duckduckgo.com') && url.includes('?ia=ai')) {
    return true;
  }

  // Brave AI
  if (referrer.includes('search.brave.com') && url.includes('ai')) {
    return true;
  }

  return false;
}

/**
 * Detect direct human traffic
 */
function isDirectHuman(referrer: string, userAgent: string): boolean {
  // Empty referrer usually means direct navigation
  if (!referrer || referrer === '') {
    return true;
  }

  // Same domain referrer (simplified check)
  if (referrer && !referrer.includes('://')) {
    return true;
  }

  // Bookmark or typed URL
  if (referrer === 'about:blank' || referrer === '') {
    return true;
  }

  return false;
}

/**
 * Detect search traffic
 */
function isSearchTraffic(referrer: string, userAgent: string): boolean {
  const searchEngines = [
    'google.com',
    'bing.com',
    'yahoo.com',
    'duckduckgo.com',
    'search.brave.com',
    'yandex.com',
    'baidu.com'
  ];

  return searchEngines.some(engine => referrer.includes(engine));
}
