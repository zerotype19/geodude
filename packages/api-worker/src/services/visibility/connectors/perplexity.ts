/**
 * Perplexity Live Connector
 * 
 * Real API integration for Perplexity AI
 */

import { AssistantConnector, ConnectorResult, Env } from "./types";

export const PerplexityConnector: AssistantConnector = {
  id: "perplexity",
  
  async ask(prompt: string, env: Env): Promise<ConnectorResult> {
    const startTime = Date.now();
    
    // Retry + timeout helpers
    const controller = new AbortController();
    const timeoutMs = Number(env.VIS_CONNECT_TIMEOUT_MS || 15000);
    const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
          ...(env.PERPLEXITY_ORG_ID ? { "Perplexity-Organization": env.PERPLEXITY_ORG_ID } : {})
        },
        body: JSON.stringify({
          model: "sonar", // Safe default; can be made configurable
          messages: [{ role: "user", content: prompt }],
          return_images: false,
          temperature: 0.2
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
      }

      const raw = await response.text();
      const latency = Date.now() - startTime;

      // Parse response leniently; keep raw for proof
      let answer = "";
      let sources: ConnectorResult["sources"] = [];
      
      try {
        const data = JSON.parse(raw);
        answer = data?.choices?.[0]?.message?.content ?? "";
        
        // Extract citations from various possible locations
        const citations = data?.choices?.[0]?.message?.citations ?? 
                        data?.citations ?? 
                        data?.choices?.[0]?.citations ?? [];
        
        // Also check search_results for additional context
        const searchResults = data?.search_results || [];
        
        // Combine citations and search results
        const allSources = [
          ...(citations || []).map((cite: any) => ({
            title: cite.title || cite.name,
            url: cite.url,
            snippet: cite.snippet || cite.text
          })),
          ...(searchResults || []).map((result: any) => ({
            title: result.title,
            url: result.url,
            snippet: result.snippet
          }))
        ];
        
        sources = allSources
          .filter((source: any) => source.url) // Only keep items with URLs
          .map((source: any) => ({
            ...source,
            source_type: 'native' as const
          }));
        
      } catch (parseError) {
        console.warn('[PerplexityConnector] Parse error, keeping raw response:', parseError);
        // Keep empty answer/sources, raw is stored
      }

      console.log(`[PerplexityConnector] Success: ${latency}ms, ${sources.length} sources, ${answer.length} chars`);
      
      return { answer, sources, raw };
      
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error(`[PerplexityConnector] Error after ${latency}ms:`, error);
      
      // Return empty result on error, but don't throw (let processor handle retries)
      return {
        answer: "",
        sources: [],
        raw: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
      };
    }
  }
};
