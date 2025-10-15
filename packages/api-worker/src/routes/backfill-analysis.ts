import { IRequest, Env } from '../types';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
};

export async function handleBackfillAnalysis(request: IRequest, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // POST /internal/audits/:id/backfill-analysis
  const backfillMatch = path.match(/^\/internal\/audits\/([^\/]+)\/backfill-analysis$/);
  if (backfillMatch && method === 'POST') {
    const auditId = backfillMatch[1];
    
    try {
      // Get pages that have HTML but no analysis
      const pages = await env.DB.prepare(`
        SELECT url, body_text FROM audit_pages
        WHERE audit_id=?1 AND body_text IS NOT NULL AND body_text <> ''
          AND NOT EXISTS (SELECT 1 FROM audit_page_analysis a
                          WHERE a.audit_id=?1 AND a.url = audit_pages.url)
        LIMIT 100
      `).bind(auditId).all();

      console.log(`[Backfill] Found ${pages.results.length} pages to analyze for audit ${auditId}`);

      let saved = 0;
      let failed = 0;

      for (const r of pages.results) {
        try {
          const { analyzeHtml } = await import('../analysis/html-analyzer');
          const { mapToDb } = await import('../analysis/map');
          const { saveAnalysisRow } = await import('../analysis/save-analysis');
          
          const parsed = analyzeHtml(r.body_text);
          const row = mapToDb(auditId, r.url, parsed);
          const res = await saveAnalysisRow(env, row);
          if (res.ok) saved++; else failed++;
        } catch (e: any) {
          failed++;
          console.error('BACKFILL_ERR', { url: r.url, error: (e?.message||String(e)).slice(0,300) });
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        message: `Backfill completed for audit ${auditId}`,
        analyzed: saved,
        failed,
        total_pages: pages.results.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error(`[Backfill] Error for audit ${auditId}:`, error);
      return new Response(JSON.stringify({ 
        error: 'Backfill failed', 
        message: error instanceof Error ? error.message : String(error) 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });
}
