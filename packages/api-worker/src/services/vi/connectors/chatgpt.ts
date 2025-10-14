/**
 * Enhanced ChatGPT connector using OpenAI API with structured output
 */

import { parseSourcesBlock, normalizeUrl, validateUrls, Citation } from "../citations";
import { normalizeHost, deriveAliases, isAuditedUrl } from "../domain-match";

type Env = {
  OPENAI_API_KEY: string;
  VI_CONNECTOR_TIMEOUT_MS: string | number;
};

export async function runChatGPT(env: Env, query: string, signal: AbortSignal) {
  const timeoutMs = Number(env.VI_CONNECTOR_TIMEOUT_MS || 15000);

  // Use JSON schema so parsing is trivial; fall back to text parsing if provider ignores it.
  const body = {
    model: "gpt-4o-mini", // fast & accurate
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "citations_schema",
        schema: {
          type: "object",
          properties: {
            answer: { type: "string" },
            citations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  url: { type: "string" }
                },
                required: ["url"],
                additionalProperties: false
              }
            }
          },
          required: ["citations"]
        },
        strict: true
      }
    },
    messages: [
      {
        role: "system",
        content:
          "You are assessing visibility. Respond briefly, then provide a structured citations list of real web URLs that support the answer."
      },
      {
        role: "user",
        content:
`Query: ${query}

Return JSON only that matches the provided schema.
If you cannot find any sources, return an empty citations array.`
      }
    ],
    temperature: 0.2
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${text.slice(0,300)}`);

  // 1) Collect raw candidates from ALL places
  let responseText = "";
  let structured: Citation[] = [];
  let parsed: Citation[] = [];
  
  try {
    const json = JSON.parse(text);
    const content = json?.choices?.[0]?.message?.content ?? "";
    responseText = content;
    
    // Get structured citations from JSON response
    let payload: any = content;
    if (typeof content === "string") {
      try { payload = JSON.parse(content); } catch { /* will fallback */ }
    }
    
    const structuredSources = (payload?.sources || payload?.citations || [])
      .map((s: any) => ({ 
        title: s.title || s.name, 
        ref_url: normalizeUrl(s.url) || "" 
      }))
      .filter((c: Citation) => !!c.ref_url);
    
    structured = structuredSources;
    
    // Get parsed citations from text
    parsed = parseSourcesBlock(String(responseText));
    
  } catch {
    // As a last resort, try parsing the raw response for links
    responseText = responseText || "";
    parsed = parseSourcesBlock(responseText);
  }

  // 2) Merge + de-dup, keep first title seen
  const seen = new Set<string>();
  const merged = [...structured, ...parsed].filter(c => {
    if (!c?.ref_url) return false;
    const key = c.ref_url.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 3) Validate with brand-host bypass
  const auditedHost = "cologuard.com"; // TODO: get from env or context
  const aliases = deriveAliases(auditedHost);
  const brandHosts = [auditedHost, ...aliases].filter(Boolean);

  const validUrls = await validateUrls(merged.map(m => m.ref_url), 15000, brandHosts);

  // 4) Build final citations (preserve titles)
  const final = merged
    .filter(m => validUrls.includes(m.ref_url))
    .map((m, idx) => ({
      rank: idx + 1,
      ref_url: m.ref_url,
      title: m.title?.trim() || undefined,
      ref_domain: new URL(m.ref_url).hostname.replace(/^www\./,'').toLowerCase(),
      was_audited: isAuditedUrl(m.ref_url, auditedHost, aliases)
    }));

  return { citations: final };
}
