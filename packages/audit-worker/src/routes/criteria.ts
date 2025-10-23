/**
 * Scoring Criteria API Routes
 * 
 * Endpoints to manage and query scoring criteria
 */

import { 
  getAllCriteria, 
  getCriteriaByScope, 
  getCriteriaByCategory,
  getCriterionById,
  getCriteriaStats,
  getProductionCriteria
} from '../lib/scoringCriteriaDB';

export interface Env {
  DB: D1Database;
}

// Helper to get CORS headers with proper origin (no wildcard when credentials are used)
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || 'https://app.optiview.ai';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true'
  };
}

/**
 * GET /api/scoring/criteria
 * Get all enabled scoring criteria
 * 
 * Query params:
 * - scope: filter by page|site
 * - category: filter by category name
 * - productionOnly: if true, exclude preview checks
 */
export async function handleGetCriteria(req: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get('scope') as 'page' | 'site' | null;
    const category = url.searchParams.get('category');
    const productionOnly = url.searchParams.get('productionOnly') === 'true';
    
    let criteria;
    
    if (productionOnly) {
      criteria = await getProductionCriteria(env.DB);
    } else if (scope) {
      criteria = await getCriteriaByScope(env.DB, scope);
    } else if (category) {
      criteria = await getCriteriaByCategory(env.DB, category);
    } else {
      criteria = await getAllCriteria(env.DB);
    }
    
    const corsHeaders = getCorsHeaders(req);
    return new Response(JSON.stringify(criteria, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Criteria API] Error:', error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(JSON.stringify({
      error: 'Failed to fetch criteria',
      message: (error as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/scoring/criteria/stats
 * Get statistics about scoring criteria
 */
export async function handleGetCriteriaStats(req: Request, env: Env): Promise<Response> {
  try {
    const stats = await getCriteriaStats(env.DB);
    
    const corsHeaders = getCorsHeaders(req);
    return new Response(JSON.stringify(stats, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Criteria Stats API] Error:', error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(JSON.stringify({
      error: 'Failed to fetch criteria stats',
      message: (error as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/scoring/criteria/:id
 * Get single criterion by ID
 */
export async function handleGetCriterionById(
  req: Request, 
  env: Env, 
  id: string
): Promise<Response> {
  try {
    const criterion = await getCriterionById(env.DB, id);
    
    const corsHeaders = getCorsHeaders(req);
    if (!criterion) {
      return new Response(JSON.stringify({
        error: 'Criterion not found',
        id
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(criterion, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Criterion API] Error:', error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(JSON.stringify({
      error: 'Failed to fetch criterion',
      message: (error as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

