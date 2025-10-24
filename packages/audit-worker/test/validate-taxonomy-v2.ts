/**
 * Taxonomy V2 Validation Test
 * 
 * Tests hierarchical taxonomy and cascading template resolution
 */

import { resolveTemplates, getTemplatesWithMetadata, isAppropriateForIndustry } from '../src/prompts/templateResolver';
import { mapLegacyToV2 } from '../src/config/industry-taxonomy-v2';

interface TestCase {
  domain: string;
  legacyIndustry: string;
  expectedV2Slug: string;
  expectedBrandedCount: number; // Min expected
  shouldHaveKeywords: string[];
  shouldNotHaveKeywords: string[];
}

const TEST_CASES: TestCase[] = [
  // ==================== HEALTH ====================
  {
    domain: 'pfizer.com',
    legacyIndustry: 'pharmaceutical',
    expectedV2Slug: 'health.pharma.brand',
    expectedBrandedCount: 15, // 11 pharma-specific + 5 health-generic
    shouldHaveKeywords: ['side effects', 'fda', 'prescription', 'drug', 'patient assistance'],
    shouldNotHaveKeywords: ['emergency room', 'appointment', 'find a doctor']
  },
  {
    domain: 'mayoclinic.org',
    legacyIndustry: 'healthcare_provider',
    expectedV2Slug: 'health.providers',
    expectedBrandedCount: 14, // 10 provider-specific + 5 health-generic (minus 1 duplicate "contact")
    shouldHaveKeywords: ['find a doctor', 'appointment', 'patient portal', 'insurance'],
    shouldNotHaveKeywords: ['side effects', 'fda approval', 'prescription drug']
  },
  {
    domain: 'walgreens.com',
    legacyIndustry: 'pharmacy',
    expectedV2Slug: 'health.pharmacy',
    expectedBrandedCount: 5, // Falls back to health.* templates
    shouldHaveKeywords: ['insurance', 'services', 'locations'],
    shouldNotHaveKeywords: []
  },
  
  // ==================== SOFTWARE ====================
  {
    domain: 'salesforce.com',
    legacyIndustry: 'saas_b2b',
    expectedV2Slug: 'software.cdp_crm',
    expectedBrandedCount: 19, // 7 CRM + 8 SaaS + 6 software - duplicates
    shouldHaveKeywords: ['crm', 'sales', 'integration', 'pricing', 'api'],
    shouldNotHaveKeywords: []
  },
  {
    domain: 'github.com',
    legacyIndustry: 'saas_b2b',
    expectedV2Slug: 'software.saas',
    expectedBrandedCount: 14, // 8 SaaS + 6 software
    shouldHaveKeywords: ['pricing', 'integration', 'api', 'security'],
    shouldNotHaveKeywords: []
  },
  
  // ==================== AUTOMOTIVE ====================
  {
    domain: 'toyota.com',
    legacyIndustry: 'automotive_oem',
    expectedV2Slug: 'automotive.oem',
    expectedBrandedCount: 15, // 9 OEM + 6 automotive
    shouldHaveKeywords: ['specs', 'mpg', 'safety', 'trim', 'warranty'],
    shouldNotHaveKeywords: []
  },
  
  // ==================== GENERIC FALLBACK ====================
  {
    domain: 'example.com',
    legacyIndustry: 'unknown',
    expectedV2Slug: 'unknown',
    expectedBrandedCount: 8, // Falls back to generic_consumer
    shouldHaveKeywords: ['reviews', 'pricing', 'worth it'],
    shouldNotHaveKeywords: []
  }
];

/**
 * Run validation tests
 */
