// Phase 5: Visibility Analytics API Routes
// Provides visibility scores, rankings, drift analysis, and GEO index endpoints

export interface Env {
  DB: D1Database;
  FEATURE_PHASE5_ANALYTICS?: string;
}

export function createVisibilityAnalyticsRoutes(env: Env) {
  return {
    async fetch(request: Request): Promise<Response> {
      // Check if Phase 5 analytics is enabled
      if (env.FEATURE_PHASE5_ANALYTICS !== 'true') {
        return new Response(JSON.stringify({ error: 'Phase 5 analytics not enabled' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const url = new URL(request.url);
      const path = url.pathname;
      
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };
      
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
      }
      
      try {
        // GET /api/visibility/score?domain=x&assistant=y&day=z
        if (path === '/api/visibility/score') {
          return await handleVisibilityScore(request, env, corsHeaders);
        }
        
        // GET /api/visibility/rankings?assistant=x&period=7d
        if (path === '/api/visibility/rankings') {
          return await handleVisibilityRankings(request, env, corsHeaders);
        }
        
        // GET /api/visibility/drift?domain=x&assistant=y
        if (path === '/api/visibility/drift') {
          return await handleVisibilityDrift(request, env, corsHeaders);
        }
        
        // GET /api/geo-index?domain=x
        if (path === '/api/geo-index') {
          return await handleGeoIndex(request, env, corsHeaders);
        }
        
        // GET /api/visibility/alerts?type=x&severity=y
        if (path === '/api/visibility/alerts') {
          return await handleAlerts(request, env, corsHeaders);
        }
        
        // POST /api/visibility/rollup?day=YYYY-MM-DD
        if (path === '/api/visibility/rollup') {
          return await handleRollup(request, env, corsHeaders);
        }
        
        // GET /api/visibility/citations/recent?projectId=x&limit=y
        if (path === '/api/visibility/citations/recent') {
          return await handleRecentCitations(request, env, corsHeaders);
        }
        
        // GET /api/health/visibility
        if (path === '/api/health/visibility') {
          return await handleHealthCheck(request, env, corsHeaders);
        }
        
        // GET /api/visibility/cost (admin)
        if (path === '/api/visibility/cost') {
          return await handleCostCheck(request, env, corsHeaders);
        }
        
        // GET /api/visibility/rankings/export?assistant=x&period=y&format=csv
        if (path === '/api/visibility/rankings/export') {
          return await handleRankingsExport(request, env, corsHeaders);
        }
        
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('[VisibilityAnalytics] Error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
  };
}

async function handleVisibilityScore(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');
  const assistant = url.searchParams.get('assistant') || 'all';
  const day = url.searchParams.get('day') || new Date().toISOString().split('T')[0];
  
  if (!domain) {
    return new Response(JSON.stringify({ error: 'Domain parameter required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Import VisibilityScorer dynamically
    const { VisibilityScorer } = await import('../services/visibility/visibility-scorer');
    const scorer = new VisibilityScorer(env);
    
    if (assistant === 'all') {
      // Get scores for all assistants
      const assistants = ['perplexity', 'chatgpt_search', 'claude'];
      const scores = [];
      
      for (const asst of assistants) {
        try {
          const score = await scorer.calculateVisibilityScore(domain, asst, day);
          scores.push({
            assistant: asst,
            ...score
          });
        } catch (error) {
          console.warn(`[VisibilityAnalytics] Error calculating score for ${asst}:`, error);
          scores.push({
            assistant: asst,
            score: 0,
            citationsCount: 0,
            uniqueDomainsCount: 0,
            recencyScore: 0,
            driftPct: 0
          });
        }
      }
      
    return new Response(JSON.stringify({ domain, day, scores }), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120' // 2 minute cache
      }
    });
    } else {
      // Get score for specific assistant
      const score = await scorer.calculateVisibilityScore(domain, assistant, day);
      
      return new Response(JSON.stringify({ domain, assistant, day, ...score }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('[VisibilityAnalytics] Error calculating visibility score:', error);
    return new Response(JSON.stringify({ error: 'Failed to calculate visibility score' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleVisibilityRankings(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const url = new URL(request.url);
  const assistant = url.searchParams.get('assistant') || 'all';
  const period = url.searchParams.get('period') || '7d';
  const limit = parseInt(url.searchParams.get('limit') || '50');
  
  try {
    let query: string;
    let params: any[];
    
    // Convert period to SQLite date modifier
    let dateModifier = '-7 days';
    if (period === '30d') {
      dateModifier = '-30 days';
    } else if (period === '7d') {
      dateModifier = '-7 days';
    }
    
    if (assistant === 'all') {
      query = `
        SELECT week_start, assistant, domain, domain_rank, mentions_count, share_pct, rank_change
        FROM ai_visibility_rankings 
        WHERE week_start >= date('now', '${dateModifier}')
        ORDER BY week_start DESC, assistant, domain_rank
        LIMIT ?
      `;
      params = [limit];
    } else {
      query = `
        SELECT week_start, assistant, domain, domain_rank, mentions_count, share_pct, rank_change
        FROM ai_visibility_rankings 
        WHERE assistant = ? 
          AND week_start >= date('now', '${dateModifier}')
        ORDER BY week_start DESC, domain_rank
        LIMIT ?
      `;
      params = [assistant, limit];
    }
    
    const result = await env.DB.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify({ 
      assistant, 
      period, 
      rankings: result.results || [] 
    }), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120' // 2 minute cache
      }
    });
  } catch (error) {
    console.error('[VisibilityAnalytics] Error fetching rankings:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch rankings' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleVisibilityDrift(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');
  const assistant = url.searchParams.get('assistant') || 'all';
  
  if (!domain) {
    return new Response(JSON.stringify({ error: 'Domain parameter required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    let query: string;
    let params: any[];
    
    if (assistant === 'all') {
      query = `
        SELECT assistant, day, score_0_100, drift_pct, citations_count
        FROM ai_visibility_scores 
        WHERE domain = ? 
          AND day >= date('now', '-30 days')
        ORDER BY day DESC, assistant
      `;
      params = [domain];
    } else {
      query = `
        SELECT assistant, day, score_0_100, drift_pct, citations_count
        FROM ai_visibility_scores 
        WHERE domain = ? 
          AND assistant = ?
          AND day >= date('now', '-30 days')
        ORDER BY day DESC
      `;
      params = [domain, assistant];
    }
    
    const result = await env.DB.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify({ 
      domain, 
      assistant, 
      driftData: result.results || [] 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[VisibilityAnalytics] Error fetching drift data:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch drift data' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleGeoIndex(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  
  if (!domain) {
    return new Response(JSON.stringify({ error: 'Domain parameter required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const query = `
      SELECT url, domain, assistants_seen, backlinks_ai, geo_index_score, 
             citations_count, content_quality_score, measured_at
      FROM ai_geo_index 
      WHERE domain = ?
      ORDER BY geo_index_score DESC, measured_at DESC
      LIMIT ?
    `;
    
    const result = await env.DB.prepare(query).bind(domain, limit).all();
    
    return new Response(JSON.stringify({ 
      domain, 
      geoIndexData: result.results || [] 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[VisibilityAnalytics] Error fetching GEO index:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch GEO index' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleAlerts(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const severity = url.searchParams.get('severity');
  const limit = parseInt(url.searchParams.get('limit') || '100');
  
  try {
    let query = `
      SELECT id, day, type, message, severity, domain, assistant, resolved, created_at
      FROM ai_alerts 
      WHERE day >= date('now', '-7 days')
    `;
    const params: any[] = [];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    if (severity) {
      query += ' AND severity = ?';
      params.push(severity);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    const result = await env.DB.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify({ 
      alerts: result.results || [],
      filters: { type, severity }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[VisibilityAnalytics] Error fetching alerts:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch alerts' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleRollup(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const url = new URL(request.url);
  const day = url.searchParams.get('day') || new Date().toISOString().split('T')[0];
  
  try {
    // Import RollupExecutor dynamically
    const { RollupExecutor } = await import('../services/visibility/rollup-executor');
    const executor = new RollupExecutor(env);
    
    // Execute rollup
    const result = await executor.executeDailyRollup(day);
    
    // Get status after rollup
    const status = await executor.getRollupStatus(day);
    
    return new Response(JSON.stringify({ 
      success: true,
      day,
      rollup: result,
      status
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[VisibilityAnalytics] Error during rollup:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Failed to execute rollup',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleRecentCitations(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const limit = parseInt(url.searchParams.get('limit') || '25');
  
  if (!projectId) {
    return new Response(JSON.stringify({ error: 'projectId parameter required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const query = `
      SELECT assistant, source_domain, source_url as url, occurred_at, source_type, title, snippet
      FROM ai_citations
      WHERE project_id = ?
      ORDER BY occurred_at DESC
      LIMIT ?
    `;
    
    const result = await env.DB.prepare(query).bind(projectId, limit).all();
    
    return new Response(JSON.stringify(result.results || []), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60' // 1 minute cache for recent data
      }
    });
  } catch (error) {
    console.error('[VisibilityAnalytics] Error fetching recent citations:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch recent citations' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleHealthCheck(request: Request, env: Env, corsHeaders: Record<string, string>) {
  try {
    // Get today's scores count
    const scoresResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM ai_visibility_scores WHERE day = date('now')
    `).first();

    // Get this week's rankings count
    const rankingsResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM ai_visibility_rankings 
      WHERE week_start >= date('now', '-7 days')
    `).first();

    // Get last rollup time
    const lastRollupResult = await env.DB.prepare(`
      SELECT MAX(created_at) as last_rollup FROM ai_visibility_scores
    `).first();

    // Get enabled assistants
    const assistantsResult = await env.DB.prepare(`
      SELECT DISTINCT assistant FROM ai_citations 
      WHERE occurred_at >= datetime('now', '-7 days') AND assistant IS NOT NULL
    `).all();

    const health = {
      status: 'healthy',
      scores_today: (scoresResult as any)?.count || 0,
      rankings_week_rows: (rankingsResult as any)?.count || 0,
      last_rollup_at: (lastRollupResult as any)?.last_rollup || null,
      assistants_enabled: assistantsResult.results?.map((r: any) => r.assistant) || [],
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(health), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60' // 1 minute cache
      }
    });
  } catch (error) {
    console.error('[VisibilityAnalytics] Error in health check:', error);
    return new Response(JSON.stringify({ 
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleCostCheck(request: Request, env: Env, corsHeaders: Record<string, string>) {
  try {
    // Get today's cost from KV
    const costData = await env.HEURISTICS.get('VIS_COST_DAILY');
    const cost = costData ? JSON.parse(costData) : {};

    // Get today's run counts by assistant
    const runsResult = await env.DB.prepare(`
      SELECT assistant, COUNT(*) as runs, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM assistant_runs 
      WHERE created_at >= date('now')
      GROUP BY assistant
    `).all();

    const costInfo = {
      daily_cost_usd: cost.total || 0,
      cost_by_assistant: cost.by_assistant || {},
      runs_today: runsResult.results || [],
      cost_cap_usd: 10, // From env
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(costInfo), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minute cache
      }
    });
  } catch (error) {
    console.error('[VisibilityAnalytics] Error in cost check:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch cost data',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleRankingsExport(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const url = new URL(request.url);
  const assistant = url.searchParams.get('assistant') || 'all';
  const period = url.searchParams.get('period') || '7d';
  const format = url.searchParams.get('format') || 'csv';
  const limit = parseInt(url.searchParams.get('limit') || '100');
  
  try {
    // Convert period to SQLite date modifier
    let dateModifier = '-7 days';
    if (period === '30d') {
      dateModifier = '-30 days';
    } else if (period === '7d') {
      dateModifier = '-7 days';
    }
    
    let query: string;
    let params: any[];
    
    if (assistant === 'all') {
      query = `
        SELECT week_start, assistant, domain, domain_rank, mentions_count, share_pct, rank_change
        FROM ai_visibility_rankings 
        WHERE week_start >= date('now', '${dateModifier}')
        ORDER BY week_start DESC, assistant, domain_rank
        LIMIT ?
      `;
      params = [limit];
    } else {
      query = `
        SELECT week_start, assistant, domain, domain_rank, mentions_count, share_pct, rank_change
        FROM ai_visibility_rankings 
        WHERE assistant = ? 
          AND week_start >= date('now', '${dateModifier}')
        ORDER BY week_start DESC, domain_rank
        LIMIT ?
      `;
      params = [assistant, limit];
    }
    
    const result = await env.DB.prepare(query).bind(...params).all();
    
    if (format === 'csv') {
      // Generate CSV
      const headers = ['Week', 'Assistant', 'Domain', 'Rank', 'Mentions', 'Share %', 'Rank Change'];
      const csvRows = [headers.join(',')];
      
      for (const row of result.results as any[]) {
        const csvRow = [
          row.week_start,
          row.assistant,
          `"${row.domain}"`, // Quote domains to handle commas
          row.domain_rank,
          row.mentions_count,
          row.share_pct?.toFixed(2) || '0.00',
          row.rank_change || '0'
        ];
        csvRows.push(csvRow.join(','));
      }
      
      const csvContent = csvRows.join('\n');
      const filename = `visibility-rankings-${assistant}-${period}-${new Date().toISOString().split('T')[0]}.csv`;
      
      return new Response(csvContent, {
        status: 200,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'public, max-age=120' // 2 minute cache
        }
      });
    } else {
      // Return JSON (fallback)
      return new Response(JSON.stringify({ 
        assistant, 
        period, 
        rankings: result.results || [] 
      }), {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=120' // 2 minute cache
        }
      });
    }
  } catch (error) {
    console.error('[VisibilityAnalytics] Error exporting rankings:', error);
    return new Response(JSON.stringify({ error: 'Failed to export rankings' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
