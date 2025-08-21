export type TrafficClass = 'ai_agent_crawl' | 'human_via_ai' | 'search' | 'direct_human';

export interface TrafficClassification {
  class: TrafficClass;
  aiSourceId?: number;
  aiSourceSlug?: string;
  aiSourceName?: string;
  reason: string;            // concise, human-readable
  evidence: {                // small, safe subset
    cfVerifiedBot?: string;
    referrerHost?: string;
    uaHit?: string;
  };
}

/**
 * Hardened traffic classification system with proper precedence
 * Order: Verified crawlers → AI referrers → Search → Direct
 */
export function classifyTraffic(req: Request, cf: any, referrerUrl: string | null, userAgent: string | null): TrafficClassification {
  const referrer = referrerUrl || '';
  const ua = userAgent || '';

  // Normalize referrer host to lowercase, strip www
  let referrerHost: string | undefined;
  try {
    if (referrer && referrer !== '') {
      const url = new URL(referrer);
      referrerHost = url.hostname.toLowerCase().replace(/^www\./, '');
    }
  } catch (e) {
    // Invalid referrer URL, treat as no referrer
  }

  const uaLower = ua.toLowerCase();
  const evidence: TrafficClassification['evidence'] = {};

  // 1) Verified crawlers → ai_agent_crawl (highest priority)
  if (cf?.verifiedBotCategory) {
    const category = cf.verifiedBotCategory;
    evidence.cfVerifiedBot = category;

    if (category === 'Search Engine Crawler' || category === 'AI Chatbot Crawler') {
      const { slug, name } = mapCrawlerSource(uaLower, req.headers.get('from') || '');
      return {
        class: 'ai_agent_crawl',
        aiSourceSlug: slug,
        aiSourceName: name,
        reason: `cf.verifiedBotCategory=${category} → ai_agent_crawl (${name})`,
        evidence
      };
    }
  }

  // Known crawler UAs (never mark as human)
  if (isKnownCrawlerUA(uaLower)) {
    evidence.uaHit = uaLower;
    const { slug, name } = mapCrawlerSource(uaLower, req.headers.get('from') || '');
    return {
      class: 'ai_agent_crawl',
      aiSourceSlug: slug,
      aiSourceName: name,
      reason: `UA matches known crawler → ai_agent_crawl (${name})`,
      evidence
    };
  }

  // Preview/unfurl bots (Slack, Facebook, Discord, etc.)
  if (isPreviewBot(uaLower)) {
    evidence.uaHit = uaLower;
    const { slug, name } = mapPreviewBot(uaLower);
    return {
      class: 'ai_agent_crawl',
      aiSourceSlug: slug,
      aiSourceName: name,
      reason: `Preview bot detected → ai_agent_crawl (${name})`,
      evidence
    };
  }

  // From header check (supporting signal, never solely decisive)
  const fromHeader = req.headers.get('from') || '';
  if (fromHeader && (fromHeader.includes('googlebot.com') || fromHeader.includes('bing.com'))) {
    evidence.uaHit = fromHeader;
    const { slug, name } = mapCrawlerSource(uaLower, fromHeader);
    return {
      class: 'ai_agent_crawl',
      aiSourceSlug: slug,
      aiSourceName: name,
      reason: `From header indicates crawler → ai_agent_crawl (${name})`,
      evidence
    };
  }

  // 2) AI assistant referrers → human_via_ai
  if (referrerHost && isAIReferrer(referrerHost)) {
    evidence.referrerHost = referrerHost;
    const { slug, name } = mapAIReferrer(referrerHost);
    return {
      class: 'human_via_ai',
      aiSourceSlug: slug,
      aiSourceName: name,
      reason: `referrer host matched '${referrerHost}' → human_via_ai (${name})`,
      evidence
    };
  }

  // 3) Search engines → search (with AI detection)
  if (referrerHost && isSearchReferrer(referrerHost)) {
    evidence.referrerHost = referrerHost;
    const searchInfo = mapSearchReferrer(referrerHost, referrerUrl);

    // If this search engine has AI features, classify as human_via_ai
    if (searchInfo.isAI) {
      return {
        class: 'human_via_ai',
        aiSourceSlug: searchInfo.slug,
        aiSourceName: searchInfo.name,
        reason: `AI-enhanced search '${referrerHost}' → human_via_ai (${searchInfo.name})`,
        evidence
      };
    }

    // Regular search engine
    return {
      class: 'search',
      reason: `search referrer '${referrerHost}' → search (${searchInfo.name})`,
      evidence
    };
  }

  // 4) Direct / unknown → direct_human
  if (!referrerHost) {
    return {
      class: 'direct_human',
      reason: 'no referrer → direct_human',
      evidence
    };
  } else {
    return {
      class: 'direct_human',
      reason: `referrer '${referrerHost}' (unmatched) → direct_human`,
      evidence
    };
  }
}

