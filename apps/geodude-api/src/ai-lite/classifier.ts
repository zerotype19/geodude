export interface TrafficClassification {
  class: string;
  isAI: boolean;
  shouldSample: boolean;
  sampled: boolean;
  aiSourceSlug?: string;
  aiSourceName?: string;
}

export interface SamplingConfig {
  samplePct: number;
  enforceAI: boolean;
}

/**
 * Classify traffic based on Cloudflare data, headers, and referrer
 * Implements proper precedence: verified bots → strong signals → AI referrers → search → direct
 */
export function classifyTraffic(
  referrer: string | null,
  userAgent: string | null,
  headers: Headers,
  url: string | null,
  cf?: any // Cloudflare request data
): TrafficClassification {
  const referrerLower = referrer?.toLowerCase() || '';
  const userAgentLower = userAgent?.toLowerCase() || '';
  const urlLower = url?.toLowerCase() || '';

  // Check for explicit AI source overrides
  const utmAI = new URLSearchParams(urlLower.split('?')[1] || '').get('utm_ai');
  const headerAI = headers.get('x-optiview-ai-source');
  
  if (utmAI || headerAI) {
    const aiSource = mapExplicitAISource(utmAI || headerAI);
    return {
      class: 'human_via_ai',
      isAI: true,
      shouldSample: false,
      sampled: false,
      aiSourceSlug: aiSource.slug,
      aiSourceName: aiSource.name
    };
  }

  // 1) Cloudflare verified bots (authoritative)
  if (cf?.verifiedBotCategory) {
    const { slug, name } = mapCrawlerSource(userAgentLower, headers.get('from') || '');
    return {
      class: 'ai_agent_crawl',
      isAI: true,
      shouldSample: false,
      sampled: false,
      aiSourceSlug: slug,
      aiSourceName: name
    };
  }

  // 2) Strong bot signals in headers / UA
  if (isKnownCrawlerUA(userAgentLower) || 
      headers.get('from')?.toLowerCase().includes('googlebot.com') || 
      headers.get('from')?.toLowerCase().includes('bing.com')) {
    const { slug, name } = mapCrawlerSource(userAgentLower, headers.get('from') || '');
    return {
      class: 'ai_agent_crawl',
      isAI: true,
      shouldSample: false,
      sampled: false,
      aiSourceSlug: slug,
      aiSourceName: name
    };
  }

  // 3) AI referrers (chat tools etc)
  if (isAIReferrer(referrerLower)) {
    const { slug, name } = mapAIReferrer(referrerLower);
    return {
      class: 'human_via_ai',
      isAI: true,
      shouldSample: false,
      sampled: false,
      aiSourceSlug: slug,
      aiSourceName: name
    };
  }

  // 4) Search engines (human clickthrough)
  if (isSearchReferrer(referrerLower)) {
    return {
      class: 'search',
      isAI: false,
      shouldSample: true,
      sampled: false
    };
  }

  // 5) Default to direct human
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
 * Detect known crawler user agents
 */
function isKnownCrawlerUA(ua: string): boolean {
  return /googlebot|bingbot|duckduckbot|yandexbot|baiduspider|applebot|bytespider|ahrefsbot|semrushbot|mj12bot|sogou|facebot|ia_archiver|ccbot|petalbot|gptbot|anthropic|google-extended|claude|chatgpt|ai-client|ai-bot/i.test(ua);
}

/**
 * Map crawler sources to slugs and names
 */
function mapCrawlerSource(ua: string, fromHdr: string): { slug: string; name: string } {
  if (/googlebot/i.test(ua) || fromHdr.includes('googlebot.com')) {
    return { slug: 'googlebot', name: 'Googlebot' };
  }
  if (/bingbot/i.test(ua)) {
    return { slug: 'bingbot', name: 'Bingbot' };
  }
  if (/duckduckbot/i.test(ua)) {
    return { slug: 'duckduckbot', name: 'DuckDuckBot' };
  }
  if (/bytespider/i.test(ua)) {
    return { slug: 'bytespider', name: 'ByteSpider' };
  }
  if (/applebot/i.test(ua)) {
    return { slug: 'applebot', name: 'Applebot' };
  }
  if (/yandexbot/i.test(ua)) {
    return { slug: 'yandexbot', name: 'YandexBot' };
  }
  if (/baiduspider/i.test(ua)) {
    return { slug: 'baiduspider', name: 'BaiduSpider' };
  }
  if (/ahrefsbot/i.test(ua)) {
    return { slug: 'ahrefsbot', name: 'AhrefsBot' };
  }
  if (/semrushbot/i.test(ua)) {
    return { slug: 'semrushbot', name: 'SemrushBot' };
  }
  if (/gptbot|chatgpt/i.test(ua)) {
    return { slug: 'openai_gptbot', name: 'OpenAI GPTBot' };
  }
  if (/anthropic|claude/i.test(ua)) {
    return { slug: 'anthropic_claude', name: 'Anthropic Claude' };
  }
  if (/google-extended/i.test(ua)) {
    return { slug: 'google_extended', name: 'Google Extended' };
  }
  return { slug: 'generic_crawler', name: 'Crawler' };
}

/**
 * Detect AI referrers
 */
function isAIReferrer(ref: string): boolean {
  return /chat\.openai\.com|claude\.ai|perplexity\.ai|gemini\.google\.com|copilot\.microsoft\.com|poe\.com|you\.com|phind\.com|arc\.net\/exp/i.test(ref);
}

/**
 * Map AI referrers to slugs and names
 */
function mapAIReferrer(ref: string): { slug: string; name: string } {
  if (/chat\.openai\.com/i.test(ref)) {
    return { slug: 'openai_chatgpt', name: 'ChatGPT' };
  }
  if (/claude\.ai/i.test(ref)) {
    return { slug: 'anthropic_claude', name: 'Claude' };
  }
  if (/perplexity\.ai/i.test(ref)) {
    return { slug: 'perplexity', name: 'Perplexity' };
  }
  if (/gemini\.google\.com/i.test(ref)) {
    return { slug: 'google_gemini', name: 'Gemini' };
  }
  if (/copilot\.microsoft\.com/i.test(ref)) {
    return { slug: 'microsoft_copilot', name: 'Microsoft Copilot' };
  }
  if (/poe\.com/i.test(ref)) {
    return { slug: 'poe', name: 'Poe' };
  }
  if (/you\.com/i.test(ref)) {
    return { slug: 'you', name: 'You.com' };
  }
  if (/phind\.com/i.test(ref)) {
    return { slug: 'phind', name: 'Phind' };
  }
  if (/arc\.net\/exp/i.test(ref)) {
    return { slug: 'arc_explore', name: 'Arc Explore' };
  }
  return { slug: 'ai_referrer', name: 'AI Assistant' };
}

/**
 * Map explicit AI source overrides
 */
function mapExplicitAISource(source: string): { slug: string; name: string } {
  const sourceLower = source.toLowerCase();
  if (sourceLower.includes('chatgpt') || sourceLower.includes('gpt')) {
    return { slug: 'openai_chatgpt', name: 'ChatGPT' };
  }
  if (sourceLower.includes('claude')) {
    return { slug: 'anthropic_claude', name: 'Claude' };
  }
  if (sourceLower.includes('perplexity')) {
    return { slug: 'perplexity', name: 'Perplexity' };
  }
  if (sourceLower.includes('gemini')) {
    return { slug: 'google_gemini', name: 'Gemini' };
  }
  if (sourceLower.includes('copilot')) {
    return { slug: 'microsoft_copilot', name: 'Microsoft Copilot' };
  }
  if (sourceLower.includes('poe')) {
    return { slug: 'poe', name: 'Poe' };
  }
  return { slug: sourceLower, name: source };
}

/**
 * Detect search referrers
 */
function isSearchReferrer(ref: string): boolean {
  return /google\./i.test(ref) || /bing\./i.test(ref) || /duckduckgo\.com/i.test(ref) || /search\.brave\.com/i.test(ref) || /yandex\./i.test(ref);
}
