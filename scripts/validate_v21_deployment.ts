#!/usr/bin/env tsx

/**
 * Comprehensive v2.1 Deployment Validation Script
 * 
 * Validates all aspects of the v2.1 deployment:
 * - Feature flags status
 * - API endpoints working
 * - UI consistency checks
 * - Score calculation accuracy
 * - CSV export for benchmarking
 * 
 * Usage: tsx scripts/validate_v21_deployment.ts
 */

const API_BASE = 'https://geodude-api.kevin-mcgovern.workers.dev';
const APP_BASE = 'https://04a0b5ae.geodude-app.pages.dev';

interface ValidationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: ValidationResult[] = [];

function addResult(test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
  results.push({ test, status, message, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${test}: ${message}`);
}

async function validateFeatureFlags() {
  console.log('\n🔧 Validating Feature Flags...');
  
  try {
    const response = await fetch(`${API_BASE}/status`);
    if (!response.ok) {
      addResult('Feature Flags API', 'FAIL', `Status endpoint failed: ${response.status}`);
      return;
    }
    
    const status = await response.json();
    
    if (status.v21_scoring) {
      addResult('Feature Flags API', 'PASS', 'v2.1 scoring metrics available', status.v21_scoring);
    } else {
      addResult('Feature Flags API', 'WARN', 'v2.1 scoring metrics not found in status');
    }
    
  } catch (error) {
    addResult('Feature Flags API', 'FAIL', `Error: ${error}`);
  }
}

async function validateAPIEndpoints() {
  console.log('\n🌐 Validating API Endpoints...');
  
  // Test main audit endpoint
  try {
    const response = await fetch(`${API_BASE}/v1/audits/aud_1760616884674_hmddpnay8`);
    if (!response.ok) {
      addResult('Audit Endpoint', 'FAIL', `Failed: ${response.status}`);
      return;
    }
    
    const audit = await response.json();
    
    if (audit.scores?.score_model_version === 'v2.1') {
      addResult('Audit Endpoint', 'PASS', 'v2.1 scores present');
    } else {
      addResult('Audit Endpoint', 'WARN', `Model version: ${audit.scores?.score_model_version || 'unknown'}`);
    }
    
    if (typeof audit.scores?.visibilityPct === 'number') {
      addResult('Visibility Score', 'PASS', `Visibility: ${audit.scores.visibilityPct}%`);
    } else {
      addResult('Visibility Score', 'WARN', 'Visibility score not present');
    }
    
  } catch (error) {
    addResult('Audit Endpoint', 'FAIL', `Error: ${error}`);
  }
  
  // Test reanalyze endpoint
  try {
    const response = await fetch(`${API_BASE}/v1/audits/aud_1760616884674_hmddpnay8/reanalyze?model=v2.1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      addResult('Reanalyze Endpoint', 'PASS', 'Reanalyze endpoint working');
    } else {
      addResult('Reanalyze Endpoint', 'FAIL', `Failed: ${response.status}`);
    }
  } catch (error) {
    addResult('Reanalyze Endpoint', 'FAIL', `Error: ${error}`);
  }
}

async function validateScoreCalculation() {
  console.log('\n📊 Validating Score Calculation...');
  
  try {
    const response = await fetch(`${API_BASE}/v1/audits/aud_1760616884674_hmddpnay8`);
    const audit = await response.json();
    
    const scores = audit.scores;
    if (!scores) {
      addResult('Score Calculation', 'FAIL', 'No scores object found');
      return;
    }
    
    // Check if all 5 pillars are present
    const pillars = ['crawlabilityPct', 'structuredPct', 'answerabilityPct', 'trustPct', 'visibilityPct'];
    const missingPillars = pillars.filter(p => typeof scores[p] !== 'number');
    
    if (missingPillars.length === 0) {
      addResult('5-Pillar Scoring', 'PASS', 'All 5 pillars present');
    } else {
      addResult('5-Pillar Scoring', 'WARN', `Missing pillars: ${missingPillars.join(', ')}`);
    }
    
    // Check score ranges
    const scoreValues = pillars.map(p => scores[p]).filter(v => typeof v === 'number');
    const invalidScores = scoreValues.filter(v => v < 0 || v > 100);
    
    if (invalidScores.length === 0) {
      addResult('Score Ranges', 'PASS', 'All scores within 0-100% range');
    } else {
      addResult('Score Ranges', 'FAIL', `Invalid scores: ${invalidScores.join(', ')}`);
    }
    
    // Check overall score calculation
    const expectedOverall = (
      (scores.crawlabilityPct || 0) * 0.30 +
      (scores.structuredPct || 0) * 0.25 +
      (scores.answerabilityPct || 0) * 0.20 +
      (scores.trustPct || 0) * 0.15 +
      (scores.visibilityPct || 0) * 0.10
    );
    
    const actualOverall = scores.total || 0;
    const diff = Math.abs(expectedOverall - actualOverall);
    
    if (diff < 0.1) {
      addResult('Overall Score Calculation', 'PASS', `Accurate (diff: ${diff.toFixed(3)}%)`);
    } else {
      addResult('Overall Score Calculation', 'WARN', `Expected: ${expectedOverall.toFixed(1)}%, Actual: ${actualOverall.toFixed(1)}%`);
    }
    
  } catch (error) {
    addResult('Score Calculation', 'FAIL', `Error: ${error}`);
  }
}

