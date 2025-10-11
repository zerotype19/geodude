import type { ProviderAnswer } from "./adapter-tavily";

export async function braveWeb(env: any, q: string, count = 8) {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", q);
  url.searchParams.set("count", String(count));
  url.searchParams.set("country", "us");
  url.searchParams.set("safesearch", "moderate");
  
  const r = await fetch(url, { 
    headers: { "X-Subscription-Token": env.BRAVE_SEARCH || env.BRAVE_API_KEY }
  });
  
  if (!r.ok) throw new Error(`brave-web ${r.status} ${await r.text()}`);
  
  return r.json();
}

export async function summarizeWithGPT(env: any, query: string, results: any[]): Promise<string> {
  const base = env.OPENAI_API_BASE || "https://api.openai.com/v1";
  const model = env.OPENAI_MODEL || "gpt-4o";
  const list = results.slice(0, 8).map(r => `- ${r.title}\n${r.url}\n${r.snippet || ""}`).join("\n\n");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { 
      "content-type": "application/json", 
      authorization: `Bearer ${env.OPENAI_API_KEY}` 
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { 
          role: "system", 
          content: "Summarize using ONLY the provided sources. Always cite using the exact URLs." 
        },
        { 
          role: "user", 
          content: `Query: ${query}\n\nSources:\n${list}\n\nReturn a brief answer followed by bullet citations (urls).` 
        }
      ]
    })
  });
  
  if (!res.ok) throw new Error(`openai ${res.status} ${await res.text()}`);
  
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

export async function braveWithGPT(env: any, query: string): Promise<ProviderAnswer> {
  const web = await braveWeb(env, query, 8);
  const results = (web.web?.results || []).map((r: any) => ({ 
    title: r.title, 
    url: r.url, 
    snippet: r.snippet 
  }));
  
  if (!results.length) throw new Error("no-brave-results");
  
  const answer = await summarizeWithGPT(env, query, results);
  
  return { 
    answer, 
    citations: results.map(r => r.url), 
    provider: "brave+gpt" 
  };
}

