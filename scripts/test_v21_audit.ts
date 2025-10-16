#!/usr/bin/env tsx

/**
 * Test v2.1 on Specific Audit
 * 
 * Quick script to test v2.1 recompute/reanalyze on a specific audit ID
 * 
 * Usage: tsx scripts/test_v21_audit.ts <audit_id> [recompute|reanalyze]
 */

const API_BASE = 'https://geodude-api.kevin-mcgovern.workers.dev';

async function testRecompute(auditId: string) {
  console.log(`🔄 Testing recompute for audit ${auditId}...`);
  
  try {
    const response = await fetch(`${API_BASE}/v1/audits/${auditId}/recompute?model=v2.1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Recompute successful!');
    console.log(`📊 Scores:`, result.scores);
    console.log(`🏷️  Model version: ${result.model}`);
    
    return result;
  } catch (error) {
    console.error('❌ Recompute failed:', error);
    throw error;
  }
}

async function testReanalyze(auditId: string) {
  console.log(`🔍 Testing reanalyze for audit ${auditId}...`);
  
  try {
    const response = await fetch(`${API_BASE}/v1/audits/${auditId}/reanalyze?model=v2.1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Reanalyze successful!');
    console.log(`📊 Scores:`, result.scores);
    console.log(`📄 Pages analyzed: ${result.pages_analyzed}`);
    console.log(`🏷️  Model version: ${result.model}`);
    
    return result;
  } catch (error) {
    console.error('❌ Reanalyze failed:', error);
    throw error;
  }
}

async function getAuditInfo(auditId: string) {
  console.log(`📋 Fetching audit info for ${auditId}...`);
  
  try {
    const response = await fetch(`${API_BASE}/v1/audits/${auditId}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const audit = await response.json();
    console.log('📊 Current audit info:');
    console.log(`  Domain: ${audit.domain}`);
    console.log(`  Status: ${audit.status}`);
    console.log(`  Pages: ${audit.pages_crawled}/${audit.pages_total}`);
    console.log(`  Issues: ${audit.issues_count}`);
    console.log(`  Current scores:`, audit.scores);
    console.log(`  Model version: ${audit.scores?.score_model_version || 'v1.0'}`);
    
    return audit;
  } catch (error) {
    console.error('❌ Failed to fetch audit info:', error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const auditId = args[0];
  const mode = args[1] || 'recompute';

  if (!auditId) {
    console.error('❌ Usage: tsx scripts/test_v21_audit.ts <audit_id> [recompute|reanalyze]');
    process.exit(1);
  }

  if (!['recompute', 'reanalyze'].includes(mode)) {
    console.error('❌ Mode must be either "recompute" or "reanalyze"');
    process.exit(1);
  }

  console.log('🧪 v2.1 Test Script');
  console.log('==================');
  console.log(`Audit ID: ${auditId}`);
  console.log(`Mode: ${mode}`);
  console.log('');

  try {
    // First, get current audit info
    await getAuditInfo(auditId);
    console.log('');

    // Then run the test
    if (mode === 'recompute') {
      await testRecompute(auditId);
    } else {
      await testReanalyze(auditId);
    }

    console.log('');
    console.log('🎉 Test complete!');
    console.log('💡 Check the UI to see the updated audit with 5-card layout');

  } catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