/**
 * Detect known crawler user agents
 */
function isKnownCrawlerUA(ua: string): boolean {
  const crawlerPatterns = [
    'googlebot', 'bingbot', 'duckduckbot', 'applebot', 'yandexbot', 'baiduspider',
    'ahrefsbot', 'semrushbot', 'commoncrawl', 'facebookexternalhit', 'linkedinbot',
    'slackbot-linkexpanding', 'twitterbot', 'discordbot', 'whatsapp', 'telegrambot',
    'gptbot', 'anthropic', 'google-extended', 'claude', 'chatgpt', 'ai-client', 'ai-bot',
    'bytespider', 'mj12bot', 'sogou', 'facebot', 'ia_archiver', 'ccbot', 'petalbot'
  ];

  return crawlerPatterns.some(pattern => ua.includes(pattern.toLowerCase()));
}

/**
 * Detect preview/unfurl bots
 */
function isPreviewBot(ua: string): boolean {
  const previewPatterns = [
    'slackbot', 'facebookexternalhit', 'discordbot', 'linkedinbot', 'whatsapp', 'telegrambot'
  ];

  return previewPatterns.some(pattern => ua.includes(pattern.toLowerCase()));
}

/**
 * Map crawler sources to slugs and names
 */
function mapCrawlerSource(ua: string, fromHeader: string): { slug: string; name: string } {
  if (/googlebot/i.test(ua) || fromHeader.includes('googlebot.com')) {
    return { slug: 'google', name: 'Google' };
  }
  if (/bingbot/i.test(ua) || fromHeader.includes('bing.com')) {
    return { slug: 'microsoft_bing', name: 'Microsoft/Bing' };
  }
  if (/duckduckbot/i.test(ua)) {
    return { slug: 'duckduckgo', name: 'DuckDuckGo' };
  }
  if (/applebot/i.test(ua)) {
    return { slug: 'apple', name: 'Apple' };
  }
  if (/yandexbot/i.test(ua)) {
    return { slug: 'yandex', name: 'Yandex' };
  }
  if (/baiduspider/i.test(ua)) {
    return { slug: 'baidu', name: 'Baidu' };
  }
  if (/ahrefsbot/i.test(ua)) {
    return { slug: 'ahrefs', name: 'Ahrefs' };
  }
  if (/semrushbot/i.test(ua)) {
    return { slug: 'semrush', name: 'Semrush' };
  }
  if (/ccbot|commoncrawl/i.test(ua)) {
    return { slug: 'commoncrawl', name: 'CommonCrawl' };
  }
  if (/facebookexternalhit/i.test(ua)) {
    return { slug: 'meta', name: 'Meta' };
  }
  if (/linkedinbot/i.test(ua)) {
    return { slug: 'linkedin', name: 'LinkedIn' };
  }
  if (/slackbot/i.test(ua)) {
    return { slug: 'slack', name: 'Slack' };
  }
  if (/twitterbot/i.test(ua)) {
    return { slug: 'twitter', name: 'Twitter' };
  }
  if (/discordbot/i.test(ua)) {
    return { slug: 'discord', name: 'Discord' };
  }
  if (/whatsapp/i.test(ua)) {
    return { slug: 'whatsapp', name: 'WhatsApp' };
  }
  if (/telegrambot/i.test(ua)) {
    return { slug: 'telegram', name: 'Telegram' };
  }
  if (/gptbot|chatgpt/i.test(ua)) {
    return { slug: 'openai', name: 'OpenAI' };
  }
  if (/anthropic|claude/i.test(ua)) {
    return { slug: 'anthropic', name: 'Anthropic' };
  }
  if (/google-extended/i.test(ua)) {
    return { slug: 'google_extended', name: 'Google Extended' };
  }

  return { slug: 'generic_crawler', name: 'Generic Crawler' };
}

/**
 * Map preview bots
 */
