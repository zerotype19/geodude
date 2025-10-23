/**
 * Prompt Realism Canary Test
 * 
 * Tests the humanness/naturalness of generated prompts across a sample of audits.
 * Returns a pass/fail score with examples and metrics.
 */

import { Env } from '../../index';
import { buildLLMQueryPrompts } from '../../prompts';
import { humanScore, averageHumanScore } from '../../prompts/qualityFilter';

interface CanaryResult {
  domain: string;
  branded_count: number;
  nonBranded_count: number;
  avg_human_score: number;
  top_queries: Array<{ query: string; score: number }>;
  bottom_queries: Array<{ query: string; score: number }>;
}

export async function handlePromptCanary(env: Env): Promise<Response> {
  console.log('[PROMPT_CANARY] Starting realism test...');
  
  try {
    // Get 10 random recent audits
    const audits = await env.DB.prepare(`
      SELECT DISTINCT root_url
      FROM audits
      WHERE started_at > datetime('now', '-30 days')
        AND status = 'completed'
        AND pages_analyzed > 0
      ORDER BY RANDOM()
      LIMIT 10
    `).all();
    
    if (!audits.results || audits.results.length === 0) {
      return new Response(JSON.stringify({
        error: 'No recent audits found for testing'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const results: CanaryResult[] = [];
    let totalQueries = 0;
    let totalScore = 0;
    
    // Test each domain
    for (const audit of audits.results as any[]) {
      try {
        const domain = new URL(audit.root_url).hostname;
        console.log(`[PROMPT_CANARY] Testing ${domain}...`);
        
        const prompts = await buildLLMQueryPrompts(env, domain);
        
        if (!prompts.branded && !prompts.nonBranded) {
          console.log(`[PROMPT_CANARY] No prompts generated for ${domain}, skipping`);
          continue;
        }
        
        const allQueries = [
          ...(prompts.branded || []),
          ...(prompts.nonBranded || [])
        ];
        
        // Score each query
        const scoredQueries = allQueries.map(q => ({
          query: q,
          score: humanScore(q)
        }));
        
        // Sort by score
        scoredQueries.sort((a, b) => b.score - a.score);
        
        const avgScore = averageHumanScore(allQueries);
        totalQueries += allQueries.length;
        totalScore += avgScore * allQueries.length;
        
        results.push({
          domain,
          branded_count: prompts.branded?.length || 0,
          nonBranded_count: prompts.nonBranded?.length || 0,
          avg_human_score: Math.round(avgScore * 1000) / 1000,
          top_queries: scoredQueries.slice(0, 3),
          bottom_queries: scoredQueries.slice(-3).reverse()
        });
        
      } catch (error) {
        console.error(`[PROMPT_CANARY] Error testing ${audit.root_url}:`, error);
      }
    }
    
    if (results.length === 0) {
      return new Response(JSON.stringify({
        error: 'Failed to generate prompts for any domains'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Calculate overall metrics
    const overallAvgScore = totalScore / totalQueries;
    const pass = overallAvgScore >= 0.7;
    
    // Find best and worst examples
    const allScoredQueries = results.flatMap(r => [
      ...r.top_queries,
      ...r.bottom_queries
    ]);
    allScoredQueries.sort((a, b) => b.score - a.score);
    
    const summary = {
      pass,
      avg_human_score: Math.round(overallAvgScore * 1000) / 1000,
      target_score: 0.7,
      total_queries: totalQueries,
      domains_tested: results.length,
      best_examples: allScoredQueries.slice(0, 5),
      worst_examples: allScoredQueries.slice(-5).reverse(),
      per_domain: results,
      recommendations: pass
        ? ['✅ Prompts meet naturalness target (≥ 0.7)', 'Continue monitoring with periodic checks']
        : [
            '⚠️  Prompts below naturalness target',
            'Review system prompt for conversational language',
            'Check template variety in intents.ts',
            'Consider enabling humanizer pass (FEATURE_PROMPT_HUMANIZE=1)'
          ]
    };
    
    console.log(`[PROMPT_CANARY] Complete: ${pass ? 'PASS' : 'FAIL'} (avg: ${overallAvgScore.toFixed(3)})`);
    
    return new Response(JSON.stringify(summary, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error: any) {
    console.error('[PROMPT_CANARY] Error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error',
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

