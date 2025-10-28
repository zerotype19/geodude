#!/usr/bin/env node

/**
 * Test Geo-Selection Bypass Feature
 * 
 * This script tests the intelligent geo-selection bypass system
 * by triggering audits for sites known to have country selection pages.
 */

const testSites = [
  {
    name: 'Best Buy',
    url: 'https://www.bestbuy.com',
    expectedBypass: 'https://www.bestbuy.com/us',
    geoPageTitle: /select.*country/i,
    actualTitle: /best buy/i
  },
  {
    name: 'Nike',
    url: 'https://www.nike.com',
    expectedBypass: 'https://www.nike.com/us',
    geoPageTitle: /select.*country|location/i,
    actualTitle: /nike/i
  }
];

async function createAudit(url) {
  const response = await fetch('https://optiview-audit-worker.kevin-mcgovern.workers.dev/audits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      root_url: url,
      project_id: 'geo-bypass-test',
      max_pages: 10
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create audit: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

async function getAudit(auditId) {
  const response = await fetch(`https://optiview-audit-worker.kevin-mcgovern.workers.dev/audits/${auditId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get audit: ${response.status}`);
  }
  
  return await response.json();
}

async function waitForAudit(auditId, timeoutMs = 300000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const audit = await getAudit(auditId);
    
    console.log(`[${audit.status.toUpperCase()}] Pages: ${audit.pages_analyzed || 0}, Score: ${audit.composite_score || 'N/A'}`);
    
    if (audit.status === 'complete' || audit.status === 'completed') {
      return audit;
    }
    
    if (audit.status === 'failed') {
      throw new Error(`Audit failed: ${audit.fail_reason || 'Unknown reason'}`);
    }
    
    // Wait 5 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error('Audit timeout');
}

async function testSite(site) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${site.name}`);
  console.log(`URL: ${site.url}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Create audit
    console.log('Creating audit...');
    const createResult = await createAudit(site.url);
    const auditId = createResult.audit_id;
    console.log(`✅ Audit created: ${auditId}`);
    
    // Wait for completion
    console.log('Waiting for audit to complete...');
    const audit = await waitForAudit(auditId);
    
    console.log('\n📊 Audit Results:');
    console.log(`   Status: ${audit.status}`);
    console.log(`   Pages: ${audit.pages_analyzed}`);
    console.log(`   Score: ${audit.composite_score || audit.aeo_score || 'N/A'}`);
    
    // Check if we successfully bypassed
    if (audit.pages_analyzed >= 5 && (audit.composite_score || audit.aeo_score) > 50) {
      console.log(`\n✅ SUCCESS: Geo-selection bypass appears to have worked!`);
      console.log(`   - Multiple pages analyzed (${audit.pages_analyzed})`);
      console.log(`   - Reasonable score (${audit.composite_score || audit.aeo_score})`);
      console.log(`   - Likely got past country selector`);
      return true;
    } else {
      console.log(`\n⚠️  PARTIAL: Results may indicate geo-selection page was captured`);
      console.log(`   - Low pages: ${audit.pages_analyzed}`);
      console.log(`   - Low score: ${audit.composite_score || audit.aeo_score || 'N/A'}`);
      return false;
    }
    
  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🧪 Geo-Selection Bypass Test Suite');
  console.log('===================================\n');
  
  const results = [];
  
  for (const site of testSites) {
    const success = await testSite(site);
    results.push({ site: site.name, success });
  }
  
  console.log('\n\n📋 Test Summary');
  console.log('===============');
  results.forEach(({ site, success }) => {
    console.log(`${success ? '✅' : '❌'} ${site}`);
  });
  
  const passCount = results.filter(r => r.success).length;
  console.log(`\nPassed: ${passCount}/${results.length}`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSite, createAudit, getAudit, waitForAudit };

