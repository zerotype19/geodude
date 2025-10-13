#!/usr/bin/env node

/**
 * 48-Hour Observation Summary
 * 
 * Generates comprehensive summary after 48-hour monitoring period
 * 
 * Usage: node scripts/observation-summary.js --summary
 */

const { execSync } = require('child_process');

function parseWranglerOutput(output) {
  try {
    const lines = output.split('\n');
    const jsonStart = lines.findIndex(line => line.trim().startsWith('['));
    
    if (jsonStart === -1) {
      throw new Error('No JSON array found in wrangler output');
    }
    
    let jsonEnd = jsonStart;
    let bracketCount = 0;
    for (let i = jsonStart; i < lines.length; i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === '[') bracketCount++;
        if (char === ']') bracketCount--;
        if (bracketCount === 0) {
          jsonEnd = i;
          break;
        }
      }
      if (bracketCount === 0) break;
    }
    
    const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
    const jsonString = jsonLines.join('\n');
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error parsing wrangler output:', error.message);
    return [];
  }
}

async function generateObservationSummary() {
  console.log('📊 48-Hour Observation Summary');
  console.log('📅 Generated:', new Date().toISOString());
  console.log('='.repeat(50));

  try {
    // 1. Queue Health Analysis
    console.log('\n🔍 1. Queue Health Analysis');
    console.log('-'.repeat(30));
    
    const queueResult = execSync(`wrangler d1 execute optiview_db --command "SELECT status, COUNT(*) as count, MIN(run_started_at) as earliest, MAX(run_started_at) as latest FROM assistant_runs GROUP BY status;" --remote`, { encoding: 'utf8' });
    const queueData = parseWranglerOutput(queueResult);
    const queueStats = queueData[0]?.results || [];
    
    let totalRuns = 0;
    let successRuns = 0;
    let errorRuns = 0;
    let runningRuns = 0;
    
    for (const stat of queueStats) {
      totalRuns += stat.count;
      if (stat.status === 'success') successRuns = stat.count;
      if (stat.status === 'error') errorRuns = stat.count;
      if (stat.status === 'running') runningRuns = stat.count;
    }
    
    const successRate = totalRuns > 0 ? ((successRuns / totalRuns) * 100).toFixed(1) : 0;
    
    console.log(`   📊 Total Runs: ${totalRuns}`);
    console.log(`   ✅ Successful: ${successRuns} (${successRate}%)`);
    console.log(`   ❌ Failed: ${errorRuns}`);
    console.log(`   🔄 Running: ${runningRuns}`);
    
    if (runningRuns > 0) {
      console.log('   ⚠️  WARNING: Stuck runs detected');
    } else {
      console.log('   ✅ No stuck runs');
    }
    
    // 2. Output & Citation Analysis
    console.log('\n📚 2. Output & Citation Analysis');
    console.log('-'.repeat(30));
    
    const outputsResult = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) as count FROM assistant_outputs WHERE parsed_at >= datetime('now','-48 hours');" --remote`, { encoding: 'utf8' });
    const outputsData = parseWranglerOutput(outputsResult);
    const outputsCount = outputsData[0]?.results?.[0]?.['count'] || 0;
    
    const citationsResult = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) as count FROM ai_citations WHERE occurred_at >= datetime('now','-48 hours');" --remote`, { encoding: 'utf8' });
    const citationsData = parseWranglerOutput(citationsResult);
    const citationsCount = citationsData[0]?.results?.[0]?.['count'] || 0;
    
    console.log(`   📄 Outputs (48h): ${outputsCount}`);
    console.log(`   🔗 Citations (48h): ${citationsCount}`);
    
    if (outputsCount === 0) {
      console.log('   ⚠️  WARNING: No outputs in last 48 hours');
    } else {
      console.log('   ✅ Outputs flowing normally');
    }
    
    if (citationsCount === 0) {
      console.log('   ⚠️  WARNING: No citations in last 48 hours');
    } else {
      console.log('   ✅ Citations flowing normally');
    }
    
    // 3. MVA Metrics Analysis
    console.log('\n📈 3. MVA Metrics Analysis');
    console.log('-'.repeat(30));
    
    const mvaResult = execSync(`wrangler d1 execute optiview_db --command "SELECT project_id, assistant, mentions_count, unique_urls, mva_daily FROM ai_visibility_metrics ORDER BY day DESC, project_id, assistant;" --remote`, { encoding: 'utf8' });
    const mvaData = parseWranglerOutput(mvaResult);
    const mvaStats = mvaData[0]?.results || [];
    
    if (mvaStats.length === 0) {
      console.log('   ⚠️  WARNING: No MVA metrics found');
    } else {
      console.log(`   📊 MVA Records: ${mvaStats.length}`);
      for (const stat of mvaStats) {
        console.log(`   📈 ${stat.project_id} (${stat.assistant}): ${stat.mentions_count} mentions, MVA: ${stat.mva_daily}`);
      }
    }
    
    // 4. Error Analysis
    console.log('\n🚨 4. Error Analysis');
    console.log('-'.repeat(30));
    
    const errorResult = execSync(`wrangler d1 execute optiview_db --command "SELECT error, COUNT(*) as count FROM assistant_runs WHERE status='error' AND run_started_at >= datetime('now','-48 hours') GROUP BY error;" --remote`, { encoding: 'utf8' });
    const errorData = parseWranglerOutput(errorResult);
    const errorStats = errorData[0]?.results || [];
    
    if (errorStats.length === 0) {
      console.log('   ✅ No errors in last 48 hours');
    } else {
      console.log('   📊 Error breakdown:');
      for (const error of errorStats) {
        console.log(`   ❌ ${error.error}: ${error.count} occurrences`);
      }
    }
    
    // 5. Performance Analysis
    console.log('\n⚡ 5. Performance Analysis');
    console.log('-'.repeat(30));
    
    const perfResult = execSync(`wrangler d1 execute optiview_db --command "SELECT AVG(run_duration_ms) as avg_duration, MIN(run_duration_ms) as min_duration, MAX(run_duration_ms) as max_duration FROM assistant_runs WHERE status='success' AND run_started_at >= datetime('now','-48 hours');" --remote`, { encoding: 'utf8' });
    const perfData = parseWranglerOutput(perfResult);
    const perfStats = perfData[0]?.results?.[0] || {};
    
    if (perfStats.avg_duration) {
      console.log(`   ⏱️  Avg Duration: ${Math.round(perfStats.avg_duration)}ms`);
      console.log(`   ⏱️  Min Duration: ${perfStats.min_duration}ms`);
      console.log(`   ⏱️  Max Duration: ${perfStats.max_duration}ms`);
    } else {
      console.log('   ⚠️  No performance data available');
    }
    
    // 6. Recommendation
    console.log('\n🎯 6. Recommendation');
    console.log('-'.repeat(30));
    
    const hasErrors = errorStats.length > 0;
    const hasStuckRuns = runningRuns > 0;
    const hasNoOutputs = outputsCount === 0;
    const hasNoCitations = citationsCount === 0;
    const hasLowSuccessRate = successRate < 80;
    
    if (hasErrors || hasStuckRuns || hasNoOutputs || hasNoCitations || hasLowSuccessRate) {
      console.log('   ⚠️  RECOMMENDATION: Keep current allowlist for another 24h');
      console.log('   📋 Issues to address:');
      if (hasErrors) console.log('     - Fix error patterns');
      if (hasStuckRuns) console.log('     - Resolve stuck runs');
      if (hasNoOutputs) console.log('     - Debug output generation');
      if (hasNoCitations) console.log('     - Debug citation parsing');
      if (hasLowSuccessRate) console.log('     - Improve success rate');
    } else {
      console.log('   ✅ RECOMMENDATION: Proceed with allowlist expansion');
      console.log('   🚀 Ready for Phase 4 planning');
    }
    
    console.log('\n📋 Next Steps:');
    console.log('   1. Review this summary');
    console.log('   2. If green: Add 3-5 new project IDs to allowlist');
    console.log('   3. Test new projects with single runs');
    console.log('   4. Tag v0.9.1-phase-next-c-stabilized');
    console.log('   5. Begin Phase 4 planning');
    
    console.log('\n✅ Observation Summary Complete');
    
  } catch (error) {
    console.error('❌ Error generating summary:', error.message);
    process.exit(1);
  }
}

// Check for --summary flag
const args = process.argv.slice(2);
if (args.includes('--summary')) {
  generateObservationSummary();
} else {
  console.log('Usage: node scripts/observation-summary.js --summary');
  process.exit(1);
}
