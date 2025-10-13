#!/usr/bin/env node
// 72-Hour Observation Script for Visibility Intelligence Platform
// Run every 6 hours to monitor system health and performance

const { execSync } = require('child_process');

async function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    console.error(`❌ Error executing command: ${command}\n${error.stderr}`);
    throw error;
  }
}

async function checkRollupFreshness() {
  console.log('🕐 Checking Rollup Freshness...');
  try {
    const healthResponse = await runCommand('curl -s https://geodude-api.kevin-mcgovern.workers.dev/api/health/visibility');
    const health = JSON.parse(healthResponse);
    
    const lastRollup = new Date(health.last_rollup_at);
    const now = new Date();
    const hoursSinceRollup = (now - lastRollup) / (1000 * 60 * 60);
    
    console.log(`   Last rollup: ${health.last_rollup_at}`);
    console.log(`   Hours since rollup: ${hoursSinceRollup.toFixed(2)}`);
    
    if (hoursSinceRollup > 6) {
      console.log('⚠️  ALERT: No rollup for > 6h');
      return false;
    } else {
      console.log('✅ Rollup freshness: OK');
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to check rollup freshness:', error.message);
    return false;
  }
}

async function checkAssistantCoverage() {
  console.log('\n🤖 Checking Assistant Coverage...');
  try {
    const coverageResponse = await runCommand(`wrangler d1 execute optiview_db --remote --command "
      SELECT assistant, COUNT(*) as c, COUNT(DISTINCT source_domain) as d
      FROM ai_citations
      WHERE occurred_at >= datetime('now','-24 hours')
      GROUP BY assistant;"`);
    
    // Extract JSON from wrangler output (skip emoji and formatting)
    const jsonStart = coverageResponse.indexOf('[');
    const jsonEnd = coverageResponse.lastIndexOf(']') + 1;
    const jsonString = coverageResponse.substring(jsonStart, jsonEnd);
    const coverage = JSON.parse(jsonString)[0].results;
    console.log('   Assistant coverage (last 24h):');
    
    let totalCitations = 0;
    let totalDomains = 0;
    
    for (const row of coverage) {
      const assistant = row.assistant || 'unknown';
      const citations = row.c;
      const domains = row.d;
      
      console.log(`   ${assistant}: ${citations} citations, ${domains} domains`);
      totalCitations += citations;
      totalDomains += domains;
    }
    
    console.log(`   Total: ${totalCitations} citations, ${totalDomains} domains`);
    
    if (totalCitations === 0) {
      console.log('⚠️  ALERT: No citations in last 24h');
      return false;
    } else {
      console.log('✅ Assistant coverage: OK');
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to check assistant coverage:', error.message);
    return false;
  }
}

async function checkCostGuardrails() {
  console.log('\n💰 Checking Cost Guardrails...');
  try {
    const costResponse = await runCommand('curl -s https://geodude-api.kevin-mcgovern.workers.dev/api/visibility/cost');
    const cost = JSON.parse(costResponse);
    
    console.log(`   Daily cost: $${cost.daily_cost_usd}`);
    console.log(`   Cost cap: $${cost.cost_cap_usd}`);
    console.log(`   Cost utilization: ${(cost.daily_cost_usd / cost.cost_cap_usd * 100).toFixed(1)}%`);
    
    console.log('   Runs today:');
    for (const run of cost.runs_today) {
      const successRate = run.completed > 0 ? (run.completed / run.runs * 100).toFixed(1) : 0;
      console.log(`     ${run.assistant}: ${run.runs} runs, ${run.completed} completed (${successRate}% success)`);
    }
    
    if (cost.daily_cost_usd > cost.cost_cap_usd * 0.8) {
      console.log('⚠️  ALERT: Daily cost > 80% of cap');
      return false;
    } else {
      console.log('✅ Cost guardrails: OK');
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to check cost guardrails:', error.message);
    return false;
  }
}

async function checkErrorRates() {
  console.log('\n📊 Checking Error Rates...');
  try {
    // Check for any recent errors in assistant runs
    const errorResponse = await runCommand(`wrangler d1 execute optiview_db --remote --command "
      SELECT assistant, 
             COUNT(*) as total_runs,
             COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_runs,
             COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_runs
      FROM assistant_runs
      WHERE created_at >= datetime('now','-24 hours')
      GROUP BY assistant;"`);
    
    // Extract JSON from wrangler output (skip emoji and formatting)
    const jsonStart = errorResponse.indexOf('[');
    const jsonEnd = errorResponse.lastIndexOf(']') + 1;
    const jsonString = errorResponse.substring(jsonStart, jsonEnd);
    const errors = JSON.parse(jsonString)[0].results;
    let overallErrorRate = 0;
    let totalRuns = 0;
    let failedRuns = 0;
    
    console.log('   Error rates (last 24h):');
    for (const row of errors) {
      const assistant = row.assistant || 'unknown';
      const total = row.total_runs;
      const failed = row.failed_runs;
      const completed = row.completed_runs;
      const errorRate = total > 0 ? (failed / total * 100) : 0;
      
      console.log(`     ${assistant}: ${total} total, ${failed} failed, ${completed} completed (${errorRate.toFixed(1)}% error rate)`);
      
      totalRuns += total;
      failedRuns += failed;
    }
    
    overallErrorRate = totalRuns > 0 ? (failedRuns / totalRuns * 100) : 0;
    console.log(`   Overall error rate: ${overallErrorRate.toFixed(1)}%`);
    
    if (overallErrorRate > 5) {
      console.log('⚠️  ALERT: Error rate > 5%');
      return false;
    } else {
      console.log('✅ Error rates: OK');
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to check error rates:', error.message);
    return false;
  }
}

async function checkUIPerformance() {
  console.log('\n⚡ Checking UI Performance...');
  try {
    const startTime = Date.now();
    const uiResponse = await runCommand('curl -s -w "%{time_total}" -o /dev/null https://feature-visibility-scoring.geodude-app.pages.dev/insights/visibility');
    const responseTime = parseFloat(uiResponse.trim()) * 1000; // Convert to milliseconds
    
    console.log(`   UI response time: ${responseTime.toFixed(0)}ms`);
    
    if (responseTime > 2000) {
      console.log('⚠️  ALERT: UI p95 > 2000ms');
      return false;
    } else {
      console.log('✅ UI performance: OK');
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to check UI performance:', error.message);
    return false;
  }
}

async function generateReport() {
  console.log('\n📋 Generating 72h Observation Report...');
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    checks: {
      rollup_freshness: await checkRollupFreshness(),
      assistant_coverage: await checkAssistantCoverage(),
      cost_guardrails: await checkCostGuardrails(),
      error_rates: await checkErrorRates(),
      ui_performance: await checkUIPerformance()
    }
  };
  
  const allPassed = Object.values(report.checks).every(check => check);
  report.overall_status = allPassed ? 'HEALTHY' : 'ALERTS';
  
  console.log(`\n🎯 Overall Status: ${report.overall_status}`);
  
  if (allPassed) {
    console.log('✅ All systems operational - ready for design partners!');
  } else {
    console.log('⚠️  Some alerts detected - review before widening access');
  }
  
  // Save report to file
  const fs = require('fs');
  const reportFile = `reports/observation-${timestamp.split('T')[0]}-${timestamp.split('T')[1].split('.')[0].replace(/:/g, '-')}.json`;
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved to: ${reportFile}`);
  
  return report;
}

// Main execution
async function main() {
  console.log('🚀 72-Hour Observation Check');
  console.log('============================');
  console.log(`⏰ ${new Date().toISOString()}\n`);
  
  try {
    const report = await generateReport();
    process.exit(report.overall_status === 'HEALTHY' ? 0 : 1);
  } catch (error) {
    console.error('💥 Observation check failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
