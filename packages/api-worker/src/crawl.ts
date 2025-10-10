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
 * Run full crawlability check
 */
export async function checkCrawlability(baseUrl: string): Promise<{
  robotsFound: boolean;
  sitemapFound: boolean;
  aiBotsAllowed: Record<string, boolean>;
}> {
  const robots = await checkRobotsTxt(baseUrl);
  const sitemap = await checkSitemap(robots.sitemapUrls);

  return {
    robotsFound: robots.found,
    sitemapFound: sitemap.found,
    aiBotsAllowed: robots.aiBotsAllowed,
  };
}

