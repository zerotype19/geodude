#!/usr/bin/env tsx

/**
 * Batch Recompute v2.1 Script
 * 
 * Recalculates scores for existing audits using v2.1 model weights
 * without re-analyzing stored HTML. Uses existing audit_page_analysis data.
 * 
 * Usage: tsx scripts/batch_recompute_v21.ts [--limit=10] [--dry-run]
 */

import { D1Database } from '@cloudflare/workers-types';

interface Audit {
  id: string;
  property_id: string;
  domain: string;
  status: string;
  created_at: string;
}

interface RecomputeResult {
  audit_id: string;
  domain: string;
  success: boolean;
  v21_overall?: number;
  v1_overall?: number;
  score_delta?: number;
  error?: string;
  duration_ms: number;
}

const API_BASE = 'https://geodude-api.kevin-mcgovern.workers.dev';

async function fetchAudits(limit: number = 10): Promise<Audit[]> {
  // This would normally connect to D1, but for this script we'll use the API
  // In a real implementation, you'd query D1 directly
  console.log(`📊 Fetching last ${limit} audits...`);
  
  // For now, return mock data - replace with actual D1 query
  return [
    { id: 'aud_1760616884674_hmddpnay8', property_id: 'prop_123', domain: 'apple.com', status: 'completed', created_at: '2024-01-15T10:00:00Z' },
    // Add more audits as needed
  ];
}

async function getCurrentAuditScores(auditId: string): Promise<{ v1_overall?: number; v21_overall?: number }> {
  try {
    const response = await fetch(`${API_BASE}/v1/audits/${auditId}`);
    if (!response.ok) return {};
    
    const audit = await response.json();
    return {
      v1_overall: audit.scores?.total,
      v21_overall: audit.scores?.overall
    };
  } catch {
    return {};
  }
}

async function recomputeAudit(auditId: string): Promise<RecomputeResult> {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 Recomputing audit ${auditId}...`);
    
    // Get current scores for comparison
    const currentScores = await getCurrentAuditScores(auditId);
    
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
    const duration = Date.now() - startTime;

    const v21Overall = result.scores?.overall;
    const v1Overall = currentScores.v1_overall;
    const scoreDelta = v21Overall && v1Overall ? v21Overall - v1Overall : undefined;

    console.log(`✅ ${auditId}: v1.0=${v1Overall?.toFixed(1)}% → v2.1=${v21Overall?.toFixed(1)}% (Δ${scoreDelta?.toFixed(1)}%) (${duration}ms)`);

    return {
      audit_id: auditId,
      domain: result.domain || 'unknown',
      success: true,
      v21_overall: v21Overall,
      v1_overall: v1Overall,
      score_delta: scoreDelta,
      duration_ms: duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    console.error(`❌ ${auditId}: ${errorMsg}`);
    
    return {
      audit_id: auditId,
      domain: 'unknown',
      success: false,
      error: errorMsg,
      duration_ms: duration,
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;
  const dryRun = args.includes('--dry-run');

  console.log('🚀 Batch Recompute v2.1 Script');
  console.log('================================');
  console.log(`Limit: ${limit} audits`);
  console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);
  console.log('');

  if (dryRun) {
    console.log('🔍 DRY RUN - No actual recomputation will occur');
    const audits = await fetchAudits(limit);
    console.log(`Would recompute ${audits.length} audits:`);
    audits.forEach(audit => {
      console.log(`  - ${audit.id} (${audit.domain}) - ${audit.status}`);
    });
    return;
  }

  const audits = await fetchAudits(limit);
  const results: RecomputeResult[] = [];

  console.log(`📋 Processing ${audits.length} audits...`);
  console.log('');

  for (const audit of audits) {
    if (audit.status !== 'completed') {
      console.log(`⏭️  Skipping ${audit.id} (status: ${audit.status})`);
      continue;
    }

    const result = await recomputeAudit(audit.id);
    results.push(result);

    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('');
  console.log('📊 Summary');
  console.log('==========');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⏱️  Total time: ${results.reduce((sum, r) => sum + r.duration_ms, 0)}ms`);
  
  if (successful.length > 0) {
    const avgScore = successful.reduce((sum, r) => sum + (r.v21_overall || 0), 0) / successful.length;
    console.log(`📈 Average v2.1 overall score: ${avgScore.toFixed(1)}%`);
  }

  if (failed.length > 0) {
    console.log('');
    console.log('❌ Failed audits:');
    failed.forEach(result => {
      console.log(`  - ${result.audit_id}: ${result.error}`);
    });
  }

  // Export results to CSV
  const csvFilename = `v21_recompute_results_${new Date().toISOString().split('T')[0]}.csv`;
  const csvContent = [
    'audit_id,domain,success,v1_overall,v21_overall,score_delta,duration_ms,error',
    ...results.map(r => [
      r.audit_id,
      r.domain,
      r.success,
      r.v1_overall?.toFixed(2) || '',
      r.v21_overall?.toFixed(2) || '',
      r.score_delta?.toFixed(2) || '',
      r.duration_ms,
      r.error || ''
    ].join(','))
  ].join('\n');

  const fs = require('fs');
  fs.writeFileSync(csvFilename, csvContent);
  console.log(`📊 Results exported to: ${csvFilename}`);

  console.log('');
  console.log('🎉 Batch recompute complete!');
  console.log('💡 Check the UI to see updated 5-card layouts');
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
