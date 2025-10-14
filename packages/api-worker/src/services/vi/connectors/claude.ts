/**
 * Enhanced Claude connector using Anthropic API with structured output
 */

import { parseSourcesBlock, normalizeUrl, validateUrls, Citation } from "../citations";

type Env = {
  CLAUDE_API_KEY?: string;      // you said you store CLAUDE_API_KEY
  ANTHROPIC_API_KEY?: string;   // accept both
  VI_CONNECTOR_TIMEOUT_MS: string | number;
};

export async function runClaude(env: Env, query: string, signal: AbortSignal) {
  const apiKey = env.CLAUDE_API_KEY || env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing CLAUDE_API_KEY/ANTHROPIC_API_KEY");
  const timeoutMs = Number(env.VI_CONNECTOR_TIMEOUT_MS || 15000);

  const body = {
    model: "claude-3-5-sonnet-latest",
    max_tokens: 800,
    temperature: 0.2,
    system: "You are assessing visibility. Return a short answer and a structured References list of direct URLs.",
    messages: [
      {
        role: "user",
        content:
`Query: ${query}

Return either:
A) JSON:
{"answer":"...", "references":[{"title":"...","url":"https://..."}, ...]}

OR

B) A short answer followed by a "References" section with bullet points:
- <title> — <url>
- <title> — <url>

Only use real, reachable URLs.`
      }
    ]
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(body),
    signal
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0,300)}`);

  let citations: Citation[] = [];
  try {
    const json = JSON.parse(text);
    const blocks = json?.content ?? [];
    const combined = blocks.map((b: any) => b?.text || "").join("\n").trim();

    // Try JSON payload inside the text
    const jsonMatch = combined.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const payload = JSON.parse(jsonMatch[0]);
        if (payload?.references?.length) {
          citations = payload.references
            .map((r: any) => ({ title: r.title, ref_url: normalizeUrl(r.url) || "" }))
            .filter((c: Citation) => !!c.ref_url);
        }
      } catch { /* ignore */ }
    }
    if (!citations.length) {
      citations = parseSourcesBlock(combined);
    }
  } catch {
    citations = parseSourcesBlock(text);
  }

  const ok = await validateUrls(citations.map(c => c.ref_url), timeoutMs);
  const final = citations.filter(c => ok.includes(c.ref_url));

  return { citations: final };
}