function mapPreviewBot(ua: string): { slug: string; name: string } {
  if (/slackbot/i.test(ua)) {
    return { slug: 'slack', name: 'Slack' };
  }
  if (/facebookexternalhit/i.test(ua)) {
    return { slug: 'meta', name: 'Meta' };
  }
  if (/discordbot/i.test(ua)) {
    return { slug: 'discord', name: 'Discord' };
  }
  if (/linkedinbot/i.test(ua)) {
    return { slug: 'linkedin', name: 'LinkedIn' };
  }
  if (/whatsapp/i.test(ua)) {
    return { slug: 'whatsapp', name: 'WhatsApp' };
  }
  if (/telegrambot/i.test(ua)) {
    return { slug: 'telegram', name: 'Telegram' };
  }

  return { slug: 'preview_bot', name: 'Preview Bot' };
}

/**
 * Detect AI referrers
 */
function isAIReferrer(host: string): boolean {
  const aiHosts = [
    'chat.openai.com', 'chatgpt.com', 'claude.ai', 'perplexity.ai', 'poe.com', 'you.com',
    'copilot.microsoft.com', 'gemini.google.com', 'bard.google.com', 'arc.net',
    'phind.com', 'metaphor.systems'
  ];

  // Special handling for Bing - only AI paths are AI referrers
  if (host.includes('bing.com')) {
    return false; // Let search referrer logic handle this
  }

  return aiHosts.some(aiHost => host === aiHost || host.endsWith('.' + aiHost));
}

/**
 * Map AI referrers to slugs and names
 */
function mapAIReferrer(host: string): { slug: string; name: string } {
  if (host.includes('chat.openai.com') || host.includes('chatgpt.com')) {
    return { slug: 'openai_chatgpt', name: 'OpenAI/ChatGPT' };
  }
  if (host.includes('claude.ai')) {
    return { slug: 'anthropic_claude', name: 'Anthropic/Claude' };
  }
  if (host.includes('perplexity.ai')) {
    return { slug: 'perplexity', name: 'Perplexity' };
  }
  if (host.includes('gemini.google.com') || host.includes('bard.google.com')) {
    return { slug: 'google_gemini', name: 'Google Gemini' };
  }
  if (host.includes('copilot.microsoft.com')) {
    return { slug: 'microsoft_copilot', name: 'Microsoft Copilot' };
  }
  if (host.includes('poe.com')) {
    return { slug: 'poe', name: 'Poe' };
  }
  if (host.includes('you.com')) {
    return { slug: 'you', name: 'You.com' };
  }
  if (host.includes('arc.net')) {
    return { slug: 'arc', name: 'Arc' };
  }
  if (host.includes('phind.com')) {
    return { slug: 'phind', name: 'Phind' };
  }
  if (host.includes('metaphor.systems')) {
    return { slug: 'metaphor', name: 'Metaphor' };
  }

  return { slug: 'ai_referrer', name: 'AI Assistant' };
}

/**
 * Detect search referrers
 */
function isSearchReferrer(host: string): boolean {
  const searchHosts = [
    'google.com', 'bing.com', 'duckduckgo.com', 'search.brave.com', 'yahoo.com',
    'yandex.com', 'ecosia.org', 'baidu.com', 'ask.com'
  ];

  return searchHosts.some(searchHost => host === searchHost || host.endsWith('.' + searchHost));
}

/**
 * Map search referrers to determine if they're AI-enhanced
 */
function mapSearchReferrer(host: string, referrerUrl: string | null): { slug: string; name: string; isAI: boolean } {
  if (host.includes('bing.com')) {
    // Check if this is Bing Copilot (AI) or regular Bing search
    if (referrerUrl && (referrerUrl.includes('/chat') || referrerUrl.includes('/copilot'))) {
      return { slug: 'microsoft_copilot', name: 'Microsoft Copilot', isAI: true };
    }
    return { slug: 'microsoft_bing', name: 'Microsoft Bing', isAI: false };
  }

  if (host.includes('google.com')) {
    // Check if this is Google Gemini or regular Google search
    if (referrerUrl && (referrerUrl.includes('/gemini') || referrerUrl.includes('/bard'))) {
      return { slug: 'google_gemini', name: 'Google Gemini', isAI: true };
    }
    return { slug: 'google', name: 'Google', isAI: false };
  }

  // Default search engines
  if (host.includes('duckduckgo.com')) {
    return { slug: 'duckduckgo', name: 'DuckDuckGo', isAI: false };
  }
  if (host.includes('search.brave.com')) {
    return { slug: 'brave', name: 'Brave Search', isAI: false };
  }
  if (host.includes('yahoo.com')) {
    return { slug: 'yahoo', name: 'Yahoo', isAI: false };
  }

  return { slug: 'search_engine', name: 'Search Engine', isAI: false };
}
