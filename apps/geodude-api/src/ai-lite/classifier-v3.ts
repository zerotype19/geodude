import { normalizeCfCategory, BotCategory } from '../classifier/botCategoryMap';

export interface TrafficClassificationV3 {
  class: 'human_via_ai' | 'search' | 'direct_human' | 'crawler';
  aiSourceId?: number;
  aiSourceSlug?: string;
  aiSourceName?: string;
  reason: string;
  confidence: number;
  evidence: {
    cfVerifiedCategory?: string;
    botCategory?: BotCategory;
    referrerHost?: string;
    referrerPath?: string;
    userAgent?: string;
    utmSource?: string;
    isSelfReferral?: boolean;
  };
}

export interface ClassifierManifestV3 {
  version: 'v3';
  assistants: {
    [host: string]: {
      name: string;
      slug: string;
      paths?: string[];
      utmHints?: string[];
    };
  };
  searchEngines: {
    [host: string]: {
      name: string;
      paths?: string[];
      excludePaths?: string[];
    };
  };
  crawlers: {
    [uaPattern: string]: {
      name: string;
      category: BotCategory;
    };
  };
}

// Static fallback manifest
export const STATIC_MANIFEST_V3: ClassifierManifestV3 = {
  version: 'v3',
  assistants: {
    'chatgpt.com': { name: 'ChatGPT', slug: 'chatgpt' },
    'chat.openai.com': { name: 'ChatGPT', slug: 'chatgpt' },
    'perplexity.ai': { name: 'Perplexity', slug: 'perplexity' },
    'pplx.ai': { name: 'Perplexity', slug: 'perplexity' },
    'bing.com': { 
      name: 'Microsoft Copilot', 
      slug: 'microsoft_copilot',
      paths: ['/chat', '/copilot'],
      utmHints: ['copilot']
    },
    'copilot.microsoft.com': { name: 'Microsoft Copilot', slug: 'microsoft_copilot' },
    'google.com': { 
      name: 'Google Gemini', 
      slug: 'google_gemini',
      paths: ['/gemini'],
      utmHints: ['gemini']
    },
    'bard.google.com': { name: 'Google Gemini', slug: 'google_gemini' }
  },
  searchEngines: {
    'google.com': { 
      name: 'Google', 
      slug: 'google',
      paths: ['/search', '/images', '/maps'],
      excludePaths: ['/gemini']
    },
    'bing.com': { 
      name: 'Microsoft Bing', 
      slug: 'microsoft_bing',
      paths: ['/search', '/images', '/maps'],
      excludePaths: ['/chat', '/copilot']
    },
    'duckduckgo.com': { name: 'DuckDuckGo', slug: 'duckduckgo' },
    'yahoo.com': { name: 'Yahoo', slug: 'yahoo' },
    'kagi.com': { name: 'Kagi', slug: 'kagi' },
    'baidu.com': { name: 'Baidu', slug: 'baidu' },
    'ecosia.org': { name: 'Ecosia', slug: 'ecosia' },
    'yandex.ru': { name: 'Yandex', slug: 'yandex' }
  },
  crawlers: {
    'Googlebot': { name: 'Googlebot', category: 'search_crawler' },
    'Bingbot': { name: 'Bingbot', category: 'search_crawler' },
    'DuckDuckBot': { name: 'DuckDuckBot', category: 'search_crawler' },
    'Applebot': { name: 'Applebot', category: 'search_crawler' },
    'GPTBot': { name: 'GPTBot', category: 'ai_training' },
    'CCBot': { name: 'CCBot', category: 'ai_training' },
    'Google-Extended': { name: 'Google-Extended', category: 'ai_training' },
    'PerplexityBot': { name: 'PerplexityBot', category: 'ai_training' },
    'facebookexternalhit': { name: 'Facebook', category: 'preview_bot' },
    'Twitterbot': { name: 'Twitter', category: 'preview_bot' },
    'Slackbot': { name: 'Slack', category: 'preview_bot' },
    'LinkedInBot': { name: 'LinkedIn', category: 'preview_bot' },
    'Discordbot': { name: 'Discord', category: 'preview_bot' },
    'WhatsApp': { name: 'WhatsApp', category: 'preview_bot' },
    'TelegramBot': { name: 'Telegram', category: 'preview_bot' },
    'UptimeRobot': { name: 'UptimeRobot', category: 'uptime_monitor' },
    'Pingdom': { name: 'Pingdom', category: 'uptime_monitor' },
    'SemrushBot': { name: 'Semrush', category: 'seo_tool' },
    'AhrefsBot': { name: 'Ahrefs', category: 'seo_tool' }
  }
};

/**
 * Classify traffic according to AI Impact v2 specification
 * 
 * Precedence (first match wins):
 * 1. Cloudflare verified bot → crawler
 * 2. AI assistant referrer → human_via_ai  
 * 3. Search referrer → search
 * 4. Else → direct_human
 */
