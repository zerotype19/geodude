/**
 * Backfill All Completed Audits - Run analysis and scoring for audits with NULL scores
 */

async function backfillAllAudits() {
  console.log('[Backfill] Starting backfill for all completed audits with NULL scores...');
  
  // List of completed audits with NULL scores (from the database table)
  const auditIds = [
    'aud_1760580449427_7r3dylxqv',
    'aud_1760580764638_l3e0h1lr4', 
    'aud_1760580957204_a15wksfoz',
    'aud_1760581342330_uygpel1be',
    'aud_1760581521529_verux95go',
    'aud_1760581915557_z5scbu1wy',
    'aud_1760582255628_9xd54fbht',
    'aud_1760582532813_hchrr75t6',
    'aud_1760583784441_x1yy38k4z',
    'aud_1760584009129_b2ykwlva6',
    'aud_1760587414372_tv4p3gab4',
    'aud_1760587414372_tv4p3gab4' // Our test audit
  ];
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const auditId of auditIds) {
    try {
      console.log(`[Backfill] Processing audit ${auditId}...`);
      
      // Step 1: Check current status
      const statusResponse = await fetch(`https://api.optiview.ai/v1/audits/${auditId}`);
      const status = await statusResponse.json();
      
      console.log(`[Backfill] Current status for ${auditId}:`, {
        status: status.status,
        phase: status.phase,
        pages_crawled: status.pages_crawled,
        score_overall: status.score_overall
      });
      
      // Step 2: Manually trigger analysis by calling the synth phase
      console.log(`[Backfill] Triggering analysis for ${auditId}...`);
      
      // We need to manually call the analysis pipeline
      // Since these audits are already completed, we'll trigger them to run the synth phase
      const continueResponse = await fetch(`https://api.optiview.ai/v1/audits/${auditId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const continueResult = await continueResponse.text();
      console.log(`[Backfill] Continue response for ${auditId}:`, continueResult);
      
      // Step 3: Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 4: Check if scores were generated
      const finalResponse = await fetch(`https://api.optiview.ai/v1/audits/${auditId}`);
      const finalStatus = await finalResponse.json();
      
      if (finalStatus.score_overall !== null && finalStatus.score_overall !== undefined) {
        console.log(`[Backfill] ✅ SUCCESS: ${auditId} now has scores:`, {
          score_overall: finalStatus.score_overall,
          score_crawl: finalStatus.score_crawl,
          score_struct: finalStatus.score_struct,
          score_answer: finalStatus.score_answer,
          score_trust: finalStatus.score_trust
        });
        successCount++;
      } else {
        console.log(`[Backfill] ⚠️  ${auditId} still has NULL scores - may need manual intervention`);
        errorCount++;
      }
      
      // Wait between audits to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error(`[Backfill] ❌ ERROR processing ${auditId}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`[Backfill] SUMMARY: ${successCount} successful, ${errorCount} errors`);
}

// Run the backfill
backfillAllAudits().catch(console.error);