function runTests() {
  console.log('🧪 Taxonomy V2 Validation Test\n');
  console.log('═'.repeat(100));
  console.log('');
  
  let passed = 0;
  let failed = 0;
  const results: Array<{test: string; status: 'PASS' | 'FAIL'; details: string}> = [];
  
  for (const testCase of TEST_CASES) {
    console.log(`\n📋 Testing: ${testCase.domain} (${testCase.legacyIndustry})`);
    console.log('─'.repeat(100));
    
    // Test 1: Legacy → V2 mapping
    const mappedSlug = mapLegacyToV2(testCase.legacyIndustry);
    const slugMatch = mappedSlug === testCase.expectedV2Slug;
    console.log(`  ✓ Slug mapping: ${testCase.legacyIndustry} → ${mappedSlug} ${slugMatch ? '✅' : '❌ Expected: ' + testCase.expectedV2Slug}`);
    if (!slugMatch) {
      results.push({
        test: `${testCase.domain} - Slug mapping`,
        status: 'FAIL',
        details: `Expected ${testCase.expectedV2Slug}, got ${mappedSlug}`
      });
      failed++;
      continue;
    }
    
    // Test 2: Template resolution
    const metadata = getTemplatesWithMetadata(mappedSlug);
    console.log(`  ✓ Templates resolved: ${metadata.branded.length} branded, ${metadata.nonBranded.length} non-branded`);
    console.log(`  ✓ Cascade path: ${metadata.ancestors.join(' → ')}`);
    
    const countMatch = metadata.branded.length >= testCase.expectedBrandedCount;
    console.log(`  ${countMatch ? '✅' : '❌'} Branded count: ${metadata.branded.length} (expected ≥${testCase.expectedBrandedCount})`);
    if (!countMatch) {
      results.push({
        test: `${testCase.domain} - Template count`,
        status: 'FAIL',
        details: `Expected ≥${testCase.expectedBrandedCount}, got ${metadata.branded.length}`
      });
      failed++;
      continue;
    }
    
    // Test 3: Keyword presence
    const allTemplates = [...metadata.branded, ...metadata.nonBranded].join(' ').toLowerCase();
    let keywordMatch = true;
    for (const keyword of testCase.shouldHaveKeywords) {
      if (!allTemplates.includes(keyword.toLowerCase())) {
        console.log(`  ❌ Missing expected keyword: "${keyword}"`);
        keywordMatch = false;
      }
    }
    for (const keyword of testCase.shouldNotHaveKeywords) {
      if (allTemplates.includes(keyword.toLowerCase())) {
        console.log(`  ❌ Found forbidden keyword: "${keyword}"`);
        keywordMatch = false;
      }
    }
    if (keywordMatch) {
      console.log(`  ✅ Keyword validation passed`);
    } else {
      results.push({
        test: `${testCase.domain} - Keyword validation`,
        status: 'FAIL',
        details: 'Missing or forbidden keywords detected'
      });
      failed++;
      continue;
    }
    
    // Test 4: Anti-keyword filtering
    if (testCase.shouldNotHaveKeywords.length > 0) {
      let filterPass = true;
      for (const badKeyword of testCase.shouldNotHaveKeywords) {
        const testQuery = `How to ${badKeyword} at ${testCase.domain}`;
        const isAppropriate = isAppropriateForIndustry(testQuery, mappedSlug);
        if (isAppropriate) {
          console.log(`  ❌ Anti-keyword filter failed: "${testQuery}" was not rejected`);
          filterPass = false;
        }
      }
      if (filterPass && testCase.shouldNotHaveKeywords.length > 0) {
        console.log(`  ✅ Anti-keyword filter working`);
      }
    }
    
    // Test passed
    results.push({
      test: `${testCase.domain} - All checks`,
      status: 'PASS',
      details: `${metadata.branded.length} branded templates from ${metadata.ancestors.length} levels`
    });
    passed++;
    
    // Show sample templates
    console.log(`\n  📝 Sample Branded Templates (first 5):`);
    for (const template of metadata.branded.slice(0, 5)) {
      console.log(`     • ${template}`);
    }
  }
  
  // Summary
  console.log('\n\n');
  console.log('═'.repeat(100));
  console.log('📊 Test Summary');
  console.log('═'.repeat(100));
  console.log(`Total Tests:   ${TEST_CASES.length}`);
  console.log(`✅ Passed:      ${passed}`);
  console.log(`❌ Failed:      ${failed}`);
  console.log(`📈 Success Rate: ${((passed / TEST_CASES.length) * 100).toFixed(1)}%`);
  console.log('');
  
  // Show failures
  if (failed > 0) {
    console.log('❌ Failed Tests:\n');
    for (const result of results.filter(r => r.status === 'FAIL')) {
      console.log(`  • ${result.test}`);
      console.log(`    ${result.details}`);
      console.log('');
    }
  }
  
  // Comparison table
  console.log('\n📋 Template Count Comparison:\n');
  console.log('Domain'.padEnd(25) + 'V2 Slug'.padEnd(30) + 'Branded'.padEnd(12) + 'Non-Branded'.padEnd(15) + 'Total');
  console.log('─'.repeat(100));
  for (const testCase of TEST_CASES) {
    const slug = mapLegacyToV2(testCase.legacyIndustry);
    const metadata = getTemplatesWithMetadata(slug);
    console.log(
      testCase.domain.padEnd(25) +
      slug.padEnd(30) +
      metadata.branded.length.toString().padEnd(12) +
      metadata.nonBranded.length.toString().padEnd(15) +
      metadata.total.toString()
    );
  }
  console.log('');
  
  // Exit with appropriate code
  console.log('═'.repeat(100));
  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Taxonomy V2 is ready for full implementation.\n');
  } else {
    console.log(`⚠️  ${failed} test(s) failed. Review and fix before proceeding.\n`);
  }
  console.log('═'.repeat(100));
  console.log('');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests();

