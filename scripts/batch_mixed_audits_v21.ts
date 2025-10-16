#!/usr/bin/env tsx

/**
 * Batch Mixed Audits v2.1 Analysis
 * 
 * Runs v2.1 reanalysis on 20-30 mixed audits across different verticals
 * to validate scoring consistency and generate comprehensive benchmark data
 * 
 * Usage: tsx scripts/batch_mixed_audits_v21.ts [--limit=25]
 */

const API_BASE = 'https://geodude-api.kevin-mcgovern.workers.dev';

interface MixedAuditResult {
  audit_id: string;
  domain: string;
  vertical: string;
  has_faq: boolean;
  bots_allowed: boolean;
  pages_crawled: number;
  issues_count: number;
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
  success: boolean;
  error?: string;
  duration_ms: number;
}

// Mock audit data representing different verticals and scenarios
const MIXED_AUDITS = [
  // E-commerce
  { id: 'aud_1760616884674_hmddpnay8', domain: 'apple.com', vertical: 'ecommerce', has_faq: true, bots_allowed: true },
  { id: 'aud_shopify_demo', domain: 'shopify.com', vertical: 'ecommerce', has_faq: true, bots_allowed: true },
  { id: 'aud_amazon_demo', domain: 'amazon.com', vertical: 'ecommerce', has_faq: true, bots_allowed: true },
  
  // SaaS/Tech
  { id: 'aud_slack_demo', domain: 'slack.com', vertical: 'saas', has_faq: true, bots_allowed: true },
  { id: 'aud_notion_demo', domain: 'notion.so', vertical: 'saas', has_faq: true, bots_allowed: true },
  { id: 'aud_github_demo', domain: 'github.com', vertical: 'saas', has_faq: false, bots_allowed: true },
  
  // News/Media
  { id: 'aud_cnn_demo', domain: 'cnn.com', vertical: 'news', has_faq: false, bots_allowed: true },
  { id: 'aud_bbc_demo', domain: 'bbc.com', vertical: 'news', has_faq: false, bots_allowed: true },
  { id: 'aud_techcrunch_demo', domain: 'techcrunch.com', vertical: 'news', has_faq: false, bots_allowed: true },
  
  // Healthcare
  { id: 'aud_mayo_demo', domain: 'mayoclinic.org', vertical: 'healthcare', has_faq: true, bots_allowed: false },
  { id: 'aud_webmd_demo', domain: 'webmd.com', vertical: 'healthcare', has_faq: true, bots_allowed: true },
  
  // Finance
  { id: 'aud_chase_demo', domain: 'chase.com', vertical: 'finance', has_faq: true, bots_allowed: false },
  { id: 'aud_paypal_demo', domain: 'paypal.com', vertical: 'finance', has_faq: true, bots_allowed: true },
  
  // Education
  { id: 'aud_coursera_demo', domain: 'coursera.org', vertical: 'education', has_faq: true, bots_allowed: true },
  { id: 'aud_edx_demo', domain: 'edx.org', vertical: 'education', has_faq: true, bots_allowed: true },
  
  // Government
  { id: 'aud_usa_demo', domain: 'usa.gov', vertical: 'government', has_faq: true, bots_allowed: true },
  { id: 'aud_irs_demo', domain: 'irs.gov', vertical: 'government', has_faq: true, bots_allowed: false },
  
  // Non-profit
  { id: 'aud_wikipedia_demo', domain: 'wikipedia.org', vertical: 'nonprofit', has_faq: false, bots_allowed: true },
  { id: 'aud_redcross_demo', domain: 'redcross.org', vertical: 'nonprofit', has_faq: true, bots_allowed: true },
  
  // Travel
  { id: 'aud_booking_demo', domain: 'booking.com', vertical: 'travel', has_faq: true, bots_allowed: true },
  { id: 'aud_expedia_demo', domain: 'expedia.com', vertical: 'travel', has_faq: true, bots_allowed: true },
  
  // Real Estate
  { id: 'aud_zillow_demo', domain: 'zillow.com', vertical: 'realestate', has_faq: true, bots_allowed: true },
  { id: 'aud_realtor_demo', domain: 'realtor.com', vertical: 'realestate', has_faq: true, bots_allowed: true },
  
  // Food/Restaurant
  { id: 'aud_doordash_demo', domain: 'doordash.com', vertical: 'food', has_faq: true, bots_allowed: true },
  { id: 'aud_grubhub_demo', domain: 'grubhub.com', vertical: 'food', has_faq: true, bots_allowed: true },
  
  // Entertainment
  { id: 'aud_netflix_demo', domain: 'netflix.com', vertical: 'entertainment', has_faq: true, bots_allowed: false },
  { id: 'aud_spotify_demo', domain: 'spotify.com', vertical: 'entertainment', has_faq: false, bots_allowed: true },
  
  // Automotive
  { id: 'aud_tesla_demo', domain: 'tesla.com', vertical: 'automotive', has_faq: true, bots_allowed: true },
  { id: 'aud_toyota_demo', domain: 'toyota.com', vertical: 'automotive', has_faq: true, bots_allowed: true },
];

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

