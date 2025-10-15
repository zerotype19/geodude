/**
 * Analysis API Routes
 * Provides schema/H1/E-E-A-T analysis data for audits
 */

export async function handleAnalysisRoutes(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // GET /v1/audits/:id/analysis/coverage
  const coverageMatch = path.match(/^\/v1\/audits\/([^\/]+)\/analysis\/coverage$/);
  if (coverageMatch && method === 'GET') {
    const auditId = coverageMatch[1];
    
    try {
      const coverage = await env.DB.prepare(`
        SELECT
          COUNT(*) AS pages,
          SUM(h1 IS NOT NULL AND h1!='') AS h1_ok,
          SUM(h1_count=1) AS single_h1,
          SUM(title IS NOT NULL AND title!='') AS title_ok,
          SUM(meta_description IS NOT NULL AND meta_description!='') AS meta_ok,
          SUM(schema_types LIKE '%Article%') AS schema_article,
          SUM(schema_types LIKE '%FAQPage%') AS schema_faq,
          SUM(schema_types LIKE '%Organization%') AS schema_organization,
          SUM(schema_types LIKE '%WebSite%') AS schema_website,
          SUM(eeat_flags LIKE '%HAS_AUTHOR%') AS has_author,
          SUM(eeat_flags LIKE '%HAS_DATES%') AS has_dates,
          SUM(eeat_flags LIKE '%HAS_MEDIA%') AS has_media,
          SUM(eeat_flags LIKE '%HAS_CITATIONS%') AS has_citations
        FROM audit_page_analysis
        WHERE audit_id=?1
      `).bind(auditId).first();

      return new Response(JSON.stringify(coverage), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch coverage data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // GET /v1/audits/:id/analysis/schema-gaps
  const schemaGapsMatch = path.match(/^\/v1\/audits\/([^\/]+)\/analysis\/schema-gaps$/);
  if (schemaGapsMatch && method === 'GET') {
    const auditId = schemaGapsMatch[1];
    
    try {
      const gaps = await env.DB.prepare(`
        SELECT schema_types, COUNT(*) c
        FROM audit_page_analysis
        WHERE audit_id=?1
        GROUP BY schema_types
        ORDER BY c DESC
        LIMIT 20
      `).bind(auditId).all();

      return new Response(JSON.stringify({ gaps: gaps.results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch schema gaps' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // GET /v1/audits/:id/analysis/problems
  const problemsMatch = path.match(/^\/v1\/audits\/([^\/]+)\/analysis\/problems$/);
  if (problemsMatch && method === 'GET') {
    const auditId = problemsMatch[1];
    
    try {
      const problems = await env.DB.prepare(`
        SELECT url, h1_count, h1, title, meta_description, schema_types, eeat_flags
        FROM audit_page_analysis
        WHERE audit_id=?1
          AND (h1_count!=1 OR title IS NULL OR meta_description IS NULL
               OR (eeat_flags NOT LIKE '%HAS_AUTHOR%')
               OR (schema_types IS NULL OR schema_types=''))
        ORDER BY h1_count DESC, CASE WHEN title IS NULL THEN 1 ELSE 0 END DESC
        LIMIT 100
      `).bind(auditId).all();

      // Add problem codes to each result
      const problemsWithCodes = problems.results.map((row: any) => {
        const problemCodes: string[] = [];
        
        if (row.h1_count === 0) problemCodes.push('NO_H1');
        if (row.h1_count > 1) problemCodes.push('MULTI_H1');
        if (!row.title) problemCodes.push('NO_TITLE');
        if (!row.meta_description) problemCodes.push('NO_META_DESC');
        if (!row.schema_types || row.schema_types === '') problemCodes.push('NO_SCHEMA');
        if (!row.eeat_flags || !row.eeat_flags.includes('HAS_AUTHOR')) problemCodes.push('NO_AUTHOR');
        if (!row.eeat_flags || !row.eeat_flags.includes('HAS_DATES')) problemCodes.push('NO_DATES');
        
        return {
          ...row,
          problem_codes: problemCodes
        };
      });

      return new Response(JSON.stringify({ problems: problemsWithCodes }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch problems' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // GET /v1/audits/:id/summary
  const summaryMatch = path.match(/^\/v1\/audits\/([^\/]+)\/summary$/);
  if (summaryMatch && method === 'GET') {
    const auditId = summaryMatch[1];
    
    try {
      // Get audit basic info
      const audit = await env.DB.prepare(`
        SELECT id, status, phase, phase_started_at, phase_heartbeat_at, started_at, completed_at,
               (SELECT COUNT(*) FROM audit_pages WHERE audit_id = audits.id) as pages_crawled,
               (SELECT COUNT(*) FROM audit_frontier WHERE audit_id = audits.id AND status = 'pending') as frontier_pending
        FROM audits WHERE id = ?1
      `).bind(auditId).first();

      if (!audit) {
        return new Response(JSON.stringify({ error: 'Audit not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get coverage stats
      const coverage = await env.DB.prepare(`
        SELECT
          COUNT(*) AS pages,
          SUM(h1 IS NOT NULL AND h1!='') AS h1_ok,
          SUM(h1_count=1) AS single_h1,
          SUM(title IS NOT NULL AND title!='') AS title_ok,
          SUM(meta_description IS NOT NULL AND meta_description!='') AS meta_ok,
          SUM(schema_types LIKE '%Article%') AS schema_article,
          SUM(schema_types LIKE '%Organization%') AS schema_organization,
          SUM(eeat_flags LIKE '%HAS_AUTHOR%') AS has_author,
          SUM(eeat_flags LIKE '%HAS_DATES%') AS has_dates
        FROM audit_page_analysis WHERE audit_id=?1
      `).bind(auditId).first();

      // Get top schema types
      const topSchemas = await env.DB.prepare(`
        SELECT schema_types, COUNT(*) c
        FROM audit_page_analysis
        WHERE audit_id=?1 AND schema_types IS NOT NULL AND schema_types != ''
        GROUP BY schema_types
        ORDER BY c DESC
        LIMIT 5
      `).bind(auditId).all();

      const summary = {
        audit: {
          id: audit.id,
          status: audit.status,
          phase: audit.phase,
          phase_started_at: audit.phase_started_at,
          phase_heartbeat_at: audit.phase_heartbeat_at,
          started_at: audit.started_at,
          completed_at: audit.completed_at,
          pages_crawled: audit.pages_crawled,
          frontier_pending: audit.frontier_pending
        },
        coverage: {
          pages: coverage?.pages || 0,
          h1_coverage: coverage?.pages ? Math.round((coverage.h1_ok / coverage.pages) * 100) : 0,
          title_coverage: coverage?.pages ? Math.round((coverage.title_ok / coverage.pages) * 100) : 0,
          meta_coverage: coverage?.pages ? Math.round((coverage.meta_ok / coverage.pages) * 100) : 0,
          schema_article: coverage?.schema_article || 0,
          schema_organization: coverage?.schema_organization || 0,
          has_author: coverage?.has_author || 0,
          has_dates: coverage?.has_dates || 0
        },
        top_schema_types: (topSchemas?.results || []).map((row: any) => ({
          types: row.schema_types,
          count: row.c
        }))
      };

      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch summary' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // GET /v1/audits/:id/analysis/pages
  const analysisPagesMatch = path.match(/^\/v1\/audits\/([^\/]+)\/analysis\/pages$/);
  if (analysisPagesMatch && method === 'GET') {
    const auditId = analysisPagesMatch[1];
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    try {
      const pages = await env.DB.prepare(`
        SELECT url, h1, h1_count, title, meta_description, canonical, robots_meta,
               schema_types, author, date_published, date_modified, images,
               headings_h2, headings_h3, outbound_links, word_count, eeat_flags
        FROM audit_page_analysis
        WHERE audit_id=?1
        ORDER BY analyzed_at DESC
        LIMIT ?2 OFFSET ?3
      `).bind(auditId, limit, offset).all();

      const total = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM audit_page_analysis WHERE audit_id=?1
      `).bind(auditId).first();

      return new Response(JSON.stringify({
        results: pages.results,
        pagination: {
          page,
          limit,
          total: total?.count || 0,
          pages: Math.ceil((total?.count || 0) / limit)
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch analysis pages' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Not Found', { status: 404, headers: corsHeaders });
}
