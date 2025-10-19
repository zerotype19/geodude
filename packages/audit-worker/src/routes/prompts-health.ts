/**
 * LLM Prompts Health Monitoring
 * GET /api/llm/prompts/health
 * 
 * Exposes SLOs and recent prompt generation stats
 */

import { Env } from '../index';

type PromptHealthLog = {
  domain: string;
  industry: string;
  source: string;
  nonBrandedCount: number;
  leakRate: number;
  realismScore: number;
  coldStartMs?: number;
  timestamp: string;
};

/**
 * Parse recent logs from KV (stored by buildLLMQueryPrompts)
 */
async function getRecentPromptLogs(env: Env, limit: number = 25): Promise<PromptHealthLog[]> {
  try {
    // Get list of recent prompt log keys (last 100)
    const list = await env.RULES.list({ prefix: 'prompt_log:', limit: 100 });
    
    if (!list.keys || list.keys.length === 0) {
      return [];
    }
    
    // Fetch all logs in parallel
    const logs = await Promise.all(
      list.keys.slice(0, limit).map(async (key) => {
        const raw = await env.RULES.get(key.name);
        return raw ? JSON.parse(raw) : null;
      })
    );
    
    return logs.filter(Boolean).slice(0, limit);
  } catch (error) {
    console.error('[PROMPTS_HEALTH] Failed to fetch logs:', error);
    return [];
  }
}

/**
 * Calculate SLO metrics from recent logs
 */
function calculateSLOs(logs: PromptHealthLog[]) {
  if (logs.length === 0) {
    return {
      leak_rate_max: 0,
      nb_count_min: 0,
      realism_avg: 0,
      cold_start_p95: 0,
      mss_usage_rate: 0,
      default_industry_rate: 0,
      kv_hit_rate: 0,
      sample_size: 0
    };
  }
  
  const leakRates = logs.map(l => l.leakRate);
  const nbCounts = logs.map(l => l.nonBrandedCount);
  const realismScores = logs.map(l => l.realismScore);
  const coldStartTimes = logs.filter(l => l.coldStartMs).map(l => l.coldStartMs!);
  const mssUsage = logs.filter(l => l.source.includes('min_safe')).length;
  const defaultIndustry = logs.filter(l => l.industry === 'default').length;
  const kvHits = logs.filter(l => !l.coldStartMs).length;
  
  // Calculate P95 for cold start times
  const sortedColdStart = coldStartTimes.sort((a, b) => a - b);
  const p95Index = Math.floor(sortedColdStart.length * 0.95);
  
  return {
    leak_rate_max: Math.max(...leakRates, 0),
    nb_count_min: Math.min(...nbCounts, 0),
    realism_avg: realismScores.reduce((a, b) => a + b, 0) / realismScores.length,
    cold_start_p95: sortedColdStart[p95Index] || 0,
    mss_usage_rate: (mssUsage / logs.length) * 100,
    default_industry_rate: (defaultIndustry / logs.length) * 100,
    kv_hit_rate: (kvHits / logs.length) * 100,
    sample_size: logs.length
  };
}

/**
 * Check if SLOs are passing
 */
function checkSLOs(slos: ReturnType<typeof calculateSLOs>) {
  const passing = {
    leak_rate: slos.leak_rate_max === 0,
    nb_count: slos.nb_count_min >= 11,
    realism_score: slos.realism_avg >= 0.70, // Slightly below target for aggregate
    cold_start_latency: slos.cold_start_p95 <= 2500,
    mss_usage: slos.mss_usage_rate <= 20,
    default_rate: slos.default_industry_rate <= 15,
    kv_hit_rate: slos.kv_hit_rate >= 80 || slos.sample_size < 10 // Skip if not warmed yet
  };
  
  const all_passing = Object.values(passing).every(p => p);
  
  return { passing, all_passing };
}

export async function handlePromptsHealth(env: Env): Promise<Response> {
  try {
    // Get recent logs
    const logs = await getRecentPromptLogs(env, 25);
    
    // Calculate SLOs
    const slos = calculateSLOs(logs);
    const { passing, all_passing } = checkSLOs(slos);
    
    // Build response
    const health = {
      status: all_passing ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      slos: {
        leak_rate: {
          value: slos.leak_rate_max,
          target: 0,
          passing: passing.leak_rate,
          description: 'Maximum brand leak rate (should be 0%)'
        },
        nb_count: {
          value: slos.nb_count_min,
          target: 11,
          passing: passing.nb_count,
          description: 'Minimum non-branded query count'
        },
        realism_score: {
          value: Math.round(slos.realism_avg * 100) / 100,
          target: 0.70,
          passing: passing.realism_score,
          description: 'Average realism score'
        },
        cold_start_latency_p95: {
          value: Math.round(slos.cold_start_p95),
          target: 2500,
          passing: passing.cold_start_latency,
          description: 'P95 cold-start latency (ms)'
        },
        mss_usage_rate: {
          value: Math.round(slos.mss_usage_rate * 10) / 10,
          target: 20,
          passing: passing.mss_usage,
          description: 'MSS fallback usage rate (%)'
        },
        default_industry_rate: {
          value: Math.round(slos.default_industry_rate * 10) / 10,
          target: 15,
          passing: passing.default_rate,
          description: 'Default industry classification rate (%)'
        },
        kv_hit_rate: {
          value: Math.round(slos.kv_hit_rate * 10) / 10,
          target: 80,
          passing: passing.kv_hit_rate,
          description: 'KV cache hit rate (%)'
        }
      },
      recent_runs: logs.map(log => ({
        domain: log.domain,
        industry: log.industry,
        source: log.source,
        nb: log.nonBrandedCount,
        leak: log.leakRate,
        realism: Math.round(log.realismScore * 100) / 100,
        cold_start_ms: log.coldStartMs || null,
        timestamp: log.timestamp
      })),
      sample_size: slos.sample_size
    };
    
    return new Response(JSON.stringify(health, null, 2), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error: any) {
    console.error('[PROMPTS_HEALTH] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch health metrics',
      message: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

