export type ProviderAnswer = { answer: string; citations: string[]; provider: string };

export async function tavily(env: any, query: string): Promise<ProviderAnswer> {
  if (!env.TAVILY_API_KEY) throw new Error("missing TAVILY_API_KEY");
  
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { 
      "content-type": "application/json", 
      "x-api-key": env.TAVILY_API_KEY 
    },
    body: JSON.stringify({ 
      query, 
      include_answer: true, 
      max_results: 8 
    })
  });
  
  if (!r.ok) throw new Error(`tavily ${r.status} ${await r.text()}`);
  
  const j = await r.json();
  
  return { 
    answer: j.answer ?? "", 
    citations: (j.results || []).map((x: any) => x.url).filter(Boolean), 
    provider: "tavily" 
  };
}

