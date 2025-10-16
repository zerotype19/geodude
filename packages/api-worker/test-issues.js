/**
 * Test issues generation for audit aud_1760616884674_hmddpnay8
 */

import { generateIssuesFromAnalysis } from './src/audit/issues-generator.js';

const AUDIT_ID = 'aud_1760616884674_hmddpnay8';

export default {
  async fetch(request, env) {
    console.log(`[TestIssues] Testing issues generation for audit ${AUDIT_ID}`);
    
    try {
      // Get analysis data from audit_page_analysis table
      const analysisData = await env.DB.prepare(`
        SELECT url, h1, h1_count, title, meta_description, canonical, robots_meta,
               schema_types, author, date_published, date_modified, images,
               headings_h2, headings_h3, outbound_links, word_count, eeat_flags
        FROM audit_page_analysis 
        WHERE audit_id = ?
      `).bind(AUDIT_ID).all();
      
      console.log(`[TestIssues] Found ${analysisData.results?.length || 0} analyzed pages`);
      
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
      const issues = generateIssuesFromAnalysis(analysisData.results, 'apple.com');
      console.log(`[TestIssues] Generated ${issues.length} issues`);
      
      // Group issues by type and severity
      const issuesByType = {};
      const issuesBySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
      
      for (const issue of issues) {
        if (!issuesByType[issue.issue_type]) {
          issuesByType[issue.issue_type] = [];
        }
        issuesByType[issue.issue_type].push(issue);
        issuesBySeverity[issue.severity]++;
      }
      
      return new Response(JSON.stringify({
        ok: true,
        message: 'Issues generation test completed',
        audit_id: AUDIT_ID,
        pages_analyzed: analysisData.results.length,
        total_issues: issues.length,
        issues_by_type: issuesByType,
        issues_by_severity: issuesBySeverity,
        sample_issues: issues.slice(0, 10) // First 10 issues as sample
      }, null, 2), {
        headers: { 'content-type': 'application/json' }
      });
      
    } catch (error) {
      console.error('[TestIssues] Error:', error);
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
