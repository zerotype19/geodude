/**
 * Rock-Solid Claude Live Connector
 * 
 * JSON-first approach with References fallback for maximum reliability
 */

import { AssistantConnector, ConnectorResult, Env } from "./types";
import { parseSourcesBlock, normalizeUrl, validateUrls, Citation } from "../../vi/citations";

export const ClaudeConnector: AssistantConnector = {
  id: "claude",
  
  async ask(prompt: string, env: Env): Promise<ConnectorResult> {
    const startTime = Date.now();
    
    // Retry + timeout helpers
    const controller = new AbortController();
    const timeoutMs = Number(env.VI_CONNECTOR_TIMEOUT_MS || 15000);
    const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

    try {
      const apiKey = env.CLAUDE_API_KEY || env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("Missing CLAUDE_API_KEY/ANTHROPIC_API_KEY");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 600,
          temperature: 0.2,
          system: "You assess visibility. Provide a brief answer AND a list of real, reachable URLs.",
          messages: [
            {
              role: "user",
              content: `Query: ${prompt}

Return either:

A) JSON:
{"answer":"...","references":[{"title":"...","url":"https://..."}, ...]}

OR

B) A short answer followed by:
References
- <title> — <url>
- <title> — <url>

Only include real URLs (no footnotes).`
            }
          ]
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const raw = await response.text();
      const latency = Date.now() - startTime;

      // Claude responses put text inside content blocks; consolidate:
      let textOut = "";
      try {
        const j = JSON.parse(raw);
        const blocks = j?.content ?? [];
        textOut = blocks.map((b: any) => b?.text || "").join("\n").trim();
      } catch { textOut = raw; }

      let citations: Citation[] = [];

      // Try embedded JSON object first
      const jsonMatch = textOut.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const payload = JSON.parse(jsonMatch[0]);
          if (Array.isArray(payload?.references)) {
            citations = payload.references
              .map((r: any) => ({ title: r.title, ref_url: normalizeUrl(r.url) || "" }))
              .filter((c: Citation) => !!c.ref_url);
          }
        } catch { /* ignore */ }
      }
      if (!citations.length) citations = parseSourcesBlock(textOut);

      // Validate URLs (cheap HEAD)
      const ok = await validateUrls(citations.map(c => c.ref_url), timeoutMs);
      const final = citations.filter(c => ok.includes(c.ref_url));

      // Convert to sources format
      const sources: ConnectorResult["sources"] = final.map((c, index) => ({
        url: c.ref_url,
        title: c.title || `Source ${index + 1}`,
        snippet: undefined,
        source_type: 'structured' as const
      }));

      console.log(`[ClaudeConnector] Success: ${latency}ms, ${sources.length} sources, ${textOut.length} chars`);
      
      return { answer: textOut, sources, raw };
      
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
