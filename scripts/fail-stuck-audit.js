/**
 * Script to manually fail a stuck audit
 */

const AUDIT_ID = 'aud_1760302641921_h60pmvnl8';

async function failStuckAudit() {
  try {
    // Call the API to get the current audit status
    const response = await fetch(`https://api.optiview.ai/v1/audits/${AUDIT_ID}`);
    const audit = await response.json();
    
    console.log('Current audit status:', audit.status);
    console.log('Started at:', audit.started_at);
    console.log('Pages crawled:', audit.pages_crawled);
    console.log('Pages total:', audit.pages_total);
    
    if (audit.status === 'running') {
      console.log('Audit is stuck, attempting to fail it...');
      
      // We need to call the backend directly to fail the audit
      // Since there's no direct endpoint, we'll need to use the database update
      console.log('Please run this SQL command in the database:');
      console.log(`UPDATE audits SET status = 'failed', error = 'Manual intervention - audit was stuck', completed_at = datetime('now') WHERE id = '${AUDIT_ID}';`);
      
    } else {
      console.log('Audit is not running, current status:', audit.status);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

failStuckAudit();
