/**
 * Backfill Analysis Script
 * Run HTML analysis pipeline for completed audits with NULL scores
 */

async function backfillAnalysis() {
  const auditId = 'aud_1760587414372_tv4p3gab4';
  
  console.log(`[Backfill] Starting analysis for audit ${auditId}`);
  
  try {
    // Step 1: Run synthesis (HTML analysis)
    console.log(`[Backfill] Running synthesis...`);
    const synthResponse = await fetch(`https://api.optiview.ai/v1/audits/${auditId}/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`[Backfill] Synth response:`, await synthResponse.text());
    
    // Step 2: Wait and check status
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const statusResponse = await fetch(`https://api.optiview.ai/v1/audits/${auditId}`);
    const status = await statusResponse.json();
    
    console.log(`[Backfill] Current status:`, {
      status: status.status,
      phase: status.phase,
      score_overall: status.score_overall,
      score_crawl: status.score_crawl,
      score_struct: status.score_struct,
      score_answer: status.score_answer,
      score_trust: status.score_trust
    });
    
  } catch (error) {
    console.error(`[Backfill] Error:`, error);
  }
}

// Run the backfill
backfillAnalysis();
