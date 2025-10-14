/**
 * Rock-Solid ChatGPT Search Live Connector
 * 
 * Structured JSON-first approach with text fallback for maximum reliability
 */

import { AssistantConnector, ConnectorResult, Env } from "./types";
import { parseSourcesBlock, normalizeUrl, validateUrls, Citation } from "../../vi/citations";

export const ChatGPTSearchConnector: AssistantConnector = {
  id: "chatgpt_search",
  
  async ask(prompt: string, env: Env): Promise<ConnectorResult> {
    const startTime = Date.now();
    
    // Retry + timeout helpers
    const controller = new AbortController();
    const timeoutMs = Number(env.VI_CONNECTOR_TIMEOUT_MS || 15000);
    const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

    try {
      const body = {
        model: "gpt-4o-mini", // fast + accurate; use what's enabled
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You assess visibility. Provide a brief answer and a citations list of REAL web URLs. Always end with a SOURCES section using bullet points like: - <title> — <url>"
          },
          {
            role: "user",
            content: `Query: ${prompt}\n\nThen output a SOURCES list with bullet points:\n- <title> — <url>`
          }
        ]
      };

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          ...(env.OPENAI_ORG_ID ? { "OpenAI-Organization": env.OPENAI_ORG_ID } : {})
        },
        body: JSON.stringify(body),
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));

      const raw = await response.text();
      const latency = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`OpenAI ${response.status}: ${raw.slice(0,300)}`);
      }

      let citations: Citation[] = [];
      let answer = "";
      
      try {
        const json = JSON.parse(raw);
        const content = json?.choices?.[0]?.message?.content ?? "";
        
        // Use text parsing for sources block
        citations = parseSourcesBlock(String(content));
        answer = String(content);
      } catch {
        citations = parseSourcesBlock(raw);
        answer = raw.slice(0, 500);
      }

      // Validate quickly (allow 403/405) - skip validation for brand hosts
      const brandHosts = ['cologuard.com', 'cologuardtest.com', 'exactsciences.com'];
      const ok = await validateUrls(citations.map(c => c.ref_url), timeoutMs, brandHosts);
      const final = citations.filter(c => ok.includes(c.ref_url));

      // Convert to sources format
      const sources: ConnectorResult["sources"] = final.map((c, index) => ({
        url: c.ref_url,
        title: c.title || `Source ${index + 1}`,
        snippet: undefined,
        source_type: 'structured' as const
      }));

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
