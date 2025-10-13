/**
 * ChatGPT Search Live Connector
 * 
 * Real API integration for OpenAI ChatGPT with web search
 */

import { AssistantConnector, ConnectorResult, Env } from "./types";

export const ChatGPTSearchConnector: AssistantConnector = {
  id: "chatgpt_search",
  
  async ask(prompt: string, env: Env): Promise<ConnectorResult> {
    const startTime = Date.now();
    
    // Retry + timeout helpers
    const controller = new AbortController();
    const timeoutMs = Number(env.VIS_CONNECT_TIMEOUT_MS || 15000);
    const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          ...(env.OPENAI_ORG_ID ? { "OpenAI-Organization": env.OPENAI_ORG_ID } : {})
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // or your browsing-enabled model
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 1000
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const raw = await response.text();
      const latency = Date.now() - startTime;

      // Parse response and extract URLs heuristically
      let answer = "";
      let sources: ConnectorResult["sources"] = [];
      
      try {
        const data = JSON.parse(raw);
        answer = data?.choices?.[0]?.message?.content ?? "";
        
        // Extract URLs heuristically from the response
        // Look for URLs in the content and any tool calls, including Markdown links
        const urlRegex = /https?:\/\/[^\s"'<>]+/g;
        const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s"'<>]+)\)/g;
        
        const allUrls = [
          // Standard URLs
          ...(answer.match(urlRegex) || []),
          ...(JSON.stringify(data).match(urlRegex) || []),
          // Markdown-style links [text](url)
          ...(Array.from(answer.matchAll(markdownLinkRegex)).map(match => match[2])),
          ...(Array.from(JSON.stringify(data).matchAll(markdownLinkRegex)).map(match => match[2]))
        ];
        
        // Deduplicate and limit to top 10
        const uniqueUrls = [...new Set(allUrls)].slice(0, 10);
        
        sources = uniqueUrls.map(url => ({
          url: url,
          title: undefined, // ChatGPT doesn't provide titles in basic API
          snippet: undefined,
          source_type: 'heuristic' as const
        }));
        
      } catch (parseError) {
        console.warn('[ChatGPTSearchConnector] Parse error, keeping raw response:', parseError);
        // Keep empty answer/sources, raw is stored
      }

      console.log(`[ChatGPTSearchConnector] Success: ${latency}ms, ${sources.length} sources, ${answer.length} chars`);
      
      return { answer, sources, raw };
      
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error(`[ChatGPTSearchConnector] Error after ${latency}ms:`, error);
      
      // Return empty result on error, but don't throw (let processor handle retries)
      return {
        answer: "",
        sources: [],
        raw: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
      };
    }
  }
};
