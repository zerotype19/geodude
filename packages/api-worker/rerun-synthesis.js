/**
 * Re-run synthesis phase for audit aud_1760616884674_hmddpnay8 to generate issues
 */

const AUDIT_ID = 'aud_1760616884674_hmddpnay8';

export default {
  async fetch(request, env) {
    console.log(`[RerunSynthesis] Re-running synthesis for audit ${AUDIT_ID}`);
    
    try {
      // Get audit details
      const audit = await env.DB.prepare(
        'SELECT * FROM audits WHERE id = ?'
      ).bind(AUDIT_ID).first();
      
      if (!audit) {
        return new Response(JSON.stringify({ 
          ok: false, 
          error: 'Audit not found' 
        }), {
          status: 404,
          headers: { 'content-type': 'application/json' }
        });
      }
      
      console.log('[RerunSynthesis] Audit found:', {
        id: audit.id,
        status: audit.status,
        domain: audit.domain
      });
      
      // Clear existing issues
      await env.DB.prepare(
        'DELETE FROM audit_issues WHERE audit_id = ?'
      ).bind(AUDIT_ID).run();
      
      console.log('[RerunSynthesis] Cleared existing issues');
      
      // Get analysis data
      const analysisData = await env.DB.prepare(`
        SELECT url, h1, h1_count, title, meta_description, canonical, robots_meta,
               schema_types, author, date_published, date_modified, images,
               headings_h2, headings_h3, outbound_links, word_count, eeat_flags
        FROM audit_page_analysis 
        WHERE audit_id = ?
      `).bind(AUDIT_ID).all();
      
      console.log(`[RerunSynthesis] Found ${analysisData.results?.length || 0} analyzed pages`);
      
      if (!analysisData.results || analysisData.results.length === 0) {
        return new Response(JSON.stringify({
          ok: false,
          message: 'No analysis data found',
          pages_count: 0
        }), {
          headers: { 'content-type': 'application/json' }
        });
      }
      
      // Generate issues
      const { generateIssuesFromAnalysis } = await import('./src/audit/issues-generator.js');
      const issues = generateIssuesFromAnalysis(analysisData.results, audit.domain);
      
      console.log(`[RerunSynthesis] Generated ${issues.length} issues`);
      
      // Save issues to database
      let savedCount = 0;
      for (const issue of issues) {
        await env.DB.prepare(
          `INSERT INTO audit_issues 
           (audit_id, page_url, issue_type, severity, message, details)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          AUDIT_ID,
          issue.page_url || null,
          issue.issue_type,
          issue.severity,
          issue.message,
          issue.details || null
        ).run();
        savedCount++;
      }
      
      console.log(`[RerunSynthesis] Saved ${savedCount} issues to database`);
      
      // Update issues_count in audits table
      await env.DB.prepare(
        'UPDATE audits SET issues_count = ? WHERE id = ?'
      ).bind(issues.length, AUDIT_ID).run();
      
      console.log(`[RerunSynthesis] Updated issues_count to ${issues.length}`);
      
      // Group issues by severity
      const issuesBySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
      for (const issue of issues) {
        issuesBySeverity[issue.severity]++;
      }
      
      return new Response(JSON.stringify({
        ok: true,
        message: 'Synthesis re-run completed successfully',
        audit_id: AUDIT_ID,
        pages_analyzed: analysisData.results.length,
        issues_generated: issues.length,
        issues_by_severity: issuesBySeverity,
        sample_issues: issues.slice(0, 5) // First 5 issues as sample
      }, null, 2), {
        headers: { 'content-type': 'application/json' }
      });
      
    } catch (error) {
      console.error('[RerunSynthesis] Error:', error);
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
