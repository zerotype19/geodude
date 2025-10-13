/**
 * Access Tester - Phase Next
 * Tests access for various AI bot user agents
 */

export interface AccessTestResult {
  bot: string;
  status: number;
  ok: boolean;
  bodyHash: string;
  cfChallengeDetected: boolean;
  server: string;
  cfRay?: string;
  akamai?: boolean;
  blocked: boolean;
}

export interface AccessTestData {
  baselineStatus: number;
  results: AccessTestResult[];
}

const AI_BOT_USER_AGENTS = [
  'PerplexityBot',
  'Claude-Web',
  'chatgpt-user',
  'CCBot',
  'Amazonbot',
  'Bytespider',
  'GPTBot',
  'Google-Extended',
  'ClaudeBot'
];

export async function testAiBotAccess(baseUrl: string): Promise<AccessTestData> {
  const results: AccessTestResult[] = [];
  
  // First, get baseline with normal user agent
  const baselineResponse = await fetch(baseUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OptiviewAuditBot/1.0)' }
  });
  const baselineStatus = baselineResponse.status;
  const baselineBody = await baselineResponse.text();
  const baselineHash = hashString(baselineBody);

  // Test each AI bot user agent
  for (const bot of AI_BOT_USER_AGENTS) {
    try {
      const response = await fetch(baseUrl, {
        headers: { 'User-Agent': `${bot}/1.0` }
      });
      
      const body = await response.text();
      const bodyHash = hashString(body);
      const server = response.headers.get('server') || '';
      const cfRay = response.headers.get('cf-ray') || undefined;
      const akamai = server.toLowerCase().includes('akamai');
      
      // Detect Cloudflare challenge
      const cfChallengeDetected = body.includes('cf-browser-verification') || 
                                 body.includes('challenge-platform') ||
                                 body.includes('cf-challenge');
      
      // Determine if blocked
      const blocked = response.status !== baselineStatus || 
                     bodyHash !== baselineHash ||
                     cfChallengeDetected ||
                     response.status >= 400;

      results.push({
        bot,
        status: response.status,
        ok: response.status >= 200 && response.status < 400,
        bodyHash,
        cfChallengeDetected,
        server,
        cfRay,
        akamai,
        blocked
      });
    } catch (error) {
      results.push({
        bot,
        status: 0,
        ok: false,
        bodyHash: '',
        cfChallengeDetected: false,
        server: '',
        blocked: true
      });
    }
  }

  return {
    baselineStatus,
    results
  };
}

function hashString(str: string): string {
  // Simple hash function for body comparison
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}
