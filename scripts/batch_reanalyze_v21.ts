#!/usr/bin/env tsx

/**
 * Batch Re-analyze v2.1 Script
 * 
 * Re-parses stored HTML in audit_pages.body_text and runs full v2.1 analysis
 * including EEAT fields, FAQ schema detection, etc. Then recomputes v2.1 scores.
 * 
 * Usage: tsx scripts/batch_reanalyze_v21.ts [--limit=5] [--dry-run]
 */

import { D1Database } from '@cloudflare/workers-types';

interface Audit {
  id: string;
  property_id: string;
  domain: string;
  status: string;
  created_at: string;
  pages_count: number;
}

interface ReanalyzeResult {
  audit_id: string;
  domain: string;
  success: boolean;
  pages_analyzed: number;
  v21_overall?: number;
  faq_pages?: number;
  jsonld_pages?: number;
  error?: string;
  duration_ms: number;
}

const API_BASE = 'https://geodude-api.kevin-mcgovern.workers.dev';

async function fetchAudits(limit: number = 5): Promise<Audit[]> {
  console.log(`📊 Fetching last ${limit} audits with page counts...`);
  
  // Mock data - replace with actual D1 query
  return [
    { 
      id: 'aud_1760616884674_hmddpnay8', 
      property_id: 'prop_123', 
      domain: 'apple.com', 
      status: 'completed', 
      created_at: '2024-01-15T10:00:00Z',
      pages_count: 50
    },
    // Add more audits as needed
  ];
}

async function reanalyzeAudit(auditId: string): Promise<ReanalyzeResult> {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 Re-analyzing audit ${auditId}...`);
    
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
    const duration = Date.now() - startTime;

    console.log(`✅ ${auditId}: ${result.pages_analyzed || 0} pages analyzed, v2.1 overall = ${result.scores?.overall || 'N/A'}% (${duration}ms)`);

    return {
      audit_id: auditId,
      domain: result.domain || 'unknown',
      success: true,
      pages_analyzed: result.pages_analyzed || 0,
      v21_overall: result.scores?.overall,
      faq_pages: result.faq_pages || 0,
      jsonld_pages: result.jsonld_pages || 0,
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
      pages_analyzed: 0,
      error: errorMsg,
      duration_ms: duration,
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 5;
  const dryRun = args.includes('--dry-run');

  console.log('🔍 Batch Re-analyze v2.1 Script');
  console.log('=================================');
  console.log(`Limit: ${limit} audits`);
  console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);
  console.log('');

  if (dryRun) {
    console.log('🔍 DRY RUN - No actual re-analysis will occur');
    const audits = await fetchAudits(limit);
    console.log(`Would re-analyze ${audits.length} audits:`);
    audits.forEach(audit => {
      console.log(`  - ${audit.id} (${audit.domain}) - ${audit.pages_count} pages - ${audit.status}`);
    });
    return;
  }

  const audits = await fetchAudits(limit);
  const results: ReanalyzeResult[] = [];

  console.log(`📋 Processing ${audits.length} audits...`);
  console.log('');

  for (const audit of audits) {
    if (audit.status !== 'completed') {
      console.log(`⏭️  Skipping ${audit.id} (status: ${audit.status})`);
      continue;
    }

    if (audit.pages_count === 0) {
      console.log(`⏭️  Skipping ${audit.id} (no pages to analyze)`);
      continue;
    }

    const result = await reanalyzeAudit(audit.id);
    results.push(result);

    // Longer delay for re-analysis as it's more intensive
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log('');
  console.log('📊 Summary');
  console.log('==========');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📄 Total pages analyzed: ${successful.reduce((sum, r) => sum + r.pages_analyzed, 0)}`);
  console.log(`⏱️  Total time: ${results.reduce((sum, r) => sum + r.duration_ms, 0)}ms`);
  
  if (successful.length > 0) {
    const avgScore = successful.reduce((sum, r) => sum + (r.v21_overall || 0), 0) / successful.length;
    const totalFaqPages = successful.reduce((sum, r) => sum + (r.faq_pages || 0), 0);
    const totalJsonldPages = successful.reduce((sum, r) => sum + (r.jsonld_pages || 0), 0);
    
    console.log(`📈 Average v2.1 overall score: ${avgScore.toFixed(1)}%`);
    console.log(`❓ Total FAQ pages detected: ${totalFaqPages}`);
    console.log(`🏷️  Total JSON-LD pages: ${totalJsonldPages}`);
  }

  if (failed.length > 0) {
    console.log('');
    console.log('❌ Failed audits:');
    failed.forEach(result => {
      console.log(`  - ${result.audit_id}: ${result.error}`);
    });
  }

  console.log('');
  console.log('🎉 Batch re-analysis complete!');
  console.log('💡 Check the UI to see enhanced analysis and 5-card layouts');
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
