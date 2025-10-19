/**
 * Workers AI embeddings wrapper with model probing and fallback
 * Uses BGE small/base models for text embeddings
 */

let MODEL = "@cf/baai/bge-small-en-v1.5";

export async function initEmbeddingModel(env: any, kv: any) {
  const key = "industry:v2:embed:model";
  const cached = await kv.get(key);
  if (cached) { 
    MODEL = cached; 
    return; 
  }
  
  // Try models in order of preference
  const candidates = [
    "@cf/baai/bge-small-en-v1.5",
    "@cf/baai/bge-base-en-v1.5",
    "@cf/llm/embed-multilingual-light-v1"
  ];
  
  for (const m of candidates) {
    try { 
      await env.AI.run(m, { text: "probe" }); 
      MODEL = m; 
      console.log(`[EMBEDDINGS] Using model: ${m}`);
      break; 
    } catch (e) {
      console.warn(`[EMBEDDINGS] Model ${m} not available, trying next...`);
    }
  }
  
  await kv.put(key, MODEL, { expirationTtl: 86400 });
}

export async function embed(env: any, text: string): Promise<Float32Array> {
  try {
    const res: any = await env.AI.run(MODEL, { text });
    const arr = res.data?.[0]?.embedding || res.embedding || [];
    return new Float32Array(arr);
  } catch (error) {
    console.error(`[EMBEDDINGS] Failed to embed text:`, error);
    // Return zero vector as fallback
    return new Float32Array(384); // Default BGE embedding size
  }
}

export function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) { 
    dot += a[i] * b[i]; 
    na += a[i] * a[i]; 
    nb += b[i] * b[i]; 
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

