import { normalizeCfCategory, BotCategory } from '../classifier/botCategoryMap';

/**
 * Normalize hostname by removing www./m. prefixes and converting to lowercase
 */
export const normalizeHost = (h: string): string =>
  h.replace(/^www\./, '').replace(/^m\./, '').toLowerCase();

/**
 * Extract and normalize base host from URL
 */
export const baseHost = (u?: string | null): string | null =>
  u ? normalizeHost(new URL(u).hostname) : null;

export interface TrafficClassificationV3 {
  class: 'human_via_ai' | 'crawler' | 'search' | 'direct_human';
  aiSourceSlug?: string | null;
  aiSourceName?: string | null;
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
    referralChain?: string;
    aiRef?: string;
  };
  debug: {
    matchedRule: string;
    signals: string[];
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
      slug: string;
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
  socialShareHosts: string[];
  utmSourceAliases: { [source: string]: string };
  aiRefAliases: { [ref: string]: string };
}

// Static fallback manifest
export const STATIC_MANIFEST_V3: ClassifierManifestV3 = {
  version: 'v3',

  // Direct AI assistant referrers (maps to smoke test: "ChatGPT web → site", "Perplexity web → site", "Gemini web → site")
  assistants: {
    'chatgpt.com': { name: 'ChatGPT', slug: 'chatgpt' },
    'chat.openai.com': { name: 'ChatGPT', slug: 'chatgpt' },
    'perplexity.ai': { name: 'Perplexity', slug: 'perplexity' },
    'pplx.ai': { name: 'Perplexity', slug: 'perplexity' },
    'gemini.google.com': { name: 'Google Gemini', slug: 'google_gemini' },
    'bard.google.com': { name: 'Google Gemini', slug: 'google_gemini' },
    'bing.com': {
      name: 'Microsoft Copilot',
      slug: 'microsoft_copilot',
      paths: ['/chat', '/copilot'],
      utmHints: ['copilot']
    },
    'copilot.microsoft.com': { name: 'Microsoft Copilot', slug: 'microsoft_copilot' }
  },

  // Search engines (maps to smoke test: "Google Search → site", "Bing Search → site")
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

  // Social sharing hosts (maps to smoke test: "Slack share", "Discord share")
  socialShareHosts: ['slack.com', 'app.slack.com', 'discord.com'],

  // UTM source aliases (maps to smoke test: "ChatGPT app open (utm_source=chatgpt.com)")
  utmSourceAliases: {
    'chatgpt.com': 'chatgpt',
    'openai.com': 'chatgpt',
    'perplexity.ai': 'perplexity',
    'pplx.ai': 'perplexity',
    'gemini.google.com': 'google_gemini',
    'bard.google.com': 'google_gemini',
    'bing.com': 'microsoft_copilot',
    'copilot.microsoft.com': 'microsoft_copilot'
  },

  // AI reference aliases (maps to smoke test: "Gemini masked (ai_ref=google_gemini)")
  aiRefAliases: {
    'chatgpt': 'chatgpt',
    'openai': 'chatgpt',
    'perplexity': 'perplexity',
    'pplx': 'perplexity',
    'google_gemini': 'google_gemini',
    'gemini': 'google_gemini',
    'bard': 'google_gemini',
    'microsoft_copilot': 'microsoft_copilot',
    'copilot': 'microsoft_copilot',
    'bing': 'microsoft_copilot'
  },

  // User-Agent patterns (maps to smoke test: "GPTBot crawl", "PerplexityBot crawl", etc.)
  crawlers: {
    'Googlebot': { name: 'Googlebot', category: 'search_crawler' },
    'Bingbot': { name: 'Bingbot', category: 'search_crawler' },
    'DuckDuckBot': { name: 'DuckDuckBot', category: 'search_crawler' },
    'Applebot': { name: 'Applebot', category: 'search_crawler' },
    'GPTBot': { name: 'GPTBot', category: 'ai_training' },
    'CCBot': { name: 'CCBot', category: 'ai_training' },
    'ClaudeBot': { name: 'ClaudeBot', category: 'ai_training' },
    'Google-Extended': { name: 'Google-Extended', category: 'ai_training' },
    'GoogleOther': { name: 'GoogleOther', category: 'ai_training' },
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
  aiRef?: string;
  manifest: ClassifierManifestV3;
}): TrafficClassificationV3 {
  const { cfVerifiedBotCategory, referrerUrl, userAgent, currentHost, utmSource, aiRef, manifest } = input;

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
      },
      debug: {
        matchedRule: 'Cloudflare verified bot',
        signals: [`cf_verified_category: ${cfVerifiedBotCategory}`]
      }
    };
  }

  // 2. AI assistant referrer → human_via_ai
  if (referrerUrl) {
    const referrer = new URL(referrerUrl);
    const referrerHost = normalizeHost(referrer.hostname);
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
        },
        debug: {
          matchedRule: 'Self-referral (same domain)',
          signals: [`referrer_host: ${referrerHost}`]
        }
      };
    }

    // Check if referrer is a known AI assistant
    const assistant = manifest.assistants[referrerHost];
    if (assistant) {
      // Check path restrictions
      if (assistant.paths && assistant.paths.length > 0) {
        const isAssistantPath = assistant.paths.some(path =>
          referrerPath.indexOf(path) === 0
        );
        if (!isAssistantPath) {
          // Not an AI path, treat as search if it's a search engine
          const searchEngine = manifest.searchEngines[referrerHost];
          if (searchEngine) {
            return {
              class: 'search',
              aiSourceSlug: searchEngine.slug,
              aiSourceName: searchEngine.name,
              reason: `Search engine: ${searchEngine.name}`,
              confidence: 0.9,
              evidence: {
                referrerHost,
                referrerPath,
                utmSource
              },
              debug: {
                matchedRule: 'Search engine (path restriction)',
                signals: [`referrer_host: ${referrerHost}`, `referrer_path: ${referrerPath}`]
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
        },
        debug: {
          matchedRule: 'AI assistant (path restriction)',
          signals: [`referrer_host: ${referrerHost}`, `referrer_path: ${referrerPath}`]
        }
      };
    }

    // 3. Search referrer → search (normalized host detection)
    if (referrerHost === 'google.com' || referrerHost === 'bing.com') {
      // Special handling for major search engines
      if (referrerHost === 'bing.com' && referrerPath.indexOf('/chat') === 0) {
        // Bing chat is AI assistant
        return {
          class: 'human_via_ai',
          aiSourceSlug: 'microsoft_copilot',
          aiSourceName: 'Microsoft Copilot',
          reason: 'AI assistant on search domain: Microsoft Copilot',
          confidence: 0.9,
          evidence: {
            referrerHost,
            referrerPath,
            utmSource
          },
          debug: {
            matchedRule: 'AI assistant on search domain (Bing chat)',
            signals: [`referrer_host: ${referrerHost}`, `referrer_path: ${referrerPath}`]
          }
        };
      } else {
        // Regular search traffic
        const searchName = referrerHost === 'google.com' ? 'Google' : 'Microsoft Bing';
        const searchSlug = referrerHost === 'google.com' ? 'google' : 'microsoft_bing';
        return {
          class: 'search',
          aiSourceSlug: searchSlug,
          aiSourceName: searchName,
          reason: `Search engine: ${searchName}`,
          confidence: 0.9,
          evidence: {
            referrerHost,
            referrerPath,
            utmSource
          },
          debug: {
            matchedRule: 'Search engine (host detection)',
            signals: [`referrer_host: ${referrerHost}`, `referrer_path: ${referrerPath}`]
          }
        };
      }
    }

    // Fallback to manifest-based search detection
    const searchEngine = manifest.searchEngines[referrerHost];
    if (searchEngine) {
      // Check if path is excluded (AI paths)
      if (searchEngine.excludePaths && searchEngine.excludePaths.some(path =>
        referrerPath.indexOf(path) === 0
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
            },
            debug: {
              matchedRule: 'AI assistant on search domain (manifest exclusion)',
              signals: [`referrer_host: ${referrerHost}`, `referrer_path: ${referrerPath}`]
            }
          };
        }
      }

      return {
        class: 'search',
        aiSourceSlug: searchEngine.slug,
        aiSourceName: searchEngine.name,
        reason: `Search engine: ${searchEngine.name}`,
        confidence: 0.9,
        evidence: {
          referrerHost,
          referrerPath,
          utmSource
        },
        debug: {
          matchedRule: 'Search engine (manifest)',
          signals: [`referrer_host: ${referrerHost}`, `referrer_path: ${referrerPath}`]
        }
      };
    }
  }

  // 4. Social sharing with AI attribution (Slack/Discord)
  if (referrerUrl) {
    const referrer = new URL(referrerUrl);
    const referrerHost = normalizeHost(referrer.hostname);

    if (manifest.socialShareHosts.includes(referrerHost)) {
      // Extract AI source from query parameters
      let aiSlug: string | undefined;
      let referralChain: string | undefined;

      if (utmSource) {
        // Check UTM source aliases first
        const aliasSlug = manifest.utmSourceAliases[utmSource];
        if (aliasSlug) {
          aiSlug = aliasSlug;
          referralChain = referrerHost === 'discord.com' ? 'discord' : 'slack';
        } else {
          // Fallback: check if UTM source contains AI assistant domain
          for (const host of Object.keys(manifest.assistants)) {
            const assistant = manifest.assistants[host];
            if (utmSource.indexOf(host.replace(/^www\./, '')) !== -1) {
              aiSlug = assistant.slug;
              referralChain = referrerHost === 'discord.com' ? 'discord' : 'slack';
              break;
            }
          }
        }
      }

      if (aiRef) {
        // Check AI reference aliases first
        const aliasSlug = manifest.aiRefAliases[aiRef.toLowerCase()];
        if (aliasSlug) {
          aiSlug = aliasSlug;
          referralChain = referrerHost === 'discord.com' ? 'discord' : 'slack';
        } else {
          // Fallback: check if AI ref matches an AI assistant
          for (const host of Object.keys(manifest.assistants)) {
            const assistant = manifest.assistants[host];
            if (aiRef.toLowerCase() === assistant.slug.toLowerCase() ||
              aiRef.toLowerCase() === assistant.name.toLowerCase().replace(/\s+/g, '').toLowerCase()) {
              aiSlug = assistant.slug;
              referralChain = referrerHost === 'discord.com' ? 'discord' : 'slack';
              break;
            }
          }
        }
      }

      if (aiSlug) {
        let assistant = null;
        for (const host of Object.keys(manifest.assistants)) {
          if (manifest.assistants[host].slug === aiSlug) {
            assistant = manifest.assistants[host];
            break;
          }
        }
        return {
          class: 'human_via_ai',
          aiSourceSlug: aiSlug,
          aiSourceName: assistant?.name || aiSlug,
          reason: `AI assistant via social share: ${assistant?.name || aiSlug}`,
          confidence: 0.9,
          evidence: {
            referrerHost,
            referralChain,
            utmSource,
            aiRef
          },
          debug: {
            matchedRule: 'AI assistant via social share',
            signals: [`referrer_host: ${referrerHost}`, `utm_source: ${utmSource}`]
          }
        };
      }
    }
  }

  // 5. AI reference detection (when no referrer)
  if (aiRef && !referrerUrl) {
    // Check AI reference aliases first
    const aliasSlug = manifest.aiRefAliases[aiRef.toLowerCase()];
    if (aliasSlug) {
      const assistant = Object.keys(manifest.assistants).map(host => manifest.assistants[host]).find(a => a.slug === aliasSlug);
      return {
        class: 'human_via_ai',
        aiSourceSlug: aliasSlug,
        aiSourceName: assistant?.name || aliasSlug,
        reason: `AI assistant via reference alias: ${assistant?.name || aliasSlug}`,
        confidence: 0.9,
        evidence: {
          aiRef
        },
        debug: {
          matchedRule: 'AI assistant via reference alias',
          signals: [`ai_ref: ${aiRef}`]
        }
      };
    }

    // Fallback: check if AI ref matches an AI assistant slug or name
    for (const host of Object.keys(manifest.assistants)) {
      const assistant = manifest.assistants[host];
      if (aiRef.toLowerCase() === assistant.slug.toLowerCase() ||
        aiRef.toLowerCase() === assistant.name.toLowerCase().replace(/\s+/g, '').toLowerCase()) {
        return {
          class: 'human_via_ai',
          aiSourceSlug: assistant.slug,
          aiSourceName: assistant.name,
          reason: `AI assistant via reference: ${assistant.name}`,
          confidence: 0.9,
          evidence: {
            aiRef
          },
          debug: {
            matchedRule: 'AI assistant via reference',
            signals: [`ai_ref: ${aiRef}`]
          }
        };
      }
    }
  }

  // 5. UTM source and AI reference detection (when no referrer)
  if (utmSource && !referrerUrl) {
    // Check UTM source aliases first
    const aliasSlug = manifest.utmSourceAliases[utmSource];
    if (aliasSlug) {
      const assistant = Object.keys(manifest.assistants).map(host => manifest.assistants[host]).find(a => a.slug === aliasSlug);
      return {
        class: 'human_via_ai',
        aiSourceSlug: aliasSlug,
        aiSourceName: assistant?.name || aliasSlug,
        reason: `AI assistant via UTM alias: ${assistant?.name || aliasSlug}`,
        confidence: 0.9,
        evidence: {
          utmSource
        },
        debug: {
          matchedRule: 'AI assistant via UTM alias',
          signals: [`utm_source: ${utmSource}`]
        }
      };
    }

    // Fallback: check if UTM source contains AI assistant domain
    for (const host of Object.keys(manifest.assistants)) {
      const assistant = manifest.assistants[host];
      if (utmSource.indexOf(host.replace(/^www\./, '')) !== -1) {
        return {
          class: 'human_via_ai',
          aiSourceSlug: assistant.slug,
          aiSourceName: assistant.name,
          reason: `AI assistant via UTM: ${assistant.name}`,
          confidence: 0.85,
          evidence: {
            utmSource
          },
          debug: {
            matchedRule: 'AI assistant via UTM',
            signals: [`utm_source: ${utmSource}`]
          }
        };
      }
    }

    // Check for specific UTM hints
    for (const host of Object.keys(manifest.assistants)) {
      const assistant = manifest.assistants[host];
      if (assistant.utmHints && assistant.utmHints.some(hint => utmSource.indexOf(hint) !== -1)) {
        return {
          class: 'human_via_ai',
          aiSourceSlug: assistant.slug,
          aiSourceName: assistant.name,
          reason: `AI assistant via UTM hint: ${assistant.name}`,
          confidence: 0.85,
          evidence: {
            utmSource
          },
          debug: {
            matchedRule: 'AI assistant via UTM hint',
            signals: [`utm_source: ${utmSource}`]
          }
        };
      }
    }

    // No AI match found
    return {
      class: 'direct_human',
      reason: 'UTM source without referrer (not counted as AI)',
      confidence: 0.8,
      evidence: {
        utmSource
      },
      debug: {
        matchedRule: 'UTM source without referrer',
        signals: [`utm_source: ${utmSource}`]
      }
    };
  }

  // 6. User-Agent pattern matching for crawlers (without Cloudflare verification)
  // STRICT: Only match known bot patterns, never generic browser UAs
  if (userAgent) {
    for (const pattern of Object.keys(manifest.crawlers)) {
      const crawler = manifest.crawlers[pattern];
      
      // Use strict pattern matching to avoid false positives
      // Only match if the pattern appears as a distinct identifier
      const isMatch = (() => {
        const ua = userAgent.toLowerCase();
        const patternLower = pattern.toLowerCase();
        
        // For bot patterns, look for exact matches or versioned patterns
        if (patternLower.includes('bot') || patternLower.includes('crawler')) {
          // Must match the exact bot name (e.g., "GPTBot", "PerplexityBot")
          return ua.includes(patternLower);
        }
        
        // For other patterns, be more restrictive
        // Must not match generic browser components like "Chrome", "Safari", "AppleWebKit"
        // BUT allow known bot patterns even if they contain browser-like terms
        const genericBrowserTerms = ['chrome', 'safari', 'firefox', 'edge', 'webkit', 'applewebkit'];
        
        // Special case: allow "mozilla" if it's part of a known bot pattern
        if (ua.includes('mozilla') && !ua.includes(patternLower)) {
          // Only block if it's a generic Mozilla UA without a known bot pattern
          const isGenericMozilla = ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox') || ua.includes('edge');
          if (isGenericMozilla) {
            return false; // Generic browser UA
          }
        }
        
        // Block other generic browser terms
        if (genericBrowserTerms.some(term => ua.includes(term))) {
          return false; // Never classify browser UAs as crawlers
        }
        
        // Only match if pattern is a distinct identifier
        return ua.includes(patternLower);
      })();
      
      if (isMatch) {
        return {
          class: 'crawler',
          reason: `Crawler detected: ${crawler.name}`,
          confidence: 0.9,
          evidence: {
            botCategory: crawler.category,
            userAgent
          },
          debug: {
            matchedRule: `ua.${pattern.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            signals: [`ua_pattern: ${pattern}`, `bot_category: ${crawler.category}`]
          }
        };
      }
    }
  }

  // 7. Default → direct_human
  return {
    class: 'direct_human',
    reason: 'No referrer or unknown source',
    confidence: 0.7,
    evidence: {
      referrerHost: referrerUrl ? new URL(referrerUrl).hostname : undefined,
      utmSource
    },
    debug: {
      matchedRule: 'No referrer or unknown source',
      signals: []
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
