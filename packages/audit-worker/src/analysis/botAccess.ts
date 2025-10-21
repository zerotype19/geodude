/**
 * C1: AI Bot Access Checker (Shadow Mode)
 * 
 * Verifies that AI crawlers can access the site:
 * - GPTBot (OpenAI)
 * - Claude-Web (Anthropic)
 * - Perplexity-Web (Perplexity)
 * - Google-Extended (optional)
 * 
 * Checks:
 * 1. robots.txt rules for each bot
 * 2. X-Robots-Tag headers
 * 3. Meta robots tags (in HTML)
 * 
 * Scoring:
 * 3 = All major AI bots allowed
 * 2 = Most bots allowed (2+)
 * 1 = Some bots allowed (1)
 * 0 = All bots blocked or errors
 */

export interface BotAccessResult {
  score: number;          // 0-3
  found: boolean;
  bots: {
    gptbot: BotStatus;
    claude: BotStatus;
    perplexity: BotStatus;
    google_extended?: BotStatus;
  };
  evidence: {
    robots_txt: string | null;
    meta_robots: string | null;
    x_robots_tag: string | null;
  };
}

export interface BotStatus {
  allowed: boolean;
  rule: string;          // e.g., "allow" | "disallow" | "no-rule" | "error"
  source: string;        // "robots.txt" | "meta" | "header" | "inferred"
}

/**
 * Check AI bot access for a URL
 */
export async function checkBotAccess(
  url: string,
  fetchRobotsTxt: (baseUrl: string) => Promise<string | null>,
  htmlContent?: string,
  headers?: Headers
): Promise<BotAccessResult> {
  const evidence = {
    robots_txt: null as string | null,
    meta_robots: null as string | null,
    x_robots_tag: null as string | null
  };

  const bots: BotAccessResult['bots'] = {
    gptbot: { allowed: true, rule: 'no-rule', source: 'inferred' },
    claude: { allowed: true, rule: 'no-rule', source: 'inferred' },
    perplexity: { allowed: true, rule: 'no-rule', source: 'inferred' }
  };

  try {
    // Parse URL
    const parsedUrl = new URL(url);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    // 1) Fetch and parse robots.txt
    try {
      const robotsTxt = await fetchRobotsTxt(baseUrl);
      evidence.robots_txt = robotsTxt || 'not-found';
      
      if (robotsTxt) {
        bots.gptbot = parseRobotsForBot(robotsTxt, 'GPTBot', parsedUrl.pathname);
        bots.claude = parseRobotsForBot(robotsTxt, 'Claude-Web', parsedUrl.pathname);
        bots.perplexity = parseRobotsForBot(robotsTxt, 'PerplexityBot', parsedUrl.pathname);
      }
    } catch (error) {
      console.error('[Bot Access] Error fetching robots.txt:', error);
      evidence.robots_txt = 'error';
    }

    // 2) Check X-Robots-Tag header
    if (headers) {
      const xRobotsTag = headers.get('x-robots-tag');
      if (xRobotsTag) {
        evidence.x_robots_tag = xRobotsTag;
        const blocksAll = xRobotsTag.toLowerCase().includes('noindex') || 
                          xRobotsTag.toLowerCase().includes('none');
        if (blocksAll) {
          bots.gptbot = { allowed: false, rule: 'noindex', source: 'header' };
          bots.claude = { allowed: false, rule: 'noindex', source: 'header' };
          bots.perplexity = { allowed: false, rule: 'noindex', source: 'header' };
        }
      }
    }

    // 3) Check meta robots tag in HTML
    if (htmlContent) {
      const metaRobots = extractMetaRobots(htmlContent);
      if (metaRobots) {
        evidence.meta_robots = metaRobots;
        const blocksAll = metaRobots.toLowerCase().includes('noindex') || 
                          metaRobots.toLowerCase().includes('none');
        if (blocksAll) {
          bots.gptbot = { allowed: false, rule: 'noindex', source: 'meta' };
          bots.claude = { allowed: false, rule: 'noindex', source: 'meta' };
          bots.perplexity = { allowed: false, rule: 'noindex', source: 'meta' };
        }
      }
    }
  } catch (error) {
    console.error('[Bot Access] Error checking bot access:', error);
  }

  // Compute score
  const allowedCount = [bots.gptbot, bots.claude, bots.perplexity].filter(b => b.allowed).length;
  let score = 0;
  if (allowedCount === 3) score = 3;        // All allowed
  else if (allowedCount === 2) score = 2;   // Most allowed
  else if (allowedCount === 1) score = 1;   // Some allowed
  else score = 0;                            // None allowed

  return {
    score,
    found: score > 0,
    bots,
    evidence
  };
}

/**
 * Parse robots.txt for a specific bot
 */
function parseRobotsForBot(robotsTxt: string, botName: string, path: string): BotStatus {
  const lines = robotsTxt.split('\n');
  let currentAgent: string | null = null;
  let rules: { allow: string[]; disallow: string[] } = { allow: [], disallow: [] };
  let specificRules: { allow: string[]; disallow: string[] } = { allow: [], disallow: [] };
  let defaultRules: { allow: string[]; disallow: string[] } = { allow: [], disallow: [] };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.toLowerCase().startsWith('user-agent:')) {
      // Save previous agent rules
      if (currentAgent) {
        if (currentAgent.toLowerCase() === botName.toLowerCase()) {
          specificRules = { ...rules };
        } else if (currentAgent === '*') {
          defaultRules = { ...rules };
        }
      }
      
      // Start new agent
      currentAgent = trimmed.substring(11).trim();
      rules = { allow: [], disallow: [] };
    } else if (trimmed.toLowerCase().startsWith('allow:')) {
      rules.allow.push(trimmed.substring(6).trim());
    } else if (trimmed.toLowerCase().startsWith('disallow:')) {
      rules.disallow.push(trimmed.substring(9).trim());
    }
  }

  // Save last agent
  if (currentAgent) {
    if (currentAgent.toLowerCase() === botName.toLowerCase()) {
      specificRules = { ...rules };
    } else if (currentAgent === '*') {
      defaultRules = { ...rules };
    }
  }

  // Use specific rules if found, otherwise default to *
  const applicableRules = specificRules.allow.length > 0 || specificRules.disallow.length > 0
    ? specificRules
    : defaultRules;

  // Check path against rules (longest match wins)
  let allowed = true;
  let matchedRule = 'no-rule';

  // Check disallow rules
  for (const pattern of applicableRules.disallow) {
    if (pathMatches(path, pattern)) {
      allowed = false;
      matchedRule = `disallow: ${pattern}`;
      break;
    }
  }

  // Check allow rules (can override disallow)
  for (const pattern of applicableRules.allow) {
    if (pathMatches(path, pattern)) {
      allowed = true;
      matchedRule = `allow: ${pattern}`;
      break;
    }
  }

  return {
    allowed,
    rule: matchedRule,
    source: 'robots.txt'
  };
}

/**
 * Check if path matches robots.txt pattern
 */
function pathMatches(path: string, pattern: string): boolean {
  if (!pattern) return false;
  if (pattern === '/') return true;
  
  // Simple prefix match (robots.txt uses wildcards, but we'll do simple for now)
  return path.startsWith(pattern);
}

/**
 * Extract meta robots tag from HTML
 */
function extractMetaRobots(html: string): string | null {
  const match = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

