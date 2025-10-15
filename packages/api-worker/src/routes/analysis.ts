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

      return new Response(JSON.stringify({ problems: problems.results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch problems' }), {
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
