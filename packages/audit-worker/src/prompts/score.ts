/**
 * Realism scorer using Workers AI
 */

import { getAI } from '../utils/ai';

export async function realismScore(env: any, query: string): Promise<number> {
  const AI = getAI(env);
  if (!AI) return 0.85; // No AI binding, accept all with high default score
  
  const sys = "Return only a number 0..1 representing how natural this looks as a human or LLM query. No text.";
  const user = `Query: ${query}\nScore:`;
  
  // Retry up to 3 times with jitter
  for (let i = 0; i < 3; i++) {
    try {
      const res: any = await AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ]
      });
      
      const raw = String(res?.response ?? res?.output ?? '').trim();
      const match = raw.match(/0(\.\d+)?|1(\.0+)?/);
      const val = match ? parseFloat(match[0]) : 0.85;
      
      if (isFinite(val)) {
        return Math.max(0, Math.min(1, val));
      }
    } catch (e) {
      // Wait with jitter before retry
      await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
    }
  }
  
  // All retries failed, return safe default
  return 0.8;
}

