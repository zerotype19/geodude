import { RateLimiter } from "../../lib/rateLimiter";
import { tavily } from "./adapter-tavily";
import { perplexity } from "./adapter-perplexity";
import { braveWithGPT } from "./adapter-brave-gpt";

export type CitationAnswer = { answer: string; citations: string[]; provider: string };

const norm = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");
const ttl = (env: any) => parseInt(env.PROVIDER_CACHE_TTL || "86400", 10);

export async function answerWithCitations(env: any, query: string): Promise<CitationAnswer> {
  const nq = norm(query);
  if (nq.length < 3) throw new Error("query-too-short");

  const key = `cit:${nq}`;
  const cached = await env.RECO_CACHE?.get(key);
  if (cached) {
    console.log(`[cit] Cache hit for "${nq}"`);
    return JSON.parse(cached);
  }

  const T = new RateLimiter(parseInt(env.TAVILY_QPS || "3", 10), 1000);
  const P = new RateLimiter(parseInt(env.PPLX_QPS || "2", 10), 1000);

  if (env.ENABLE_MULTI_PROVIDER === "1") {
    // Try Tavily first (fast)
    try {
      await T.take();
      console.log(`[cit] Trying Tavily for "${nq}"`);
      const x = await tavily(env, nq);
      if (x.answer && x.citations.length) {
        console.log(`[cit] Tavily success: ${x.citations.length} citations`);
        return await save(env, key, x);
      }
    } catch (e) {
      console.log("[cit] Tavily failed:", String(e));
    }

    // Try Perplexity (higher quality)
    try {
      await P.take();
      console.log(`[cit] Trying Perplexity for "${nq}"`);
      const x = await perplexity(env, nq);
      if (x.answer && x.citations.length) {
        console.log(`[cit] Perplexity success: ${x.citations.length} citations`);
        return await save(env, key, x);
      }
    } catch (e) {
      console.log("[cit] Perplexity failed:", String(e));
    }
  }

  // Fallback: Brave + GPT (guaranteed citations)
  console.log(`[cit] Using Brave+GPT fallback for "${nq}"`);
  const b = await braveWithGPT(env, nq);
  console.log(`[cit] Brave+GPT success: ${b.citations.length} citations`);
  return await save(env, key, b);
}

async function save(env: any, key: string, val: CitationAnswer) {
  if (env.RECO_CACHE) {
    await env.RECO_CACHE.put(key, JSON.stringify(val), { expirationTtl: ttl(env) });
  }
  return val;
}

