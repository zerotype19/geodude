#!/usr/bin/env tsx

/**
 * Compare v1.0 vs v2.1 Scoring Script
 * 
 * Compares scoring between v1.0 and v2.1 models for validation
 * 
 * Usage: tsx scripts/compare_v1_v21.ts <audit_id>
 */

const API_BASE = 'https://geodude-api.kevin-mcgovern.workers.dev';

interface ScoreComparison {
  audit_id: string;
  domain: string;
  v1_scores: {
    overall: number;
    crawlability: number;
    structured: number;
    answerability: number;
    trust: number;
  };
  v21_scores: {
    overall: number;
    crawlability: number;
    structured: number;
    answerability: number;
    trust: number;
    visibility: number;
  };
  deltas: {
    overall: number;
    crawlability: number;
    structured: number;
    answerability: number;
    trust: number;
    visibility: number;
  };
}

async function getAuditScores(auditId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/v1/audits/${auditId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch audit: ${response.status}`);
  }
  return response.json();
}

async function reanalyzeAudit(auditId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/v1/audits/${auditId}/reanalyze?model=v2.1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Reanalyze failed: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

async function compareScores(auditId: string): Promise<ScoreComparison> {
  console.log(`🔍 Comparing scores for audit ${auditId}...`);
  
  // Get current scores (should be v2.1 after reanalyze)
  const audit = await getAuditScores(auditId);
  
  // Extract v1.0 scores from legacy fields
  const v1Scores = {
    overall: audit.score_overall || 0,
    crawlability: audit.score_crawlability || 0,
    structured: audit.score_structured || 0,
    answerability: audit.score_answerability || 0,
    trust: audit.score_trust || 0,
  };
  
  // Extract v2.1 scores from scores object
  const v21Scores = {
    overall: audit.scores?.total || audit.scores?.overall || 0,
    crawlability: audit.scores?.crawlabilityPct || 0,
    structured: audit.scores?.structuredPct || 0,
    answerability: audit.scores?.answerabilityPct || 0,
    trust: audit.scores?.trustPct || 0,
    visibility: audit.scores?.visibilityPct || 0,
  };
  
  // Calculate deltas
  const deltas = {
    overall: v21Scores.overall - v1Scores.overall,
    crawlability: v21Scores.crawlability - v1Scores.crawlability,
    structured: v21Scores.structured - v1Scores.structured,
    answerability: v21Scores.answerability - v1Scores.answerability,
    trust: v21Scores.trust - v1Scores.trust,
    visibility: v21Scores.visibility - 0, // v1.0 doesn't have visibility
  };
  
  return {
    audit_id: auditId,
    domain: audit.domain || 'unknown',
    v1_scores: v1Scores,
    v21_scores: v21Scores,
    deltas: deltas,
  };
}

function printComparison(comparison: ScoreComparison) {
  console.log('');
  console.log('📊 Score Comparison Results');
  console.log('============================');
  console.log(`Audit: ${comparison.audit_id}`);
  console.log(`Domain: ${comparison.domain}`);
  console.log('');
  
  console.log('🏆 Overall Score:');
  console.log(`  v1.0: ${comparison.v1_scores.overall.toFixed(1)}%`);
  console.log(`  v2.1: ${comparison.v21_scores.overall.toFixed(1)}%`);
  console.log(`  Δ: ${comparison.deltas.overall > 0 ? '+' : ''}${comparison.deltas.overall.toFixed(1)}%`);
  console.log('');
  
  console.log('📊 Pillar Breakdown:');
  console.log('  Pillar          v1.0     v2.1     Δ');
  console.log('  --------------- -------- -------- --------');
  console.log(`  Crawlability    ${comparison.v1_scores.crawlability.toFixed(1).padStart(6)}%  ${comparison.v21_scores.crawlability.toFixed(1).padStart(6)}%  ${(comparison.deltas.crawlability > 0 ? '+' : '') + comparison.deltas.crawlability.toFixed(1).padStart(6)}%`);
  console.log(`  Structured      ${comparison.v1_scores.structured.toFixed(1).padStart(6)}%  ${comparison.v21_scores.structured.toFixed(1).padStart(6)}%  ${(comparison.deltas.structured > 0 ? '+' : '') + comparison.deltas.structured.toFixed(1).padStart(6)}%`);
  console.log(`  Answerability   ${comparison.v1_scores.answerability.toFixed(1).padStart(6)}%  ${comparison.v21_scores.answerability.toFixed(1).padStart(6)}%  ${(comparison.deltas.answerability > 0 ? '+' : '') + comparison.deltas.answerability.toFixed(1).padStart(6)}%`);
  console.log(`  Trust           ${comparison.v1_scores.trust.toFixed(1).padStart(6)}%  ${comparison.v21_scores.trust.toFixed(1).padStart(6)}%  ${(comparison.deltas.trust > 0 ? '+' : '') + comparison.deltas.trust.toFixed(1).padStart(6)}%`);
  console.log(`  Visibility      N/A      ${comparison.v21_scores.visibility.toFixed(1).padStart(6)}%  ${(comparison.deltas.visibility > 0 ? '+' : '') + comparison.deltas.visibility.toFixed(1).padStart(6)}%`);
  console.log('');
  
  // Analysis
  const totalDelta = comparison.deltas.overall;
  if (Math.abs(totalDelta) < 1) {
    console.log('✅ Scores are very similar (Δ < 1%)');
  } else if (totalDelta > 0) {
    console.log(`📈 v2.1 scores higher by ${totalDelta.toFixed(1)}%`);
  } else {
    console.log(`📉 v2.1 scores lower by ${Math.abs(totalDelta).toFixed(1)}%`);
  }
  
  if (comparison.v21_scores.visibility > 0) {
    console.log('👁️  Visibility data detected in v2.1');
  } else {
    console.log('⚠️  No visibility data in v2.1 (expected for most audits)');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const auditId = args[0];

  if (!auditId) {
    console.error('❌ Usage: tsx scripts/compare_v1_v21.ts <audit_id>');
    process.exit(1);
  }

  console.log('🔍 v1.0 vs v2.1 Score Comparison');
  console.log('=================================');
  console.log(`Audit ID: ${auditId}`);
  console.log('');

  try {
    // First ensure we have v2.1 scores
    console.log('🔄 Ensuring v2.1 analysis is complete...');
    await reanalyzeAudit(auditId);
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Compare scores
    const comparison = await compareScores(auditId);
    printComparison(comparison);
    
    // Export to CSV
    const csvFilename = `v1_v21_comparison_${auditId}_${new Date().toISOString().split('T')[0]}.csv`;
    const csvContent = [
      'audit_id,domain,metric,v1_score,v21_score,delta',
      `"${comparison.audit_id}","${comparison.domain}",overall,${comparison.v1_scores.overall.toFixed(2)},${comparison.v21_scores.overall.toFixed(2)},${comparison.deltas.overall.toFixed(2)}`,
      `"${comparison.audit_id}","${comparison.domain}",crawlability,${comparison.v1_scores.crawlability.toFixed(2)},${comparison.v21_scores.crawlability.toFixed(2)},${comparison.deltas.crawlability.toFixed(2)}`,
      `"${comparison.audit_id}","${comparison.domain}",structured,${comparison.v1_scores.structured.toFixed(2)},${comparison.v21_scores.structured.toFixed(2)},${comparison.deltas.structured.toFixed(2)}`,
      `"${comparison.audit_id}","${comparison.domain}",answerability,${comparison.v1_scores.answerability.toFixed(2)},${comparison.v21_scores.answerability.toFixed(2)},${comparison.deltas.answerability.toFixed(2)}`,
      `"${comparison.audit_id}","${comparison.domain}",trust,${comparison.v1_scores.trust.toFixed(2)},${comparison.v21_scores.trust.toFixed(2)},${comparison.deltas.trust.toFixed(2)}`,
      `"${comparison.audit_id}","${comparison.domain}",visibility,0,${comparison.v21_scores.visibility.toFixed(2)},${comparison.deltas.visibility.toFixed(2)}`,
    ].join('\n');

    const fs = require('fs');
    fs.writeFileSync(csvFilename, csvContent);
    console.log(`📊 Results exported to: ${csvFilename}`);

  } catch (error) {
    console.error('💥 Comparison failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
