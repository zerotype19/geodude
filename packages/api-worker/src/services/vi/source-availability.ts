/**
 * Single source of truth for VI source availability
 * Ensures consistency between fetch and queue processing
 */

import { Env } from '../../index';

export type Source = "perplexity" | "chatgpt_search" | "claude";

export function getEnabledSources(env: Env): Source[] {
  try {
    const fromEnv = JSON.parse(env.VI_SOURCES || '["perplexity","chatgpt_search","claude"]');
    return (Array.isArray(fromEnv) ? fromEnv : []).filter(s =>
      ["perplexity","chatgpt_search","claude"].includes(s)
    );
  } catch { 
    return ["perplexity","chatgpt_search","claude"]; 
  }
}

export function getAvailableSources(env: Env): Source[] {
  const enabled = getEnabledSources(env);
  
  // Accept either CLAUDE_API_KEY or ANTHROPIC_API_KEY for Claude
  const haveClaude = !!(env.CLAUDE_API_KEY || (env as any).ANTHROPIC_API_KEY);
  
  const status: Record<Source, boolean> = {
    chatgpt_search: !!env.OPENAI_API_KEY,
    perplexity: !!env.PERPLEXITY_API_KEY,
    claude: haveClaude,
  };
  
  return enabled.filter(s => status[s]);
}
