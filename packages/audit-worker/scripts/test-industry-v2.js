/**
 * Manual Test Script for Industry V2 Classification
 * Tests 10 benchmark domains across different verticals
 */

const API_BASE = 'https://api.optiview.ai';

const BENCHMARK_DOMAINS = [
  { domain: 'cologuard.com', expected: 'health.diagnostics' },
  { domain: 'clevelandclinic.org', expected: 'health.providers' },
  { domain: 'chase.com', expected: 'finance.bank' },
  { domain: 'visa.com', expected: 'finance.network' },
  { domain: 'stripe.com', expected: 'finance.fintech' }, // or software.devtools acceptable
  { domain: 'nike.com', expected: 'retail' },
  { domain: 'etsy.com', expected: 'marketplace' },
  { domain: 'lexus.com', expected: 'automotive' },
  { domain: 'hilton.com', expected: 'travel.hospitality' },
  { domain: 'nytimes.com', expected: 'media.news' }
];

async function testDomain(domain, expected) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Testing: ${domain}`);
  console.log(`Expected industry: ${expected}`);
  
  try {
    const url = `${API_BASE}/api/llm/prompts?domain=${domain}&mode=blended&nocache=1&ttl=60`;
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`Detected industry: ${data.industry || 'N/A'}`);
    console.log(`Source: ${data.source || 'N/A'}`);
    console.log(`Template version: ${data.template_version || 'N/A'}`);
    console.log(`Realism score: ${data.realism_score || 'N/A'}`);
    console.log(`Branded queries: ${data.branded?.length || 0}`);
    console.log(`Non-branded queries: ${data.nonBranded?.length || 0}`);
    
    // Quality checks
    const quality = data.quality || {};
    console.log(`\nQuality:`);
    console.log(`  Leak rate: ${quality.leakRate || 0}`);
    console.log(`  Branded count: ${quality.brandedCount || 0}`);
    console.log(`  Non-branded count: ${quality.nonBrandedCount || 0}`);
    
    // Validation
    const industryMatch = data.industry === expected || 
      (domain === 'stripe.com' && ['finance.fintech', 'software.devtools'].includes(data.industry));
    const noLeaks = (quality.leakRate || 0) === 0;
    const goodCoverage = (quality.nonBrandedCount || 0) >= 8;
    
    const passed = industryMatch && noLeaks && goodCoverage;
    
    console.log(`\n${passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!industryMatch) console.log(`  ⚠️  Industry mismatch: expected ${expected}, got ${data.industry}`);
    if (!noLeaks) console.log(`  ⚠️  Brand leaks detected!`);
    if (!goodCoverage) console.log(`  ⚠️  Low non-branded coverage`);
    
    return {
      domain,
      expected,
      actual: data.industry,
      passed,
      data
    };
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return {
      domain,
      expected,
      passed: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('INDUSTRY V2 CLASSIFICATION TEST SUITE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const results = [];
  
  for (const { domain, expected } of BENCHMARK_DOMAINS) {
    const result = await testDomain(domain, expected);
    results.push(result);
    
    // Rate limit: wait 2 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);
  
  console.log(`\nResults: ${passed}/${total} (${percentage}%)`);
  console.log(`\nPassed:`);
  results.filter(r => r.passed).forEach(r => {
    console.log(`  ✅ ${r.domain} → ${r.actual}`);
  });
  
  if (results.some(r => !r.passed)) {
    console.log(`\nFailed:`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.domain} → expected ${r.expected}, got ${r.actual || 'ERROR'}`);
    });
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(passed === total ? '✅ ALL TESTS PASSED' : `⚠️  ${total - passed} TEST(S) FAILED`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run tests
runTests().catch(console.error);

