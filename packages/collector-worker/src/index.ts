/**
 * Geodude Collector Worker
 * 1px tracking beacon + bot classification
 */

interface Env {
  DB: D1Database;
  HASH_SALT: string;
}

// 1x1 transparent GIF
const PIXEL_GIF = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  (c) => c.charCodeAt(0)
);

// Bot detection patterns
const BOT_PATTERNS = {
  GPTBot: /GPTBot/i,
  ChatGPT: /ChatGPT-User/i,
  ClaudeBot: /Claude-Web|ClaudeBot/i,
  PerplexityBot: /PerplexityBot/i,
  CCBot: /CCBot/i,
  GoogleOther: /Google-Extended|GoogleOther/i,
  Bytespider: /Bytespider/i,
  Bingbot: /bingbot/i,
  Googlebot: /Googlebot/i,
};

function classifyBot(userAgent: string | null): string | null {
  if (!userAgent) return null;

  for (const [botType, pattern] of Object.entries(BOT_PATTERNS)) {
    if (pattern.test(userAgent)) {
      return botType;
    }
  }

  return null;
}

async function hashIP(ip: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Only handle /px endpoint
    if (url.pathname !== '/px') {
      return new Response('Not Found', { status: 404 });
    }

    // Extract parameters
    const propId = url.searchParams.get('prop_id');
    const encodedUrl = url.searchParams.get('u');

    if (!propId) {
      return new Response('Missing prop_id', { status: 400 });
    }

    // Get client info
    const userAgent = request.headers.get('User-Agent');
    const referrer = request.headers.get('Referer') || request.headers.get('Referrer');
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Classify bot
    const botType = classifyBot(userAgent);

    // Hash IP for privacy
    const ipHash = await hashIP(ip, env.HASH_SALT);

    // Decode URL if provided
    let pageUrl = null;
    if (encodedUrl) {
      try {
        pageUrl = decodeURIComponent(encodedUrl);
      } catch (e) {
        pageUrl = encodedUrl;
      }
    }

    // Store hit in database
    try {
      await env.DB.prepare(
        `INSERT INTO hits (property_id, url, ip_hash, user_agent, bot_type, referrer)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(propId, pageUrl, ipHash, userAgent, botType, referrer)
        .run();
    } catch (error) {
      console.error('Database insert failed:', error);
      // Still return pixel even if DB fails
    }

    // Return 1x1 GIF with no-cache headers
    return new Response(PIXEL_GIF, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};

