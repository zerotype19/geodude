/**
 * Cloudflare Configuration Generator - Phase Next
 * Generates Cloudflare rules for AI bot access and optimization
 */

export interface CloudflareConfig {
  botManagementRule: string;
  robotsTxtSnippet: string;
  pageRules: string[];
  workersScript?: string;
}

export interface BotAccessConfig {
  allowedBots: string[];
  rateLimit: number; // requests per second
  cacheTtl: number; // seconds
  bypassChallenges: boolean;
}

export class CloudflareConfigGenerator {
  private readonly DEFAULT_BOTS = [
    'PerplexityBot',
    'Claude-Web',
    'GPTBot',
    'CCBot',
    'Google-Extended',
    'ClaudeBot',
    'Amazonbot',
    'Bytespider'
  ];

  generateBotManagementRule(config: BotAccessConfig): string {
    const bots = config.allowedBots.join('", "');
    const rateLimit = config.rateLimit || 1;
    const cacheTtl = config.cacheTtl || 300; // 5 minutes
    const bypassChallenges = config.bypassChallenges ? 'true' : 'false';

    return `{
  "expression": "(http.user_agent contains \\"PerplexityBot\\" or http.user_agent contains \\"Claude-Web\\" or http.user_agent contains \\"GPTBot\\" or http.user_agent contains \\"CCBot\\" or http.user_agent contains \\"Google-Extended\\" or http.user_agent contains \\"ClaudeBot\\" or http.user_agent contains \\"Amazonbot\\" or http.user_agent contains \\"Bytespider\\") and http.request.method in {\\"GET\\" \\"HEAD\\"}",
  "actions": [
    {
      "id": "skip_challenge",
      "value": {
        "enabled": ${bypassChallenges}
      }
    },
    {
      "id": "rate_limit",
      "value": {
        "requests_per_period": ${rateLimit},
        "period": 1
      }
    },
    {
      "id": "cache_level",
      "value": "cache_everything"
    },
    {
      "id": "edge_cache_ttl",
      "value": {
        "default": ${cacheTtl}
      }
    }
  ]
}`;
  }

  generateRobotsTxtSnippet(domain: string, config: BotAccessConfig): string {
    const answerEngines = [
      'PerplexityBot',
      'Claude-Web',
      'GPTBot'
    ];

    const trainingCrawlers = [
      'CCBot',
      'Google-Extended',
      'ClaudeBot',
      'Amazonbot',
      'Bytespider'
    ];

    let robotsTxt = `# AI Bot Access Configuration for ${domain}\n\n`;
    
    // Allow answer engines
    robotsTxt += `# Answer Engines - Allow with rate limiting\n`;
    for (const bot of answerEngines) {
      robotsTxt += `User-agent: ${bot}\n`;
      robotsTxt += `Allow: /\n`;
      robotsTxt += `Crawl-delay: ${Math.ceil(1 / config.rateLimit)}\n\n`;
    }
    
    // Allow training crawlers with restrictions
    robotsTxt += `# Training Crawlers - Allow with restrictions\n`;
    for (const bot of trainingCrawlers) {
      robotsTxt += `User-agent: ${bot}\n`;
      robotsTxt += `Allow: /\n`;
      robotsTxt += `Crawl-delay: 2\n\n`;
    }
    
    // Block other AI bots
    robotsTxt += `# Block other AI bots\n`;
    robotsTxt += `User-agent: *\n`;
    robotsTxt += `Disallow: /admin/\n`;
    robotsTxt += `Disallow: /private/\n`;
    robotsTxt += `Disallow: /api/\n\n`;
    
    // Sitemap
    robotsTxt += `Sitemap: https://${domain}/sitemap.xml\n`;

    return robotsTxt;
  }

  generatePageRules(domain: string): string[] {
    return [
      `# Cache AI bot requests for 5 minutes
      URL: https://${domain}/*
      Settings:
        - Cache Level: Cache Everything
        - Edge Cache TTL: 5 minutes
        - Browser Cache TTL: 1 hour
        - Always Online: On`,

      `# Optimize for AI bots - disable minification
      URL: https://${domain}/* (User-Agent contains "PerplexityBot" OR "Claude-Web" OR "GPTBot")
      Settings:
        - Disable Apps: On
        - Disable Performance: On
        - Disable Security: On
        - Cache Level: Cache Everything`,

      `# Rate limit AI bots
      URL: https://${domain}/*
      Settings:
        - Rate Limiting: 10 requests per minute per IP
        - Challenge Passage: 1 hour`
    ];
  }