async function validateUIComponents() {
  console.log('\n🎨 Validating UI Components...');
  
  try {
    // Test if the app is accessible
    const response = await fetch(`${APP_BASE}/`);
    if (response.ok) {
      addResult('App Accessibility', 'PASS', 'App is accessible');
    } else {
      addResult('App Accessibility', 'FAIL', `App not accessible: ${response.status}`);
    }
    
    // Test specific audit page
    const auditResponse = await fetch(`${APP_BASE}/a/aud_1760616884674_hmddpnay8`);
    if (auditResponse.ok) {
      addResult('Audit Page', 'PASS', 'Audit page accessible');
    } else {
      addResult('Audit Page', 'WARN', `Audit page: ${auditResponse.status}`);
    }
    
  } catch (error) {
    addResult('UI Components', 'FAIL', `Error: ${error}`);
  }
}

async function generateBenchmarkData() {
  console.log('\n📈 Generating Benchmark Data...');
  
  try {
    const response = await fetch(`${API_BASE}/v1/audits/aud_1760616884674_hmddpnay8`);
    const audit = await response.json();
    
    const benchmarkData = {
      audit_id: audit.id,
      domain: audit.domain,
      timestamp: new Date().toISOString(),
      v21_scores: {
        overall: audit.scores?.total || 0,
        crawlability: audit.scores?.crawlabilityPct || 0,
        structured: audit.scores?.structuredPct || 0,
        answerability: audit.scores?.answerabilityPct || 0,
        trust: audit.scores?.trustPct || 0,
        visibility: audit.scores?.visibilityPct || 0,
      },
      v1_scores: {
        overall: audit.score_overall || 0,
        crawlability: audit.score_crawlability || 0,
        structured: audit.score_structured || 0,
        answerability: audit.score_answerability || 0,
        trust: audit.score_trust || 0,
      },
      metadata: {
        pages_crawled: audit.pages_crawled,
        pages_total: audit.pages_total,
        issues_count: audit.issues_count,
        model_version: audit.scores?.score_model_version || 'unknown',
      }
    };
    
    // Export to CSV
    const csvFilename = `v21_benchmark_${new Date().toISOString().split('T')[0]}.csv`;
    const csvContent = [
      'audit_id,domain,timestamp,model_version,overall_v21,overall_v1,delta_overall,crawlability_v21,structured_v21,answerability_v21,trust_v21,visibility_v21,pages_crawled,issues_count',
      [
        benchmarkData.audit_id,
        benchmarkData.domain,
        benchmarkData.timestamp,
        benchmarkData.metadata.model_version,
        benchmarkData.v21_scores.overall.toFixed(2),
        benchmarkData.v1_scores.overall.toFixed(2),
        (benchmarkData.v21_scores.overall - benchmarkData.v1_scores.overall).toFixed(2),
        benchmarkData.v21_scores.crawlability.toFixed(2),
        benchmarkData.v21_scores.structured.toFixed(2),
        benchmarkData.v21_scores.answerability.toFixed(2),
        benchmarkData.v21_scores.trust.toFixed(2),
        benchmarkData.v21_scores.visibility.toFixed(2),
        benchmarkData.metadata.pages_crawled,
        benchmarkData.metadata.issues_count
      ].join(',')
    ].join('\n');
    
    const fs = require('fs');
    fs.writeFileSync(csvFilename, csvContent);
    
    addResult('Benchmark Data', 'PASS', `Exported to ${csvFilename}`, benchmarkData);
    
  } catch (error) {
    addResult('Benchmark Data', 'FAIL', `Error: ${error}`);
  }
}

function printSummary() {
  console.log('\n📋 Validation Summary');
  console.log('=====================');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`📊 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}: ${r.message}`);
    });
  }
  
  if (warnings > 0) {
    console.log('\n⚠️  Warnings:');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`  - ${r.test}: ${r.message}`);
    });
  }
  
  console.log('\n🎯 Next Steps:');
  if (failed === 0) {
    console.log('✅ v2.1 deployment is ready for production!');
    console.log('💡 Consider running batch processing on more audits');
    console.log('📊 Use the generated CSV files for score analysis');
  } else {
    console.log('🔧 Fix the failed tests before proceeding');
    console.log('🔄 Re-run validation after fixes');
  }
}

async function main() {
  console.log('🧪 v2.1 Deployment Validation');
  console.log('==============================');
  console.log(`API: ${API_BASE}`);
  console.log(`App: ${APP_BASE}`);
  console.log(`Time: ${new Date().toISOString()}`);
  
  await validateFeatureFlags();
  await validateAPIEndpoints();
  await validateScoreCalculation();
  await validateUIComponents();
  await generateBenchmarkData();
  
  printSummary();
}

// Run the validation
main().catch(error => {
  console.error('💥 Validation failed:', error);
  process.exit(1);
});
