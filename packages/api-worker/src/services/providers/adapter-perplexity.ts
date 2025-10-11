import type { ProviderAnswer } from "./adapter-tavily";

export async function perplexity(env: any, query: string): Promise<ProviderAnswer> {
  if (!env.PERPLEXITY_API_KEY) throw new Error("missing PERPLEXITY_API_KEY");
  
  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { 
      "content-type": "application/json", 
      authorization: `Bearer ${env.PERPLEXITY_API_KEY}` 
    },
    body: JSON.stringify({ 
      model: "sonar", 
      temperature: 0.1, 
      messages: [{ role: "user", content: query }] 
    })
  });
  
  if (!r.ok) throw new Error(`perplexity ${r.status} ${await r.text()}`);
  
  const j = await r.json();
  const m = j.choices?.[0]?.message ?? {};
  
  return { 
    answer: String(m.content ?? ""), 
    citations: Array.isArray(m.citations) ? m.citations : [], 
    provider: "perplexity" 
  };
}

