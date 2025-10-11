/**
 * AI Bot Metadata
 * Maps bot keys to friendly labels, organizations, and policy URLs
 */

export type BotMeta = {
  label: string;
  org: string;
  icon?: string;
  policyUrl?: string;
  color?: string;
};

export const BOT_METADATA: Record<string, BotMeta> = {
  gptbot: {
    label: 'GPTBot',
    org: 'OpenAI',
    icon: '🤖',
    policyUrl: 'https://platform.openai.com/docs/gptbot',
    color: '#10a37f',
  },
  'chatgpt-user': {
    label: 'ChatGPT-User',
    org: 'OpenAI',
    icon: '💬',
    policyUrl: 'https://platform.openai.com/docs/plugins/bot',
    color: '#10a37f',
  },
  'claude-web': {
    label: 'Claude-Web',
    org: 'Anthropic',
    icon: '🧠',
    policyUrl: 'https://www.anthropic.com/bot-policy',
    color: '#cc785c',
  },
  claudebot: {
    label: 'ClaudeBot',
    org: 'Anthropic',
    icon: '🧠',
    policyUrl: 'https://www.anthropic.com/bot-policy',
    color: '#cc785c',
  },
  perplexitybot: {
    label: 'PerplexityBot',
    org: 'Perplexity AI',
    icon: '🔍',
    policyUrl: 'https://docs.perplexity.ai/docs/perplexitybot',
    color: '#1fb8cd',
  },
  ccbot: {
    label: 'CCBot',
    org: 'Common Crawl',
    icon: '📚',
    policyUrl: 'https://commoncrawl.org/ccbot',
    color: '#4a5568',
  },
  'google-extended': {
    label: 'Google-Extended',
    org: 'Google',
    icon: '🔎',
    policyUrl: 'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers',
    color: '#4285f4',
  },
  amazonbot: {
    label: 'Amazonbot',
    org: 'Amazon',
    icon: '📦',
    policyUrl: 'https://developer.amazon.com/amazonbot',
    color: '#ff9900',
  },
  bingbot: {
    label: 'Bingbot',
    org: 'Microsoft',
    icon: '🔵',
    policyUrl: 'https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0',
    color: '#008373',
  },
  facebookbot: {
    label: 'FacebookBot',
    org: 'Meta',
    icon: '👥',
    policyUrl: 'https://developers.facebook.com/docs/sharing/webmasters/crawler',
    color: '#1877f2',
  },
  applebot: {
    label: 'Applebot',
    org: 'Apple',
    icon: '🍎',
    policyUrl: 'https://support.apple.com/en-us/119829',
    color: '#000000',
  },
  bytespider: {
    label: 'Bytespider',
    org: 'ByteDance',
    icon: '🕷️',
    policyUrl: 'https://zhanzhang.toutiao.com/robots/bytespider',
    color: '#fe2c55',
  },
};

export function getBotMeta(botKey: string): BotMeta {
  const normalized = botKey.toLowerCase().replace(/[\s-]/g, '');
  return (
    BOT_METADATA[normalized] ||
    BOT_METADATA[botKey] || {
      label: botKey,
      org: 'Unknown',
      icon: '🤖',
      color: '#6b7280',
    }
  );
}

export function formatBotLabel(botKey: string, includeOrg = false): string {
  const meta = getBotMeta(botKey);
  return includeOrg ? `${meta.label} (${meta.org})` : meta.label;
}

