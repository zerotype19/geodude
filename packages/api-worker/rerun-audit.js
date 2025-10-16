/**
 * Re-run analysis and scoring for audit aud_1760616884674_hmddpnay8
 */

import { runSynthTick } from './src/audit/synth.js';
import { calculateScoresFromAnalysis } from './src/score.js';

const AUDIT_ID = 'aud_1760616884674_hmddpnay8';

export default {
  async fetch(request, env) {
    console.log(`[Rerun] Starting analysis and scoring for audit ${AUDIT_ID}`);
    
    try {
      // Step 1: Get audit details
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
      
      console.log('[Rerun] Audit found:', {
        id: audit.id,
        status: audit.status,
        phase: audit.phase,
        pages_crawled: audit.pages_crawled,
        pages_total: audit.pages_total,
        current_scores: {
          score_overall: audit.score_overall,
          score_crawlability: audit.score_crawlability,
          score_structured: audit.score_structured,
          score_answerability: audit.score_answerability,
          score_trust: audit.score_trust
        }
      });
      
      // Step 2: Get all pages
      const pages = await env.DB.prepare(
        'SELECT url, status_code, title, h1, body_text FROM audit_pages WHERE audit_id = ? ORDER BY fetched_at'
      ).bind(AUDIT_ID).all();
      
      console.log(`[Rerun] Found ${pages.results?.length || 0} pages in audit_pages`);
      
      // Step 3: Get analysis data
      const analysisData = await env.DB.prepare(
        'SELECT * FROM audit_page_analysis WHERE audit_id = ?'
      ).bind(AUDIT_ID).all();
      
      console.log(`[Rerun] Found ${analysisData.results?.length || 0} analyzed pages in audit_page_analysis`);
      
      // Step 4: Get issues
      const issues = await env.DB.prepare(
        'SELECT * FROM audit_issues WHERE audit_id = ?'
      ).bind(AUDIT_ID).all();
      
      console.log(`[Rerun] Found ${issues.results?.length || 0} issues in audit_issues`);
      
      // Step 5: Re-run synthesis if needed
      if ((analysisData.results?.length || 0) === 0) {
        console.log('[Rerun] No analysis data found, running synthesis...');
        const analysisComplete = await runSynthTick(env, AUDIT_ID);
        console.log('[Rerun] Analysis complete:', analysisComplete);
        
        if (analysisComplete) {
          // Re-fetch analysis data
          const newAnalysisData = await env.DB.prepare(
            'SELECT * FROM audit_page_analysis WHERE audit_id = ?'
          ).bind(AUDIT_ID).all();
          analysisData.results = newAnalysisData.results;
          console.log(`[Rerun] After synthesis: ${analysisData.results?.length || 0} analyzed pages`);
        }
      }
      
      // Step 6: Calculate correct scores
      if (analysisData.results && analysisData.results.length > 0) {
        console.log('[Rerun] Calculating correct scores from analysis data...');
        
        const structuredData = {
          siteFaqSchemaPresent: analysisData.results?.some((p) => p.schema_types?.includes('FAQPage')) || false,
          siteFaqPagePresent: analysisData.results?.some((p) => {
            const url = p.url.toLowerCase();
            const title = (p.title || '').toLowerCase();
            return url.includes('/faq') || title.includes('faq');
          }) || false,
          schemaTypes: analysisData.results?.map((p) => p.schema_types).filter(Boolean) || [],
        };
        
        console.log('[Rerun] Structured data:', structuredData);
        
        const scores = calculateScoresFromAnalysis(analysisData.results, issues.results || [], null, structuredData);
        
        console.log('[Rerun] Calculated scores:', scores);
        
        // Step 7: Update database with correct scores
        console.log('[Rerun] Updating database with correct scores...');
        
        // Get actual counts
        const pageCount = await env.DB.prepare(`SELECT COUNT(*) as count FROM audit_pages WHERE audit_id = ?`).bind(AUDIT_ID).first();
        const issueCount = await env.DB.prepare(`SELECT COUNT(*) as count FROM audit_issues WHERE audit_id = ?`).bind(AUDIT_ID).first();
        
        const actualPagesTotal = pageCount?.count || 0;
        const actualIssuesCount = issueCount?.count || 0;
        
        // Update audit with correct scores and counts
        await env.DB.prepare(`
          UPDATE audits 
          SET 
            score_overall = ?,
            score_crawlability = ?,
            score_structured = ?,
            score_answerability = ?,
            score_trust = ?,
            pages_total = ?,
            issues_count = ?,
            status = 'completed',
            completed_at = CURRENT_TIMESTAMP,
            phase_heartbeat_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(
          Math.round(scores.overall),
          Math.round((scores.crawlability / 42) * 100), // Convert to percentage
          Math.round((scores.structured / 30) * 100),   // Convert to percentage
          Math.round((scores.answerability / 20) * 100), // Convert to percentage
          Math.round((scores.trust / 10) * 100),        // Convert to percentage
          actualPagesTotal,
          actualIssuesCount,
          AUDIT_ID
        ).run();
        
        console.log('[Rerun] Database updated successfully');
        
        // Step 8: Verify the update
        const updatedAudit = await env.DB.prepare(
          'SELECT score_overall, score_crawlability, score_structured, score_answerability, score_trust, pages_total, issues_count FROM audits WHERE id = ?'
        ).bind(AUDIT_ID).first();
        
        return new Response(JSON.stringify({
          ok: true,
          message: 'Analysis and scoring completed successfully',
          audit: {
            id: AUDIT_ID,
            before: {
              score_overall: audit.score_overall,
              score_crawlability: audit.score_crawlability,
              score_structured: audit.score_structured,
              score_answerability: audit.score_answerability,
              score_trust: audit.score_trust,
              pages_total: audit.pages_total,
              issues_count: audit.issues_count
            },
            after: {
              score_overall: updatedAudit.score_overall,
              score_crawlability: updatedAudit.score_crawlability,
              score_structured: updatedAudit.score_structured,
              score_answerability: updatedAudit.score_answerability,
              score_trust: updatedAudit.score_trust,
              pages_total: updatedAudit.pages_total,
              issues_count: updatedAudit.issues_count
            },
            calculated_scores: scores,
            pages_analyzed: analysisData.results?.length || 0,
            issues_found: issues.results?.length || 0
          }
        }, null, 2), {
          headers: { 'content-type': 'application/json' }
        });
        
      } else {
        return new Response(JSON.stringify({
          ok: false,
          message: 'No analysis data available',
          pages_count: pages.results?.length || 0,
          analysis_count: analysisData.results?.length || 0
        }), {
          headers: { 'content-type': 'application/json' }
        });
      }
      
    } catch (error) {
      console.error('[Rerun] Error:', error);
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
