/**
 * Live Connectors Router
 * 
 * Central registry for all AI assistant connectors
 */

import { PerplexityConnector } from "./perplexity";
import { ChatGPTSearchConnector } from "./chatgpt";
import { ClaudeConnector } from "./claude";
import { AssistantConnector, Env } from "./types";

export const CONNECTORS = {
  perplexity: PerplexityConnector,
  chatgpt_search: ChatGPTSearchConnector,
  claude: ClaudeConnector
} as const;

export type ConnectorId = keyof typeof CONNECTORS;

/**
 * Check if a connector is enabled via feature flags
 */
export function isConnectorEnabled(assistant: string, env: Env): boolean {
  switch (assistant) {
    case "perplexity":
      return env.FEATURE_VIS_PERPLEXITY === "true";
    case "chatgpt_search":
      return env.FEATURE_VIS_CHATGPT === "true";
    case "claude":
      return env.FEATURE_VIS_CLAUDE === "true";
    default:
      return false;
  }
}

/**
 * Get connector by assistant ID
 */
export function getConnector(assistant: string): AssistantConnector | null {
  return CONNECTORS[assistant as ConnectorId] || null;
}

/**
 * Get enabled connector for assistant
 */
export function getEnabledConnector(assistant: string, env: Env): AssistantConnector | null {
  if (!isConnectorEnabled(assistant, env)) {
    return null;
  }
  return getConnector(assistant);
}
