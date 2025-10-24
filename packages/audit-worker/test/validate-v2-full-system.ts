/**
 * Full System V2 Validation Test
 * Tests 50 random domains with V2 hierarchical taxonomy
 */

import { getDomainRules } from '../src/config/loader';
import { mapLegacyToV2 } from '../src/config/industry-taxonomy-v2';
import { getTemplatesWithMetadata } from '../src/prompts/templateResolver';

interface TestResult {
  domain: string;
  v2Slug: string;
  v2Name: string;
  templateCount: { branded: number; nonBranded: number; total: number };
  ancestors: string[];
  samplePrompts: { branded: string[]; nonBranded: string[] };
  status: 'PASS' | 'FAIL';
  issues: string[];
}

function selectRandomDomains(count: number): string[] {
  const allDomains = Object.keys(getDomainRules());
  const shuffled = allDomains.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function testDomain(domain: string): TestResult {
  const issues: string[] = [];
  const domainRules = getDomainRules();
  const industryKey = domainRules[domain];
  const isV2 = industryKey.includes('.');
  const v2Slug = isV2 ? industryKey : mapLegacyToV2(industryKey);
  const metadata = getTemplatesWithMetadata(v2Slug);
  const brandName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
  
  const sampleBranded = metadata.branded.slice(0, 5).map(t => 
    t.replace('{brand}', brandName).replace('{competitor}', 'Competitor')
  );
  const sampleNonBranded = metadata.nonBranded.slice(0, 5).map(t => 
    t.replace('{category}', metadata.name.toLowerCase())
  );
  
  if (metadata.branded.length === 0) issues.push('No branded templates');
  if (metadata.nonBranded.length === 0) issues.push('No non-branded templates');
  if (metadata.ancestors.length === 0 && v2Slug !== 'unknown' && v2Slug !== 'generic_consumer') {
    issues.push('No cascading ancestry');
  }
  
  for (const query of sampleNonBranded) {
    if (query.toLowerCase().includes(brandName.toLowerCase())) {
      issues.push(`Brand leak: "${query}"`);
    }
  }
  
  return {
    domain, v2Slug, v2Name: metadata.name,
    templateCount: { branded: metadata.branded.length, nonBranded: metadata.nonBranded.length, total: metadata.total },
    ancestors: metadata.ancestors, samplePrompts: { branded: sampleBranded, nonBranded: sampleNonBranded },
    status: issues.length === 0 ? 'PASS' : 'FAIL', issues
  };
}

function runValidation() {
  console.log('[TEST] Full System V2 Validation - 50 Random Domains\n');
  console.log('='.repeat(120) + '\n');
  
  const domains = selectRandomDomains(50);
  const results: TestResult[] = [];
  
  for (const domain of domains) {
    const result = testDomain(domain);
    results.push(result);
    const status = result.status === 'PASS' ? '[PASS]' : '[FAIL]';
    const slug = result.v2Slug.padEnd(35);
    const templates = `${result.templateCount.branded}b/${result.templateCount.nonBranded}n`.padEnd(10);
    console.log(`${status} ${domain.padEnd(30)} ${slug} ${templates} ${result.issues.join(', ')}`);
  }
  
  console.log('\n' + '='.repeat(120) + '\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const passRate = (passed / results.length) * 100;
  
  console.log('[STATS] Summary:');
  console.log(`  Total:   ${results.length}`);
  console.log(`  Passed:  ${passed} (${passRate.toFixed(1)}%)`);
  console.log(`  Failed:  ${failed}\n`);
  
  const avgBranded = results.reduce((s, r) => s + r.templateCount.branded, 0) / results.length;
  const avgNonBranded = results.reduce((s, r) => s + r.templateCount.nonBranded, 0) / results.length;
  
  console.log('[TEMPLATES] Averages:');
  console.log(`  Branded:     ${avgBranded.toFixed(1)}`);
  console.log(`  Non-Branded: ${avgNonBranded.toFixed(1)}\n`);
  
  const slugDist: Record<string, number> = {};
  for (const r of results) slugDist[r.v2Slug] = (slugDist[r.v2Slug] || 0) + 1;
  const topSlugs = Object.entries(slugDist).sort((a, b) => b[1] - a[1]).slice(0, 10);
  
  console.log('[SLUGS] Top 10:');
  for (const [slug, count] of topSlugs) {
    console.log(`  ${slug.padEnd(40)} ${count}`);
  }
  
  console.log('\n[SAMPLES] First 3 Domains:\n');
  for (const r of results.slice(0, 3)) {
    console.log(`${r.domain} -> ${r.v2Slug}`);
    console.log(`  Branded: ${r.samplePrompts.branded.slice(0, 2).join('; ')}`);
    console.log(`  NonBranded: ${r.samplePrompts.nonBranded.slice(0, 2).join('; ')}\n`);
  }
  
  console.log('='.repeat(120));
  if (passRate >= 95) console.log('[SUCCESS] System ready! >= 95% pass rate');
  else if (passRate >= 85) console.log('[GOOD] System good! >= 85% pass rate');
  else console.log(`[WARNING] Needs review: ${passRate.toFixed(1)}% pass rate`);
  console.log('='.repeat(120) + '\n');
  
  process.exit(passRate >= 85 ? 0 : 1);
}

runValidation();
