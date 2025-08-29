export const AI_SOURCE_ALIASES: Record<string, string> = {
  // domains → slug
  'chat.openai.com': 'chatgpt', 'openai.com': 'chatgpt', 'chatgpt.com': 'chatgpt', 'chatgpt': 'chatgpt',
  'perplexity.ai': 'perplexity', 'perplexity': 'perplexity',
  'gemini.google.com': 'google_gemini', 'gemini': 'google_gemini', 'google_gemini': 'google_gemini',
  'copilot.microsoft.com': 'microsoft_copilot', 'bing.com/chat': 'microsoft_copilot', 'copilot': 'microsoft_copilot'
};

function normalizeAlias(v: string): string {
  return v.trim().toLowerCase().replace(/^www\./,'');
}

export function aliasToSlug(v?: string|null): string|undefined {
  if (!v) return;
  const n = normalizeAlias(v);
  if (AI_SOURCE_ALIASES[n]) return AI_SOURCE_ALIASES[n];
  // domain fallback (strip path / query)
  const host = (() => { try { return new URL(n.startsWith('http')? n : `https://${n}`).hostname; } catch { return n; } })();
  return AI_SOURCE_ALIASES[normalizeAlias(host)];
}
