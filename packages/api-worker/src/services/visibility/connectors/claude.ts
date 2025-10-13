/**
 * Claude Live Connector
 * 
 * Real API integration for Anthropic Claude
 */

import { AssistantConnector, ConnectorResult, Env } from "./types";

export const ClaudeConnector: AssistantConnector = {
  id: "claude",
  
  async ask(prompt: string, env: Env): Promise<ConnectorResult> {
    const startTime = Date.now();
    
    // Retry + timeout helpers
    const controller = new AbortController();
    const timeoutMs = Number(env.VIS_CONNECT_TIMEOUT_MS || 15000);
    const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.CLAUDE_API_KEY!,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }]
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const raw = await response.text();
      const latency = Date.now() - startTime;

      // Parse response and extract URLs heuristically
      let answer = "";
      let sources: ConnectorResult["sources"] = [];
      
      try {
        const data = JSON.parse(raw);
        answer = data?.content?.[0]?.text ?? "";
        
        // Extract URLs heuristically from the response
        // Claude doesn't always return structured citations, so we extract URLs from text
        const urlRegex = /https?:\/\/[^\s"'<>]+/g;
        const allUrls = [
          ...(answer.match(urlRegex) || []),
          ...(JSON.stringify(data).match(urlRegex) || [])
        ];
        
        // Deduplicate and limit to top 10
        const uniqueUrls = [...new Set(allUrls)].slice(0, 10);
        
        sources = uniqueUrls.map(url => ({
          url: url,
          title: undefined, // Claude doesn't provide titles in basic API
          snippet: undefined,
          source_type: 'heuristic' as const
        }));
        
      } catch (parseError) {
        console.warn('[ClaudeConnector] Parse error, keeping raw response:', parseError);
        // Keep empty answer/sources, raw is stored
      }

      console.log(`[ClaudeConnector] Success: ${latency}ms, ${sources.length} sources, ${answer.length} chars`);
      
      return { answer, sources, raw };
      
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error(`[ClaudeConnector] Error after ${latency}ms:`, error);
      
      // Return empty result on error, but don't throw (let processor handle retries)
      return {
        answer: "",
        sources: [],
        raw: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
      };
    }
  }
};
