/**
 * Rerun all failed audits to trigger new industry classification and scorecard V2
 */

const API_BASE = 'https://api.optiview.ai';

async function getFailedAudits() {
  console.log('📊 Fetching failed audits from D1...\n');
  
  const response = await fetch(`${API_BASE}/api/audits?status=failed&limit=1000`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch audits: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.audits || [];
}

async function rerunAudit(audit) {
  console.log(`🔄 Rerunning: ${audit.root_url} (${audit.id})`);
  
  const requestBody = {
    project_id: audit.project_id || 'default',
    root_url: audit.root_url,
    max_pages: 100
  };
  
  // Include site_description if it exists
  if (audit.site_description) {
    requestBody.site_description = audit.site_description;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/audits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`   ❌ Failed: ${response.status} - ${error}`);
      return { success: false, audit_id: audit.id, error: `${response.status}: ${error}` };
    }
    
    const result = await response.json();
    const newAuditId = result.audit_id || result.id;
    console.log(`   ✅ New audit started: ${newAuditId}`);
    
    return { success: true, audit_id: audit.id, new_audit_id: newAuditId };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, audit_id: audit.id, error: error.message };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                      ║');
  console.log('║       🔄 RERUNNING ALL FAILED AUDITS 🔄                             ║');
  console.log('║                                                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Get all failed audits
    const failedAudits = await getFailedAudits();
    
    if (failedAudits.length === 0) {
      console.log('✅ No failed audits found!\n');
      return;
    }
    
    console.log(`📋 Found ${failedAudits.length} failed audits\n`);
    console.log('─────────────────────────────────────────────────────────────────────\n');
    
    // Process each audit with a delay to avoid overwhelming the API
    const results = [];
    for (let i = 0; i < failedAudits.length; i++) {
      const audit = failedAudits[i];
      console.log(`[${i + 1}/${failedAudits.length}]`);
      
      const result = await rerunAudit(audit);
      results.push(result);
      
      // Wait 2 seconds between requests to avoid rate limiting
      if (i < failedAudits.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      console.log('');
    }
    
    // Summary
    console.log('═════════════════════════════════════════════════════════════════════');
    console.log('\n📊 SUMMARY\n');
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Successfully rerun: ${successful}`);
    console.log(`❌ Failed to rerun: ${failed}`);
    
    if (successful > 0) {
      console.log('\n🎯 NEW AUDITS STARTED:\n');
      results.filter(r => r.success).forEach((r, i) => {
        console.log(`${i + 1}. Old: ${r.audit_id} → New: ${r.new_audit_id}`);
        console.log(`   View: https://app.optiview.ai/audits/${r.new_audit_id}`);
      });
    }
    
    if (failed > 0) {
      console.log('\n❌ FAILED TO RERUN:\n');
      results.filter(r => !r.success).forEach((r, i) => {
        console.log(`${i + 1}. Audit ${r.audit_id}: ${r.error}`);
      });
    }
    
    console.log('\n═════════════════════════════════════════════════════════════════════');
    console.log('\n✨ All failed audits have been processed!');
    console.log('\n💡 TIP: Wait a few minutes for the new audits to complete, then check');
    console.log('   them to see the new industry classification and Scorecard V2 UI!\n');
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
