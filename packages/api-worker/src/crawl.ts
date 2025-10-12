/**
 * Crawlability Checker
 * Checks robots.txt, sitemap, and AI bot access
 */

interface RobotsData {
  found: boolean;
  content?: string;
  aiBotsAllowed: Record<string, boolean>;
  sitemapUrls: string[];
}

interface SitemapData {
  found: boolean;
  urlCount?: number;
}

const AI_BOTS = [
  'GPTBot',
  'ClaudeBot', 
  'Claude-Web',
  'PerplexityBot',
  'CCBot',
  'Google-Extended',
  'Bytespider',
];

const AI_BOT_USER_AGENTS = [
  { name: "GPTBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)" },
  { name: "Claude-Web", ua: "Claude-Web/1.0" },
  { name: "ClaudeBot", ua: "ClaudeBot/1.0" },
  { name: "PerplexityBot", ua: "PerplexityBot/1.0 (+https://perplexity.ai/bot)" },
  { name: "CCBot", ua: "CCBot/2.0 (https://commoncrawl.org/faq/)" },
  { name: "Google-Extended", ua: "Mozilla/5.0 (compatible; Google-Extended)" },
  { name: "Bytespider", ua: "Mozilla/5.0 (compatible; Bytespider; https://zhanzhang.toutiao.com/)" },
];

interface AiBotProbeResult {
  bot: string;
  status: number;
  ok: boolean;
  diff: boolean;
  server: string | null;
  cfRay: string | null;
  akamai: string | null;
  blocked: boolean;
}

interface AiAccessProbeResult {
  baselineStatus: number;
  results: AiBotProbeResult[];
}

/**
 * Fetch and parse robots.txt
 */
export async function checkRobotsTxt(baseUrl: string): Promise<RobotsData> {
  const robotsUrl = `${baseUrl}/robots.txt`;
  
  try {
    const response = await fetch(robotsUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'OptiviewAuditBot/1.0'
      },
    });

    if (!response.ok) {
      return {
        found: false,
        aiBotsAllowed: Object.fromEntries(AI_BOTS.map(bot => [bot, true])), // Assume allowed if no robots.txt
        sitemapUrls: [],
      };
    }

    const content = await response.text();
    const aiBotsAllowed = parseRobotsForBots(content);
    const sitemapUrls = parseSitemapUrls(content);

    return {
      found: true,
      content,
      aiBotsAllowed,
      sitemapUrls,
    };
  } catch (error) {
    console.error('Failed to fetch robots.txt:', error);
    return {
      found: false,
      aiBotsAllowed: Object.fromEntries(AI_BOTS.map(bot => [bot, true])),
      sitemapUrls: [],
    };
  }
}

/**
 * Parse robots.txt to check if AI bots are allowed
 */
function parseRobotsForBots(content: string): Record<string, boolean> {
  const lines = content.split('\n').map(line => line.trim());
  const result: Record<string, boolean> = {};

  // Default: all bots allowed
  AI_BOTS.forEach(bot => {
    result[bot] = true;
  });

  let currentAgent: string | null = null;
  const disallowRules: Map<string, string[]> = new Map();

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || line.length === 0) continue;

    // User-agent line
    if (line.toLowerCase().startsWith('user-agent:')) {
      currentAgent = line.substring('user-agent:'.length).trim();
      if (!disallowRules.has(currentAgent)) {
        disallowRules.set(currentAgent, []);
      }
      continue;
    }

    // Disallow line
    if (line.toLowerCase().startsWith('disallow:') && currentAgent) {
      const path = line.substring('disallow:'.length).trim();
      disallowRules.get(currentAgent)?.push(path);
    }
  }

  // Check each AI bot
  AI_BOTS.forEach(bot => {
    // Check specific bot rules
    const botRules = disallowRules.get(bot) || [];
    
    // Also check wildcard rules
    const wildcardRules = disallowRules.get('*') || [];
    
    const allRules = [...botRules, ...wildcardRules];
    
    // If any rule disallows root or has significant blocks, mark as not allowed
    const hasBlockingRule = allRules.some(rule => {
      return rule === '/' || rule === '/*';
    });

    result[bot] = !hasBlockingRule;
  });

  return result;
}

/**
 * Extract sitemap URLs from robots.txt
 */
function parseSitemapUrls(content: string): string[] {
  const lines = content.split('\n').map(line => line.trim());
  const sitemaps: string[] = [];

  for (const line of lines) {
    if (line.toLowerCase().startsWith('sitemap:')) {
      const url = line.substring('sitemap:'.length).trim();
      if (url) {
        sitemaps.push(url);
      }
    }
  }

  return sitemaps;
}

/**
 * Check if sitemap is accessible
 */
export async function checkSitemap(sitemapUrls: string[]): Promise<SitemapData> {
  if (sitemapUrls.length === 0) {
    return { found: false };
  }

  // Try the first sitemap URL
  const sitemapUrl = sitemapUrls[0];

  try {
    const response = await fetch(sitemapUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'OptiviewAuditBot/1.0'
      },
    });

    if (!response.ok) {
      return { found: false };
    }

    const content = await response.text();
    
    // Count URLs in sitemap (rough estimate)
    const urlMatches = content.match(/<loc>/g);
    const urlCount = urlMatches ? urlMatches.length : 0;

    return {
      found: true,
      urlCount,
    };
  } catch (error) {
    console.error('Failed to fetch sitemap:', error);
    return { found: false };
  }
}

/**
 * Probe AI bot access to detect CDN/WAF blocking
 * Tests actual HTTP responses for different AI bot user agents
 */
export async function probeAiAccess(url: string): Promise<AiAccessProbeResult> {
  // First, get baseline with normal user agent
  let baselineStatus = 0;
  try {
    const baseline = await fetch(url, { 
      method: 'HEAD',
      redirect: 'manual', // Don't follow redirects
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    baselineStatus = baseline.status;
  } catch (error) {
    console.error('Baseline probe failed:', error);
  }

  const results: AiBotProbeResult[] = [];

  // Test each AI bot user agent
  for (const bot of AI_BOT_USER_AGENTS) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': bot.ua
        }
      });

      const status = response.status;
      const ok = status >= 200 && status < 400;
      const diff = status !== baselineStatus;
      const blocked = status === 403 || status === 401 || status === 429 || (diff && !ok);

      results.push({
        bot: bot.name,
        status,
        ok,
        diff,
        server: response.headers.get('server'),
        cfRay: response.headers.get('cf-ray'),
        akamai: response.headers.get('x-akamai-request-id'),
        blocked,
      });

      // Small delay between requests to be polite
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Probe failed for ${bot.name}:`, error);
      results.push({
        bot: bot.name,
        status: 0,
        ok: false,
        diff: true,
        server: null,
        cfRay: null,
        akamai: null,
        blocked: true,
      });
    }
  }

  console.log(`AI bot probe: baseline=${baselineStatus}, blocked=${results.filter(r => r.blocked).length}/${results.length}`);

  return {
    baselineStatus,
    results,
  };
}

/**
 * Run full crawlability check
 */
export async function checkCrawlability(baseUrl: string): Promise<{
  robotsFound: boolean;
  sitemapFound: boolean;
  aiBotsAllowed: Record<string, boolean>;
  sitemapUrls: string[];
}> {
  const robots = await checkRobotsTxt(baseUrl);
  const sitemap = await checkSitemap(robots.sitemapUrls);

  return {
    robotsFound: robots.found,
    sitemapFound: sitemap.found,
    aiBotsAllowed: robots.aiBotsAllowed,
    sitemapUrls: robots.sitemapUrls,
  };
}