export function classifyTrafficV3(input: {
  cfVerifiedBotCategory?: string;
  referrerUrl?: string | null;
  userAgent?: string | null;
  currentHost: string;
  utmSource?: string;
  manifest: ClassifierManifestV3;
}): TrafficClassificationV3 {
  const { cfVerifiedBotCategory, referrerUrl, userAgent, currentHost, utmSource, manifest } = input;
  
  // 1. Cloudflare verified bot → crawler (highest precedence)
  if (cfVerifiedBotCategory) {
    const botCategory = normalizeCfCategory(cfVerifiedBotCategory);
    return {
      class: 'crawler',
      reason: `Cloudflare verified bot: ${cfVerifiedBotCategory}`,
      confidence: 1.0,
      evidence: {
        cfVerifiedCategory: cfVerifiedBotCategory,
        botCategory,
        userAgent: userAgent || undefined
      }
    };
  }
  
  // 2. AI assistant referrer → human_via_ai
  if (referrerUrl) {
    const referrer = new URL(referrerUrl);
    const referrerHost = referrer.hostname.toLowerCase().replace(/^www\./, '');
    const referrerPath = referrer.pathname;
    
    // Check for self-referral (same domain)
    if (referrerHost === currentHost.toLowerCase()) {
      return {
        class: 'direct_human',
        reason: 'Self-referral (same domain)',
        confidence: 1.0,
        evidence: {
          referrerHost,
          referrerPath,
          isSelfReferral: true
        }
      };
    }
    
    // Check if referrer is a known AI assistant
    const assistant = manifest.assistants[referrerHost];
    if (assistant) {
      // Check path restrictions
      if (assistant.paths && assistant.paths.length > 0) {
        const isAssistantPath = assistant.paths.some(path => 
          referrerPath.startsWith(path)
        );
        if (!isAssistantPath) {
          // Not an AI path, treat as search if it's a search engine
          const searchEngine = manifest.searchEngines[referrerHost];
          if (searchEngine) {
            return {
              class: 'search',
              reason: `Search engine: ${searchEngine.name}`,
              confidence: 0.9,
              evidence: {
                referrerHost,
                referrerPath,
                utmSource
              }
            };
          }
        }
      }
      
      // Valid AI assistant path
      return {
        class: 'human_via_ai',
        aiSourceSlug: assistant.slug,
        aiSourceName: assistant.name,
        reason: `AI assistant: ${assistant.name}`,
        confidence: 0.95,
        evidence: {
          referrerHost,
          referrerPath,
          utmSource
        }
      };
    }
    
    // 3. Search referrer → search
    const searchEngine = manifest.searchEngines[referrerHost];
    if (searchEngine) {
      // Check if path is excluded (AI paths)
      if (searchEngine.excludePaths && searchEngine.excludePaths.some(path => 
        referrerPath.startsWith(path)
      )) {
        // This is an AI path on a search domain, treat as AI
        const assistant = manifest.assistants[referrerHost];
        if (assistant) {
          return {
            class: 'human_via_ai',
            aiSourceSlug: assistant.slug,
            aiSourceName: assistant.name,
            reason: `AI assistant on search domain: ${assistant.name}`,
            confidence: 0.9,
            evidence: {
              referrerHost,
              referrerPath,
              utmSource
            }
          };
        }
      }
      
      return {
        class: 'search',
        reason: `Search engine: ${searchEngine.name}`,
        confidence: 0.9,
        evidence: {
          referrerHost,
          referrerPath,
          utmSource
        }
      };
    }
  }
  
  // 4. User-Agent pattern matching for crawlers (without Cloudflare verification)
  if (userAgent) {
    for (const [pattern, crawler] of Object.entries(manifest.crawlers)) {
      if (userAgent.includes(pattern)) {
        return {
          class: 'crawler',
          reason: `Crawler detected: ${crawler.name}`,
          confidence: 0.9,
          evidence: {
            botCategory: crawler.category,
            userAgent
          }
        };
      }
    }
  }
  
  // 5. UTM-only without referrer → direct_human (never upgrade to human_via_ai)
  if (utmSource && !referrerUrl) {
    return {
      class: 'direct_human',
      reason: 'UTM source without referrer (not counted as AI)',
      confidence: 0.8,
      evidence: {
        utmSource
      }
    };
  }
  
  // 6. Default → direct_human
  return {
    class: 'direct_human',
    reason: 'No referrer or unknown source',
    confidence: 0.7,
    evidence: {
      referrerHost: referrerUrl ? new URL(referrerUrl).hostname : undefined,
      utmSource
    }
  };
}

/**
 * Build audit metadata for events with v3 classification
 */
export function buildAuditMetaV3(input: {
  referrerUrl?: string | null;
  classification: TrafficClassificationV3;
  userAgent?: string | null;
  cfVerifiedBotCategory?: string;
  versions: { classifier: string; manifest: string };
}): {
  referrer_url: string | null;
  referrer_host: string | null;
  referrer_path: string | null;
  classification_reason: string;
  confidence: number;
  ai_source_slug: string | null;
  ai_source_name: string | null;
  classifier_version: string;
  kv_manifest_version: string;
  cf_verified_category: string | null;
  bot_category: string | null;
} {
  const u = input.referrerUrl ? new URL(input.referrerUrl) : null;
  
  return {
    referrer_url: input.referrerUrl ?? null,
    referrer_host: u?.hostname ?? null,
    referrer_path: u?.pathname ?? null,
    classification_reason: input.classification.reason,
    confidence: input.classification.confidence,
    ai_source_slug: input.classification.aiSourceSlug ?? null,
    ai_source_name: input.classification.aiSourceName ?? null,
    classifier_version: input.versions.classifier,
    kv_manifest_version: input.versions.manifest,
    cf_verified_category: input.cfVerifiedBotCategory ?? null,
    bot_category: input.classification.evidence.botCategory ?? null
  };
}
