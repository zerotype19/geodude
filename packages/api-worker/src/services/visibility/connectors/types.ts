/**
 * Live Connector Types
 * 
 * Stable contract for all AI assistant connectors
 */

export type ConnectorResult = {
  answer: string;
  sources: Array<{
    title?: string;
    url: string;
    snippet?: string;
    source_type?: 'native' | 'heuristic';
  }>;
  raw: string;
};

export interface AssistantConnector {
  id: "perplexity" | "chatgpt_search" | "claude";
  ask(prompt: string, env: Env): Promise<ConnectorResult>;
}

// Environment interface extension for API keys
export interface Env {
  // Existing env vars...
  DB?: D1Database;
  PROMPT_PACKS?: KVNamespace;
  ASSISTANT_SCHEDULES?: KVNamespace;
  HEURISTICS?: KVNamespace;
  
  // Feature flags
  FEATURE_ASSISTANT_VISIBILITY?: string;
  FEATURE_EEAT_SCORING?: string;
  FEATURE_VIS_PERPLEXITY?: string;
  FEATURE_VIS_CHATGPT?: string;
  FEATURE_VIS_CLAUDE?: string;
  
  // Connector config
  VIS_CONNECT_TIMEOUT_MS?: string;
  VIS_CONNECT_RETRIES?: string;
  VIS_RATE_PER_PROJECT?: string;
  
  // API Keys (secrets)
  PERPLEXITY_API_KEY?: string;
  OPENAI_API_KEY?: string;
  CLAUDE_API_KEY?: string;
  
  // Optional org IDs
  PERPLEXITY_ORG_ID?: string;
  OPENAI_ORG_ID?: string;
}
