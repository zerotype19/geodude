/**
 * Workers AI binding helper
 * Provides compatibility shim for various binding names
 */

export function getAI(env: any): any {
  // Prefer the official binding
  // @ts-ignore - optional legacy bindings
  return env.AI ?? env.WORKERS_AI ?? env.workers_ai ?? null;
}

