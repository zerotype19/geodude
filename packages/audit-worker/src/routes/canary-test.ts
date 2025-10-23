/**
 * Canary Test for Industry Classification
 * 
 * Tests a representative set of domains against expected industries
 * Returns pass/fail with confidence scores
 */

import { resolveIndustry, type IndustrySignals } from '../lib/industry';
import type { Env } from '../index';
import type { IndustryKey } from '../config/industry-packs.schema';

interface CanaryTest {
  domain: string;
  expected: IndustryKey;
  root_url: string;
  site_description?: string;
}

const CANARY_TESTS: CanaryTest[] = [
  // SaaS B2B
  { domain: 'adobe.com', expected: 'saas_b2b', root_url: 'https://adobe.com', site_description: 'Creative Cloud software and digital experience tools' },
  { domain: 'salesforce.com', expected: 'saas_b2b', root_url: 'https://salesforce.com', site_description: 'CRM and cloud software platform' },
  { domain: 'workday.com', expected: 'saas_b2b', root_url: 'https://workday.com', site_description: 'HR and finance software' },
  { domain: 'intuit.com', expected: 'saas_b2b', root_url: 'https://intuit.com', site_description: 'QuickBooks, TurboTax, Mint software' },
  
  // Automotive OEM
  { domain: 'toyota.com', expected: 'automotive_oem', root_url: 'https://toyota.com', site_description: 'Toyota vehicles and cars' },
  { domain: 'tesla.com', expected: 'automotive_oem', root_url: 'https://tesla.com', site_description: 'Electric vehicles and clean energy' },
  
  // Retail
  { domain: 'costco.com', expected: 'retail', root_url: 'https://costco.com', site_description: 'Warehouse club and online store' },
  { domain: 'bestbuy.com', expected: 'retail', root_url: 'https://bestbuy.com', site_description: 'Electronics and appliances retailer' },
  
  // Media & Entertainment
  { domain: 'cnn.com', expected: 'media_entertainment', root_url: 'https://cnn.com', site_description: 'News and current events' },
  { domain: 'nytimes.com', expected: 'media_entertainment', root_url: 'https://nytimes.com', site_description: 'The New York Times news organization' },
  
  // Travel - Air
  { domain: 'southwest.com', expected: 'travel_air', root_url: 'https://southwest.com', site_description: 'Low-cost airline and flight booking' },
  { domain: 'delta.com', expected: 'travel_air', root_url: 'https://delta.com', site_description: 'Airline flights and travel' },
  
  // Healthcare
  { domain: 'mayoclinic.org', expected: 'healthcare_provider', root_url: 'https://mayoclinic.org', site_description: 'Medical care and health information' },
  { domain: 'clevelandclinic.org', expected: 'healthcare_provider', root_url: 'https://clevelandclinic.org', site_description: 'Healthcare and medical center' },
];

interface CanaryResult {
  domain: string;
  expected: IndustryKey;
  actual: IndustryKey;
  pass: boolean;
  confidence: number;
  source: string;
  details?: string;
}

export async function handleCanaryTest(req: Request, env: Env): Promise<Response> {
  const results: CanaryResult[] = [];
  let passCount = 0;
  let genericCount = 0;
  
  console.log('[CANARY_TEST] Starting industry classification canary tests...');
  
  for (const test of CANARY_TESTS) {
    try {
      const signals: IndustrySignals = {
        domain: test.domain,
        homepageTitle: undefined, // Will be fetched by AI classifier
        homepageH1: undefined,
        schemaTypes: undefined,
        keywords: test.site_description ? test.site_description.toLowerCase().split(/\s+/) : undefined,
        navTerms: undefined,
      };
      
      const result = await resolveIndustry({
        signals,
        env,
        root_url: test.root_url,
        site_description: test.site_description,
      });
      
      const pass = result.value === test.expected;
      const isGeneric = result.value === 'generic_consumer';
      
      if (pass) passCount++;
      if (isGeneric) genericCount++;
      
      results.push({
        domain: test.domain,
        expected: test.expected,
        actual: result.value,
        pass,
        confidence: result.confidence || 0,
        source: result.source,
        details: pass ? undefined : `Expected ${test.expected}, got ${result.value} (source: ${result.source})`
      });
      
      console.log(`[CANARY] ${test.domain}: ${pass ? '✅' : '❌'} (expected: ${test.expected}, got: ${result.value}, conf: ${result.confidence?.toFixed(3) || 'N/A'})`);
    } catch (error: any) {
      results.push({
        domain: test.domain,
        expected: test.expected,
        actual: 'generic_consumer',
        pass: false,
        confidence: 0,
        source: 'error',
        details: error.message
      });
      console.error(`[CANARY] ${test.domain}: ERROR - ${error.message}`);
    }
  }
  
  const passRate = (passCount / CANARY_TESTS.length) * 100;
  const genericRate = (genericCount / CANARY_TESTS.length) * 100;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  
  const summary = {
    pass: passRate >= 95, // 95% pass rate required
    passRate: Math.round(passRate * 10) / 10,
    genericRate: Math.round(genericRate * 10) / 10,
    avgConfidence: Math.round(avgConfidence * 1000) / 1000,
    passCount,
    totalCount: CANARY_TESTS.length,
    genericCount,
    results: results.map(r => ({
      domain: r.domain,
      status: r.pass ? '✅ PASS' : '❌ FAIL',
      expected: r.expected,
      actual: r.actual,
      confidence: Math.round(r.confidence * 1000) / 1000,
      source: r.source,
      details: r.details
    })),
    assertions: {
      pass_rate_95pct: passRate >= 95 ? '✅ PASS' : '❌ FAIL',
      no_generic_consumer: genericCount === 0 ? '✅ PASS' : `❌ FAIL (${genericCount} generic)`,
      avg_confidence_40pct: avgConfidence >= 0.40 ? '✅ PASS' : `❌ FAIL (${avgConfidence.toFixed(3)})`
    }
  };
  
  console.log('[CANARY_TEST] Summary:', {
    passRate: `${summary.passRate}%`,
    genericRate: `${summary.genericRate}%`,
    avgConfidence: summary.avgConfidence,
    overallPass: summary.pass
  });
  
  return new Response(JSON.stringify(summary, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

