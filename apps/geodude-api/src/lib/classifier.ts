export type Classification = {
    class: 'ai_agent_crawl' | 'human_via_ai' | 'search' | 'direct_human' | 'unknown';
    aiSourceSlug?: string;     // e.g. "googlebot", "openai_chatgpt", "microsoft_copilot"
    aiSourceName?: string;     // e.g. "Googlebot", "ChatGPT", "Microsoft Copilot"
    refHost?: string;
    reason: string[];          // breadcrumb trail for debugging
};

export interface Heuristics {
    ai_human_referrers: Array<{ host: string; source: string }>;
    ai_human_search_signals: Array<{ host: string; path_contains?: string; param_has: string[] }>;
    search_referrers: string[];
    bot_ua_tokens: string[];
    bot_headers: Array<{ header: string; value_contains?: string; value?: string }>;
}

export function classifyTraffic(input: {
    cf: Request['cf'] | undefined;   // pass request.cf from Cloudflare
    headers: Headers;                 // raw headers
    url: string;                      // metadata.url (landing)
    referrer: string;                 // metadata.referrer
    userAgent: string;                // headers['user-agent']
    heuristics: Heuristics;          // KV-backed rules
}): Classification {
    const { cf, headers, url, referrer, userAgent, heuristics } = input;
    const reason: string[] = [];

    // Extract referrer host safely
    let refHost: string | undefined;
    try {
        if (referrer && referrer !== '') {
            refHost = new URL(referrer).host.toLowerCase();
        }
    } catch (e) {
        // Invalid referrer URL, treat as no referrer
    }

    const userAgentLower = userAgent?.toLowerCase() || '';

    // 2.1 Bot / crawler detection (highest priority → ai_agent_crawl)
    // Cloudflare verified bots (authoritative)
    if (cf?.verifiedBotCategory) {
        const category = cf.verifiedBotCategory;
        reason.push(`cf.verifiedBotCategory=${category}`);

        if (category === 'Search Engine Crawler' || category === 'AI Chatbot Crawler') {
            const { slug, name } = mapCrawlerSource(userAgentLower, headers.get('from') || '');
            return {
                class: 'ai_agent_crawl',
                aiSourceSlug: slug,
                aiSourceName: name,
                refHost,
                reason
            };
        }
    }

    // User-Agent matches well-known bots
    for (const token of heuristics.bot_ua_tokens) {
        if (userAgentLower.includes(token.toLowerCase())) {
            reason.push(`ua:${token}`);
            const { slug, name } = mapCrawlerSource(userAgentLower, headers.get('from') || '');
            return {
                class: 'ai_agent_crawl',
                aiSourceSlug: slug,
                aiSourceName: name,
                refHost,
                reason
            };
        }
    }

    // Headers signaling automated clients
    for (const headerRule of heuristics.bot_headers) {
        const headerValue = headers.get(headerRule.header)?.toLowerCase() || '';

        if (headerRule.value === '*' && headerValue) {
            // Header exists with any value
            reason.push(`header:${headerRule.header}`);
            const { slug, name } = mapCrawlerSource(userAgentLower, headers.get('from') || '');
            return {
                class: 'ai_agent_crawl',
                aiSourceSlug: slug,
                aiSourceName: name,
                refHost,
                reason
            };
        } else if (headerRule.value_contains && headerValue.includes(headerRule.value_contains.toLowerCase())) {
            // Header contains specific value
            reason.push(`header:${headerRule.header}=${headerValue}`);
            const { slug, name } = mapCrawlerSource(userAgentLower, headers.get('from') || '');
            return {
                class: 'ai_agent_crawl',
                aiSourceSlug: slug,
                aiSourceName: name,
                refHost,
                reason
            };
        }
    }

    // 2.2 Human via AI (next priority → human_via_ai)
    if (refHost) {
        // Check AI human referrer list
        for (const aiRef of heuristics.ai_human_referrers) {
            if (refHost === aiRef.host.toLowerCase()) {
                reason.push(`ref:${aiRef.host}`);
                const { slug, name } = mapAIHumanSource(aiRef.source);
                return {
                    class: 'human_via_ai',
                    aiSourceSlug: slug,
                    aiSourceName: name,
                    refHost,
                    reason
                };
            }
        }

        // Check search hosts with AI-specific signals
        for (const aiSignal of heuristics.ai_human_search_signals) {
            if (refHost === aiSignal.host.toLowerCase()) {
                try {
                    const referrerUrl = new URL(referrer);
                    const path = referrerUrl.pathname;
                    const params = referrerUrl.searchParams;

                    // Check path contains
                    if (aiSignal.path_contains && !path.includes(aiSignal.path_contains)) {
                        continue;
                    }

                    // Check params
                    let hasAISignal = false;
                    for (const param of aiSignal.param_has) {
                        if (params.has(param) || Array.from(params.keys()).some(key => key.toLowerCase().includes(param.toLowerCase()))) {
                            hasAISignal = true;
                            break;
                        }
                    }

                    if (hasAISignal) {
                        reason.push(`ref:${aiSignal.host} with AI signal`);
                        const { slug, name } = mapAIHumanSource(aiSignal.source);
                        return {
                            class: 'human_via_ai',
                            aiSourceSlug: slug,
                            aiSourceName: name,
                            refHost,
                            reason
                        };
                    }
                } catch (e) {
                    // Invalid referrer URL, continue to next check
                }
            }
        }

        // Check UTM markers for AI sources
        try {
            const referrerUrl = new URL(referrer);
            const utmSource = referrerUrl.searchParams.get('utm_source');
            if (utmSource) {
                const aiSource = mapUTMAISource(utmSource);
                if (aiSource) {
                    reason.push(`utm_source=${utmSource}`);
                    return {
                        class: 'human_via_ai',
                        aiSourceSlug: aiSource.slug,
                        aiSourceName: aiSource.name,
                        refHost,
                        reason
                    };
                }
            }
        } catch (e) {
            // Invalid referrer URL, continue to next check
        }
    }

    // 2.3 Search (third → search)
    if (refHost) {
        for (const searchHost of heuristics.search_referrers) {
            if (refHost === searchHost.toLowerCase()) {
                reason.push(`ref:${searchHost}`);
                return {
                    class: 'search',
                    refHost,
                    reason
                };
            }
        }
    }

    // 2.4 Direct human (fallback → direct_human)
    if (!refHost) {
        reason.push('no referrer');
    } else {
        reason.push(`ref:${refHost} (unmatched)`);
    }

    return {
        class: 'direct_human',
        refHost,
        reason
    };
}

