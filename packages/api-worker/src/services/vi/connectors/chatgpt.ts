/**
 * Enhanced ChatGPT connector using OpenAI API with structured output
 */

import { parseSourcesBlock, normalizeUrl, validateUrls, Citation } from "../citations";

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

  let citations: Citation[] = [];
  try {
    const json = JSON.parse(text);
    const content = json?.choices?.[0]?.message?.content ?? "";
    // If the model honored JSON schema, content is JSON string
    let payload: any = content;
    if (typeof content === "string") {
      try { payload = JSON.parse(content); } catch { /* will fallback */ }
    }
    if (payload?.citations?.length) {
      citations = payload.citations
        .map((c: any) => ({ title: c.title, ref_url: normalizeUrl(c.url) || "" }))
        .filter((c: Citation) => !!c.ref_url);
    } else {
      // Fallback to text parsing (in case schema not honored)
      const raw = json?.choices?.[0]?.message?.content ?? "";
      citations = parseSourcesBlock(String(raw));
    }
  } catch {
    // As a last resort, try parsing the raw response for links
    citations = parseSourcesBlock(text);
  }

  // Validate URLs (cheap HEAD)
  const ok = await validateUrls(citations.map(c => c.ref_url), timeoutMs);
  const final = citations.filter(c => ok.includes(c.ref_url));

  return { citations: final };
}