async function processMixedAudit(audit: any): Promise<MixedAuditResult> {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 Processing ${audit.domain} (${audit.vertical})...`);
    
    // Get current scores
    const auditData = await getAuditScores(audit.id);
    
    // Reanalyze with v2.1
    await reanalyzeAudit(audit.id);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get updated scores
    const updatedData = await getAuditScores(audit.id);
    
    const v1Scores = {
      overall: auditData.score_overall || 0,
      crawlability: auditData.score_crawlability || 0,
      structured: auditData.score_structured || 0,
      answerability: auditData.score_answerability || 0,
      trust: auditData.score_trust || 0,
    };
    
    const v21Scores = {
      overall: updatedData.scores?.total || 0,
      crawlability: updatedData.scores?.crawlabilityPct || 0,
      structured: updatedData.scores?.structuredPct || 0,
      answerability: updatedData.scores?.answerabilityPct || 0,
      trust: updatedData.scores?.trustPct || 0,
      visibility: updatedData.scores?.visibilityPct || 0,
    };
    
    const deltas = {
      overall: v21Scores.overall - v1Scores.overall,
      crawlability: v21Scores.crawlability - v1Scores.crawlability,
      structured: v21Scores.structured - v1Scores.structured,
      answerability: v21Scores.answerability - v1Scores.answerability,
      trust: v21Scores.trust - v1Scores.trust,
      visibility: v21Scores.visibility - 0,
    };
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ ${audit.domain}: v1.0=${v1Scores.overall.toFixed(1)}% → v2.1=${v21Scores.overall.toFixed(1)}% (Δ${deltas.overall > 0 ? '+' : ''}${deltas.overall.toFixed(1)}%)`);
    
    return {
      audit_id: audit.id,
      domain: audit.domain,
      vertical: audit.vertical,
      has_faq: audit.has_faq,
      bots_allowed: audit.bots_allowed,
      pages_crawled: updatedData.pages_crawled || 0,
      issues_count: updatedData.issues_count || 0,
      v1_scores: v1Scores,
      v21_scores: v21Scores,
      deltas: deltas,
      success: true,
      duration_ms: duration,
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    console.error(`❌ ${audit.domain}: ${errorMsg}`);
    
    return {
      audit_id: audit.id,
      domain: audit.domain,
      vertical: audit.vertical,
      has_faq: audit.has_faq,
      bots_allowed: audit.bots_allowed,
      pages_crawled: 0,
      issues_count: 0,
      v1_scores: { overall: 0, crawlability: 0, structured: 0, answerability: 0, trust: 0 },
      v21_scores: { overall: 0, crawlability: 0, structured: 0, answerability: 0, trust: 0, visibility: 0 },
      deltas: { overall: 0, crawlability: 0, structured: 0, answerability: 0, trust: 0, visibility: 0 },
      success: false,
      error: errorMsg,
      duration_ms: duration,
    };
  }
}