  generateWorkersScript(domain: string): string {
    return `// Cloudflare Worker for AI Bot Optimization
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const userAgent = request.headers.get('User-Agent') || ''
  
  // Check if request is from an AI bot
  const aiBots = [
    'PerplexityBot',
    'Claude-Web', 
    'GPTBot',
    'CCBot',
    'Google-Extended',
    'ClaudeBot',
    'Amazonbot',
    'Bytespider'
  ]
  
  const isAiBot = aiBots.some(bot => userAgent.includes(bot))
  
  if (isAiBot) {
    // Add special headers for AI bots
    const response = await fetch(request)
    const newResponse = new Response(response.body, response)
    
    // Add headers to help AI bots understand content
    newResponse.headers.set('X-AI-Optimized', 'true')
    newResponse.headers.set('X-Content-Type', 'text/html')
    newResponse.headers.set('Cache-Control', 'public, max-age=300')
    
    return newResponse
  }
  
  // Regular request handling
  return fetch(request)
}`;
  }

  generateFullConfig(domain: string, config: BotAccessConfig): CloudflareConfig {
    return {
      botManagementRule: this.generateBotManagementRule(config),
      robotsTxtSnippet: this.generateRobotsTxtSnippet(domain, config),
      pageRules: this.generatePageRules(domain),
      workersScript: this.generateWorkersScript(domain)
    };
  }

  generateGA4ChannelGroup(): string {
    return `{
  "name": "AI Assistant Traffic",
  "description": "Traffic from AI assistants and answer engines",
  "rules": [
    {
      "name": "Perplexity AI",
      "conditions": [
        {
          "field": "source",
          "match_type": "regex",
          "value": "^https://(www\\.)?perplexity\\.ai(/.*)?$"
        }
      ]
    },
    {
      "name": "ChatGPT Search",
      "conditions": [
        {
          "field": "source",
          "match_type": "regex", 
          "value": "^https://(www\\.)?(chatgpt\\.com|chat\\.openai\\.com)(/.*)?$"
        }
      ]
    },
    {
      "name": "Claude Web",
      "conditions": [
        {
          "field": "source",
          "match_type": "regex",
          "value": "^https://(www\\.)?claude\\.ai(/.*)?$"
        }
      ]
    },
    {
      "name": "Gemini",
      "conditions": [
        {
          "field": "source",
          "match_type": "regex",
          "value": "^https://(www\\.)?gemini\\.google\\.com(/.*)?$"
        }
      ]
    },
    {
      "name": "Copilot",
      "conditions": [
        {
          "field": "source",
          "match_type": "regex",
          "value": "^https://(www\\.)?copilot\\.microsoft\\.com(/.*)?$"
        }
      ]
    },
    {
      "name": "Meta AI",
      "conditions": [
        {
          "field": "source",
          "match_type": "regex",
          "value": "^https://(www\\.)?meta\\.ai(/.*)?$"
        }
      ]
    }
  ]
}`;
  }

  generateGA4ExplorationTemplate(): string {
    return `{
  "name": "AI Assistant Visibility Analysis",
  "description": "Analyze traffic and conversions from AI assistants",
  "dimensions": [
    {
      "name": "Source",
      "type": "dimension"
    },
    {
      "name": "Medium", 
      "type": "dimension"
    },
    {
      "name": "Campaign",
      "type": "dimension"
    },
    {
      "name": "Page Title",
      "type": "dimension"
    },
    {
      "name": "Page Path",
      "type": "dimension"
    }
  ],
  "metrics": [
    {
      "name": "Sessions",
      "type": "metric"
    },
    {
      "name": "Users",
      "type": "metric"
    },
    {
      "name": "Page Views",
      "type": "metric"
    },
    {
      "name": "Bounce Rate",
      "type": "metric"
    },
    {
      "name": "Average Session Duration",
      "type": "metric"
    },
    {
      "name": "Conversions",
      "type": "metric"
    }
  ],
  "filters": [
    {
      "dimension": "Source",
      "operator": "regex",
      "value": "perplexity\\.ai|chatgpt\\.com|claude\\.ai|gemini\\.google\\.com|copilot\\.microsoft\\.com|meta\\.ai"
    }
  ],
  "dateRange": {
    "startDate": "30daysAgo",
    "endDate": "yesterday"
  }
}`;
  }
}