// Helper functions for mapping sources
function mapCrawlerSource(userAgent: string, fromHeader: string): { slug: string; name: string } {
    if (/googlebot/i.test(userAgent) || fromHeader.includes('googlebot.com')) {
        return { slug: 'googlebot', name: 'Googlebot' };
    }
    if (/bingbot/i.test(userAgent)) {
        return { slug: 'bingbot', name: 'Bingbot' };
    }
    if (/duckduckbot/i.test(userAgent)) {
        return { slug: 'duckduckbot', name: 'DuckDuckBot' };
    }
    if (/applebot/i.test(userAgent)) {
        return { slug: 'applebot', name: 'Applebot' };
    }
    if (/gptbot/i.test(userAgent)) {
        return { slug: 'gptbot', name: 'GPTBot' };
    }
    if (/ccbot/i.test(userAgent)) {
        return { slug: 'ccbot', name: 'CommonCrawl' };
    }
    if (/facebookexternalhit/i.test(userAgent)) {
        return { slug: 'facebookbot', name: 'Facebook Crawler' };
    }
    if (/twitterbot/i.test(userAgent)) {
        return { slug: 'twitterbot', name: 'Twitterbot' };
    }
    if (/yandexbot/i.test(userAgent)) {
        return { slug: 'yandexbot', name: 'YandexBot' };
    }
    if (/semrushbot/i.test(userAgent)) {
        return { slug: 'semrushbot', name: 'SemrushBot' };
    }
    if (/ahrefsbot/i.test(userAgent)) {
        return { slug: 'ahrefsbot', name: 'AhrefsBot' };
    }
    if (/mj12bot/i.test(userAgent)) {
        return { slug: 'mj12bot', name: 'MJ12bot' };
    }

    // Default fallback
    return { slug: 'unknown_crawler', name: 'Unknown Crawler' };
}

function mapAIHumanSource(source: string): { slug: string; name: string } {
    const mappings: Record<string, { slug: string; name: string }> = {
        'openai_chatgpt': { slug: 'openai_chatgpt', name: 'ChatGPT' },
        'microsoft_copilot': { slug: 'microsoft_copilot', name: 'Microsoft Copilot' },
        'google_gemini': { slug: 'google_gemini', name: 'Gemini' },
        'perplexity': { slug: 'perplexity', name: 'Perplexity' },
        'poe': { slug: 'poe', name: 'Poe' },
        'youcom': { slug: 'youcom', name: 'You.com' },
        'metaphor': { slug: 'metaphor', name: 'Metaphor' }
    };

    return mappings[source] || { slug: source, name: source };
}

function mapUTMAISource(utmSource: string): { slug: string; name: string } | null {
    const aiSources = ['copilot', 'chatgpt', 'perplexity', 'gemini', 'poe', 'youcom'];
    const lowerSource = utmSource.toLowerCase();

    for (const source of aiSources) {
        if (lowerSource.includes(source)) {
            return mapAIHumanSource(source);
        }
    }

    return null;
}