function generateAnalysisReport(results: MixedAuditResult[]) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log('\n📊 Mixed Audits Analysis Report');
  console.log('================================');
  
  if (successful.length === 0) {
    console.log('❌ No successful audits to analyze');
    return;
  }
  
  // Overall statistics
  const avgOverallDelta = successful.reduce((sum, r) => sum + r.deltas.overall, 0) / successful.length;
  const avgV1Overall = successful.reduce((sum, r) => sum + r.v1_scores.overall, 0) / successful.length;
  const avgV21Overall = successful.reduce((sum, r) => sum + r.v21_scores.overall, 0) / successful.length;
  
  console.log(`\n🏆 Overall Score Analysis:`);
  console.log(`  Average v1.0: ${avgV1Overall.toFixed(2)}%`);
  console.log(`  Average v2.1: ${avgV21Overall.toFixed(2)}%`);
  console.log(`  Average Delta: ${avgOverallDelta > 0 ? '+' : ''}${avgOverallDelta.toFixed(2)}%`);
  
  // Pillar analysis
  const pillarDeltas = {
    crawlability: successful.reduce((sum, r) => sum + r.deltas.crawlability, 0) / successful.length,
    structured: successful.reduce((sum, r) => sum + r.deltas.structured, 0) / successful.length,
    answerability: successful.reduce((sum, r) => sum + r.deltas.answerability, 0) / successful.length,
    trust: successful.reduce((sum, r) => sum + r.deltas.trust, 0) / successful.length,
    visibility: successful.reduce((sum, r) => sum + r.deltas.visibility, 0) / successful.length,
  };
  
  console.log(`\n📊 Pillar Changes:`);
  Object.entries(pillarDeltas).forEach(([pillar, delta]) => {
    const trend = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
    console.log(`  ${pillar.padEnd(12)}: ${delta > 0 ? '+' : ''}${delta.toFixed(2)}% ${trend}`);
  });
  
  // Vertical analysis
  const verticals = [...new Set(successful.map(r => r.vertical))];
  console.log(`\n🏢 Vertical Analysis:`);
  verticals.forEach(vertical => {
    const verticalResults = successful.filter(r => r.vertical === vertical);
    const avgDelta = verticalResults.reduce((sum, r) => sum + r.deltas.overall, 0) / verticalResults.length;
    console.log(`  ${vertical.padEnd(12)}: ${avgDelta > 0 ? '+' : ''}${avgDelta.toFixed(2)}% (${verticalResults.length} audits)`);
  });
  
  // FAQ analysis
  const faqResults = successful.filter(r => r.has_faq);
  const noFaqResults = successful.filter(r => !r.has_faq);
  
  if (faqResults.length > 0 && noFaqResults.length > 0) {
    const faqAvgDelta = faqResults.reduce((sum, r) => sum + r.deltas.overall, 0) / faqResults.length;
    const noFaqAvgDelta = noFaqResults.reduce((sum, r) => sum + r.deltas.overall, 0) / noFaqResults.length;
    
    console.log(`\n❓ FAQ Impact:`);
    console.log(`  With FAQ    : ${faqAvgDelta > 0 ? '+' : ''}${faqAvgDelta.toFixed(2)}% (${faqResults.length} audits)`);
    console.log(`  Without FAQ : ${noFaqAvgDelta > 0 ? '+' : ''}${noFaqAvgDelta.toFixed(2)}% (${noFaqResults.length} audits)`);
  }
  
  // Visibility analysis
  const withVisibility = successful.filter(r => r.v21_scores.visibility > 0);
  console.log(`\n👁️  Visibility Analysis:`);
  console.log(`  Audits with visibility data: ${withVisibility.length}/${successful.length} (${(withVisibility.length/successful.length*100).toFixed(1)}%)`);
  if (withVisibility.length > 0) {
    const avgVisibility = withVisibility.reduce((sum, r) => sum + r.v21_scores.visibility, 0) / withVisibility.length;
    console.log(`  Average visibility score: ${avgVisibility.toFixed(2)}%`);
  }
  
  // Error analysis
  if (failed.length > 0) {
    console.log(`\n❌ Failed Audits: ${failed.length}`);
    failed.forEach(result => {
      console.log(`  ${result.domain}: ${result.error}`);
    });
  }
  
  console.log(`\n⏱️  Performance:`);
  const totalTime = results.reduce((sum, r) => sum + r.duration_ms, 0);
  const avgTime = totalTime / results.length;
  console.log(`  Total time: ${(totalTime/1000).toFixed(1)}s`);
  console.log(`  Average per audit: ${avgTime.toFixed(0)}ms`);
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 25;

  console.log('🧪 Mixed Audits v2.1 Analysis');
  console.log('==============================');
  console.log(`Processing: ${Math.min(limit, MIXED_AUDITS.length)} audits`);
  console.log(`Verticals: ${[...new Set(MIXED_AUDITS.slice(0, limit).map(a => a.vertical))].join(', ')}`);
  console.log('');

  const auditsToProcess = MIXED_AUDITS.slice(0, limit);
  const results: MixedAuditResult[] = [];

  for (const audit of auditsToProcess) {
    const result = await processMixedAudit(audit);
    results.push(result);
    
    // Delay between audits to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Generate analysis report
  generateAnalysisReport(results);

  // Export to CSV
  const csvFilename = `mixed_audits_v21_analysis_${new Date().toISOString().split('T')[0]}.csv`;
  const csvContent = [
    'audit_id,domain,vertical,has_faq,bots_allowed,pages_crawled,issues_count,v1_overall,v21_overall,delta_overall,v1_crawlability,v21_crawlability,delta_crawlability,v1_structured,v21_structured,delta_structured,v1_answerability,v21_answerability,delta_answerability,v1_trust,v21_trust,delta_trust,v21_visibility,success,error,duration_ms',
    ...results.map(r => [
      r.audit_id,
      r.domain,
      r.vertical,
      r.has_faq,
      r.bots_allowed,
      r.pages_crawled,
      r.issues_count,
      r.v1_scores.overall.toFixed(2),
      r.v21_scores.overall.toFixed(2),
      r.deltas.overall.toFixed(2),
      r.v1_scores.crawlability.toFixed(2),
      r.v21_scores.crawlability.toFixed(2),
      r.deltas.crawlability.toFixed(2),
      r.v1_scores.structured.toFixed(2),
      r.v21_scores.structured.toFixed(2),
      r.deltas.structured.toFixed(2),
      r.v1_scores.answerability.toFixed(2),
      r.v21_scores.answerability.toFixed(2),
      r.deltas.answerability.toFixed(2),
      r.v1_scores.trust.toFixed(2),
      r.v21_scores.trust.toFixed(2),
      r.deltas.trust.toFixed(2),
      r.v21_scores.visibility.toFixed(2),
      r.success,
      r.error || '',
      r.duration_ms
    ].join(','))
  ].join('\n');

  const fs = require('fs');
  fs.writeFileSync(csvFilename, csvContent);
  console.log(`\n📊 Results exported to: ${csvFilename}`);

  console.log('\n🎉 Mixed audits analysis complete!');
  console.log('💡 Review the CSV data to validate v2.1 scoring consistency');
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
