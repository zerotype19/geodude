/**
 * Live Test: Failproof AI Classifier System
 * Tests 5 brand new domains end-to-end
 */

const TEST_DOMAINS = [
  { domain: 'nordstrom.com', expected: 'retail', description: 'Department store' },
  { domain: 'delta.com', expected: 'travel.air', description: 'Airline' },
  { domain: 'marriott.com', expected: 'travel.hotels', description: 'Hotel chain' },
  { domain: 'wellsfargo.com', expected: 'finance.bank', description: 'Bank' },
  { domain: 'att.com', expected: 'telecom.wireless', description: 'Telecom' },
];

async function testDomain(domain, expected, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${domain} (${description})`);
  console.log(`Expected: ${expected}`);
  console.log('='.repeat(60));
  
  try {
    // Create audit
    console.log('\n[1/4] Creating audit...');
    const createResponse = await fetch('https://api.optiview.ai/api/audits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        project_id: 'test',
        root_url: `https://${domain}`,
        site_description: description,
        max_pages: 5
      })
    });
    
    if (!createResponse.ok) {
      console.error(`❌ Failed to create audit: ${createResponse.status}`);
      const text = await createResponse.text();
      console.error(text);
      return { success: false, reason: 'create_failed' };
    }
    
    const { audit_id } = await createResponse.json();
    console.log(`✅ Audit created: ${audit_id}`);
    console.log(`   URL: https://app.optiview.ai/audits/${audit_id}`);
    
    // Wait for processing
    console.log('\n[2/4] Waiting for audit to process (40s)...');
    await new Promise(resolve => setTimeout(resolve, 40000));
    
    // Fetch audit details
    console.log('\n[3/4] Fetching audit details...');
    const auditResponse = await fetch(`https://api.optiview.ai/api/audits/${audit_id}`, {
      credentials: 'include'
    });
    
    if (!auditResponse.ok) {
      console.error(`❌ Failed to fetch audit: ${auditResponse.status}`);
      return { success: false, reason: 'fetch_failed', audit_id };
    }
    
    const audit = await auditResponse.json();
    
    // Check classification
    console.log('\n[4/4] Verifying classification...');
    console.log(`   Industry: ${audit.industry || 'unknown'}`);
    console.log(`   Source: ${audit.industry_source || 'unknown'}`);
    console.log(`   Confidence: ${audit.industry_confidence || 'N/A'}`);
    console.log(`   Status: ${audit.status}`);
    console.log(`   Pages: ${audit.pages_count || 0}`);
    
    // Verify
    const classified = audit.industry || 'unknown';
    let result = {
      success: false,
      audit_id,
      classified,
      expected,
      source: audit.industry_source,
      confidence: audit.industry_confidence
    };
    
    if (classified === expected) {
      console.log(`\n✅ CORRECT: ${classified}`);
      result.success = true;
      result.match = 'exact';
    } else if (classified.startsWith(expected.split('.')[0])) {
      console.log(`\n⚠️  PARTIAL: ${classified} (expected: ${expected})`);
      result.success = true;
      result.match = 'partial';
    } else {
      console.log(`\n❌ WRONG: ${classified} (expected: ${expected})`);
      result.match = 'none';
    }
    
    // Check source
    if (audit.industry_source === 'ai_worker') {
      console.log(`✅ Used AI classifier`);
    } else if (audit.industry_source === 'domain_rules') {
      console.log(`ℹ️  Used whitelist (domain_rules)`);
    } else {
      console.log(`⚠️  Used fallback: ${audit.industry_source}`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function main() {
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║  FAILPROOF AI CLASSIFIER - LIVE END-TO-END TEST         ║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('\nTesting 5 brand new domains...\n');
  
  const results = [];
  
  for (const { domain, expected, description } of TEST_DOMAINS) {
    const result = await testDomain(domain, expected, description);
    results.push({ domain, ...result });
    
    // Wait between tests
    if (domain !== TEST_DOMAINS[TEST_DOMAINS.length - 1].domain) {
      console.log('\nWaiting 10s before next test...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const exact = results.filter(r => r.match === 'exact').length;
  const partial = results.filter(r => r.match === 'partial').length;
  const wrong = results.filter(r => r.match === 'none').length;
  const failed = results.filter(r => !r.success && !r.match).length;
  
  console.log(`\nResults:`);
  console.log(`  ✅ Exact matches: ${exact}/${TEST_DOMAINS.length}`);
  console.log(`  ⚠️  Partial matches: ${partial}/${TEST_DOMAINS.length}`);
  console.log(`  ❌ Wrong: ${wrong}/${TEST_DOMAINS.length}`);
  console.log(`  💥 Failed: ${failed}/${TEST_DOMAINS.length}`);
  
  console.log(`\nSources:`);
  const ai_count = results.filter(r => r.source === 'ai_worker').length;
  const whitelist_count = results.filter(r => r.source === 'domain_rules').length;
  const other_count = results.filter(r => r.source && r.source !== 'ai_worker' && r.source !== 'domain_rules').length;
  
  console.log(`  🤖 AI classifier: ${ai_count}/${results.length}`);
  console.log(`  📋 Whitelist: ${whitelist_count}/${results.length}`);
  console.log(`  🔧 Other: ${other_count}/${results.length}`);
  
  console.log(`\nAudit URLs:`);
  results.forEach(r => {
    if (r.audit_id) {
      console.log(`  ${r.domain}: https://app.optiview.ai/audits/${r.audit_id}`);
    }
  });
  
  console.log(`\nNext Steps:`);
  console.log(`  1. Check worker logs for [AI_CLASSIFY] messages`);
  console.log(`  2. Wait 5-10 min for citations cron to run`);
  console.log(`  3. Check citation prompts are human-sounding`);
  console.log(`  4. Verify prompts use correct industry context`);
  
  console.log('\n✨ Test complete!\n');
}

main().catch(console.error);

