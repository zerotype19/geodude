/**
 * Debug analysis data for audit aud_1760616884674_hmddpnay8
 */

const AUDIT_ID = 'aud_1760616884674_hmddpnay8';

export default {
  async fetch(request, env) {
    console.log(`[DebugAnalysis] Checking analysis data for audit ${AUDIT_ID}`);
    
    try {
      // Check audit_pages
      const pagesResult = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM audit_pages WHERE audit_id = ?'
      ).bind(AUDIT_ID).first();
      
      // Check audit_page_analysis
      const analysisResult = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM audit_page_analysis WHERE audit_id = ?'
      ).bind(AUDIT_ID).first();
      
      // Check a sample of pages
      const samplePages = await env.DB.prepare(
        'SELECT url, title, h1 FROM audit_pages WHERE audit_id = ? LIMIT 3'
      ).bind(AUDIT_ID).all();
      
      // Check a sample of analysis
      const sampleAnalysis = await env.DB.prepare(
        'SELECT url, title, h1, meta_description FROM audit_page_analysis WHERE audit_id = ? LIMIT 3'
      ).bind(AUDIT_ID).all();
      
      // Check if there's a mismatch in URLs
      const urlMismatch = await env.DB.prepare(`
        SELECT 
          ap.url as page_url,
          apa.url as analysis_url,
          CASE WHEN apa.url IS NULL THEN 'MISSING' ELSE 'FOUND' END as status
        FROM audit_pages ap
        LEFT JOIN audit_page_analysis apa ON ap.audit_id = apa.audit_id AND ap.url = apa.url
        WHERE ap.audit_id = ?
        LIMIT 5
      `).bind(AUDIT_ID).all();
      
      return new Response(JSON.stringify({
        ok: true,
        audit_id: AUDIT_ID,
        pages_count: pagesResult.count,
        analysis_count: analysisResult.count,
        sample_pages: samplePages.results,
        sample_analysis: sampleAnalysis.results,
        url_mismatch: urlMismatch.results
      }, null, 2), {
        headers: { 'content-type': 'application/json' }
      });
      
    } catch (error) {
      console.error('[DebugAnalysis] Error:', error);
      return new Response(JSON.stringify({ 
        ok: false, 
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }
};
