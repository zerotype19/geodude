/**
 * Related Prompts API for Agent semantic domain discovery
 * GET /api/prompts/related?entity=cruise
 */

import { Env } from '../index';
import { getRelatedDomains } from '../prompt-cache';

export async function handleGetRelatedPrompts(env: Env, request: Request) {
  const u = new URL(request.url);
  const entity = u.searchParams.get('entity');
  const limitParam = u.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;
  
  if (!entity) {
    return new Response(JSON.stringify({ 
      error: 'Missing entity parameter',
      usage: '/api/prompts/related?entity=cruise&limit=20'
    }), { 
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  try {
    const related = await getRelatedDomains(env, entity, limit);
    
    return new Response(JSON.stringify({
      entity,
      count: related.length,
      domains: related
    }), {
      headers: { 
        'content-type': 'application/json',
        'cache-control': 'public, max-age=3600'
      }
    });
  } catch (error: any) {
    console.error('[PROMPTS_RELATED] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch related domains',
      message: error.message 
    }), { 
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}

