export const BOT_PATTERNS: {key: string; label: string; re: RegExp}[] = [
  { key: "gptbot",          label: "GPTBot",          re: /gptbot/i },
  { key: "chatgpt-user",    label: "ChatGPT-User",    re: /chatgpt-user/i },
  { key: "claude-web",      label: "Claude-Web",      re: /claude-web|claudebot/i },
  { key: "perplexitybot",   label: "PerplexityBot",   re: /perplexitybot/i },
  { key: "ccbot",           label: "CCBot",           re: /ccbot/i },
  { key: "google-extended", label: "Google-Extended", re: /google-extended/i },
  { key: "amazonbot",       label: "Amazonbot",       re: /amazonbot/i },
  { key: "bingbot",         label: "Bingbot",         re: /bingbot/i },
  { key: "facebookbot",     label: "FacebookBot",     re: /facebookbot/i },
  { key: "applebot",        label: "Applebot",        re: /applebot/i },
  // add more as we see them
];

export function detectBot(ua: string): {key: string; label: string} | null {
  for (const b of BOT_PATTERNS) {
    if (b.re.test(ua)) {
      return {key: b.key, label: b.label};
    }
  }
  return null;
}

