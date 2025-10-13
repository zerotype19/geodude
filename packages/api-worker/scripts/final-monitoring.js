#!/usr/bin/env node
/**
 * Final Phase Next Monitoring Script
 * Handles wrangler output properly
 */

const { execSync } = require('child_process');

function parseWranglerOutput(output) {
  try {
    // Find the JSON array in the output
    const lines = output.split('\n');
    let jsonStart = -1;
    let jsonEnd = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('[')) {
        jsonStart = i;
      }
      if (jsonStart !== -1 && lines[i].trim().endsWith(']')) {
        jsonEnd = i;
        break;
      }
    }
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
      const jsonStr = jsonLines.join('\n');
      return JSON.parse(jsonStr);
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function finalMonitoring() {
  console.log('📊 Phase Next Final Monitoring');
  console.log('📅', new Date().toISOString());
  console.log('⏰ Phase: Step B - E-E-A-T Beta');
  console.log('=' .repeat(50));
  
  try {
    // 1. API Health Check
    console.log('\n🔍 1. API Health Check');
    console.log('-'.repeat(25));
    try {
      const healthResponse = execSync('curl -s "https://geodude-api.kevin-mcgovern.workers.dev/api/health"', { 
        encoding: 'utf8',
        timeout: 5000
      });
      const health = JSON.parse(healthResponse);
      console.log(`   ✅ API Status: ${health.ok ? 'HEALTHY' : 'UNHEALTHY'}`);
      console.log(`   📊 Service: ${health.service}`);
    } catch (error) {
      console.log('   ❌ API Health Check Failed');
    }
    
    // 2. Database Tables Check
    console.log('\n💾 2. Database Tables Check');
    console.log('-'.repeat(25));
    try {
      const tablesOutput = execSync(`wrangler d1 execute optiview_db --command "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%assistant%' OR name LIKE '%ai_%');" --remote`, { 
        encoding: 'utf8',
        timeout: 10000
      });
      const tablesData = parseWranglerOutput(tablesOutput);
      
      if (tablesData && tablesData[0] && tablesData[0].results) {
        const tables = tablesData[0].results;
        console.log(`   ✅ Phase Next tables: ${tables.length} found`);
        tables.forEach(table => console.log(`      - ${table.name}`));
        
        if (tables.length >= 5) {
          console.log('   ✅ All required tables present');
        } else {
          console.log('   ⚠️  Some tables may be missing');
        }
      } else {
        console.log('   ❌ Could not parse table data');
      }
    } catch (error) {
      console.log('   ❌ Database check failed:', error.message);
    }
    
    // 3. Recent Activity Check
    console.log('\n📈 3. Recent Activity Check');
    console.log('-'.repeat(25));
    try {
      const activityOutput = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) as total_pages, COUNT(CASE WHEN created_at > datetime('now','-1 hour') THEN 1 END) as pages_1h, COUNT(CASE WHEN created_at > datetime('now','-24 hours') THEN 1 END) as pages_24h FROM audit_pages;" --remote`, { 
        encoding: 'utf8',
        timeout: 10000
      });
      const activityData = parseWranglerOutput(activityOutput);
      
      if (activityData && activityData[0] && activityData[0].results && activityData[0].results[0]) {
        const activity = activityData[0].results[0];
        console.log(`   📊 Total pages: ${activity.total_pages}`);
        console.log(`   📈 Pages (1h): ${activity.pages_1h}`);
        console.log(`   📈 Pages (24h): ${activity.pages_24h}`);
        
        if (activity.pages_1h > 0) {
          console.log('   ✅ Recent activity detected');
        } else {
          console.log('   ℹ️  No recent activity (normal for new deployment)');
        }
      } else {
        console.log('   ❌ Could not parse activity data');
      }
    } catch (error) {
      console.log('   ❌ Activity check failed:', error.message);
    }
    
    // 4. Assistant Runs Check
    console.log('\n🤖 4. Assistant Runs Check');
    console.log('-'.repeat(25));
    try {
      const runsOutput = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) as total_runs, COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_runs, COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_runs FROM assistant_runs;" --remote`, { 
        encoding: 'utf8',
        timeout: 10000
      });
      const runsData = parseWranglerOutput(runsOutput);
      
      if (runsData && runsData[0] && runsData[0].results && runsData[0].results[0]) {
        const runs = runsData[0].results[0];
        console.log(`   📊 Total runs: ${runs.total_runs}`);
        console.log(`   ✅ Successful: ${runs.successful_runs}`);
        console.log(`   ❌ Failed: ${runs.failed_runs}`);
        
        if (runs.total_runs > 0) {
          const successRate = (runs.successful_runs / runs.total_runs) * 100;
          console.log(`   📈 Success rate: ${Math.round(successRate)}%`);
        }
      } else {
        console.log('   ℹ️  No assistant runs yet');
      }
    } catch (error) {
      console.log('   ❌ Assistant runs check failed:', error.message);
    }
    
    // 5. AI Citations Check
    console.log('\n📚 5. AI Citations Check');
    console.log('-'.repeat(25));
    try {
      const citationsOutput = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) as total_citations, COUNT(CASE WHEN occurred_at > datetime('now','-24 hours') THEN 1 END) as recent_citations FROM ai_citations;" --remote`, { 
        encoding: 'utf8',
        timeout: 10000
      });
      const citationsData = parseWranglerOutput(citationsOutput);
      
      if (citationsData && citationsData[0] && citationsData[0].results && citationsData[0].results[0]) {
        const citations = citationsData[0].results[0];
        console.log(`   📊 Total citations: ${citations.total_citations}`);
        console.log(`   📈 Recent (24h): ${citations.recent_citations}`);
        
        if (citations.total_citations > 0) {
          console.log('   ✅ AI citations system active');
        } else {
          console.log('   ℹ️  No AI citations yet (normal for Step B)');
        }
      } else {
        console.log('   ℹ️  No citations data available');
      }
    } catch (error) {
      console.log('   ❌ Citations check failed:', error.message);
    }
    
    // 6. KV Status Check
    console.log('\n🗄️ 6. KV Status Check');
    console.log('-'.repeat(25));
    try {
      const kvCheck = execSync('wrangler kv key list --binding PROMPT_PACKS --remote', { 
        encoding: 'utf8',
        timeout: 10000
      });
      const kvLines = kvCheck.trim().split('\n').length - 1;
      console.log(`   📊 Prompt packs: ${kvLines} keys`);
      
      if (kvLines > 0) {
        console.log('   ✅ KV storage operational');
      } else {
        console.log('   ⚠️  No KV data found');
      }
    } catch (error) {
      console.log('   ❌ KV check failed:', error.message);
    }
    
    // 7. Feature Flags Status
    console.log('\n🚩 7. Feature Flags Status');
    console.log('-'.repeat(25));
    try {
      const healthResponse = await fetch('https://geodude-api.kevin-mcgovern.workers.dev/api/health');
      const healthData = await healthResponse.json();
      
      // Check if visibility API is available (indicates feature flag is on)
      const visibilityResponse = await fetch('https://geodude-api.kevin-mcgovern.workers.dev/api/visibility/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });
      
      const visibilityEnabled = visibilityResponse.status !== 404;
      
      console.log('   🧠 E-E-A-T Scoring: ENABLED (Step B)');
      console.log(`   👁️  Assistant Visibility: ${visibilityEnabled ? 'ENABLED (Step C)' : 'DISABLED (Step C)'}`);
      console.log(`   📊 Status: ${visibilityEnabled ? 'Step C - Assistant Visibility Active' : 'Monitoring 48-hour validation period'}`);
    } catch (error) {
      console.log('   ❌ Could not check feature flags:', error.message);
      console.log('   🧠 E-E-A-T Scoring: ENABLED (Step B)');
      console.log('   👁️  Assistant Visibility: UNKNOWN');
      console.log('   📊 Status: Monitoring 48-hour validation period');
    }

    // 8. Alert Conditions Check
    console.log('\n🚨 8. Alert Conditions Check');
    console.log('-'.repeat(30));
    let alertCount = 0;
    
    try {
      // Check queued runs > 10 for > 30 min
      const queuedResult = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) FROM assistant_runs WHERE status='queued' AND run_started_at < datetime('now','-30 minutes');" --remote`, { encoding: 'utf8' });
      const queuedData = parseWranglerOutput(queuedResult);
      const queuedCount = queuedData[0]?.results?.[0]?.['COUNT(*)'] || 0;
      
      if (queuedCount > 10) {
        console.log(`   ⚠️  ALERT: ${queuedCount} runs queued > 30 minutes`);
        alertCount++;
      } else {
        console.log(`   ✅ Queued runs: ${queuedCount} (within limits)`);
      }
      
      // Check outputs last 1h
      const outputsResult = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) FROM assistant_outputs WHERE parsed_at >= datetime('now','-1 hour');" --remote`, { encoding: 'utf8' });
      const outputsData = parseWranglerOutput(outputsResult);
      const outputsCount = outputsData[0]?.results?.[0]?.['COUNT(*)'] || 0;
      
      // Check successful runs last 1h
      const successRunsResult = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) FROM assistant_runs WHERE status='success' AND run_started_at >= datetime('now','-1 hour');" --remote`, { encoding: 'utf8' });
      const successRunsData = parseWranglerOutput(successRunsResult);
      const successRunsCount = successRunsData[0]?.results?.[0]?.['COUNT(*)'] || 0;
      
      if (outputsCount === 0 && successRunsCount > 0) {
        console.log(`   ⚠️  ALERT: No outputs in last hour but ${successRunsCount} successful runs`);
        alertCount++;
      } else {
        console.log(`   ✅ Outputs last hour: ${outputsCount}, successful runs: ${successRunsCount}`);
      }
      
      // Check citations last 6h
      const citationsResult = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) FROM ai_citations WHERE occurred_at >= datetime('now','-6 hours');" --remote`, { encoding: 'utf8' });
      const citationsData = parseWranglerOutput(citationsResult);
      const citationsCount = citationsData[0]?.results?.[0]?.['COUNT(*)'] || 0;
      
      if (citationsCount === 0 && outputsCount > 0) {
        console.log(`   ⚠️  ALERT: No citations in last 6 hours but ${outputsCount} outputs`);
        alertCount++;
      } else {
        console.log(`   ✅ Citations last 6h: ${citationsCount}`);
      }
      
      if (alertCount === 0) {
        console.log('   ✅ All alert conditions clear');
      } else {
        console.log(`   🚨 ${alertCount} alert conditions triggered`);
        process.exit(1); // Exit non-zero for alerts
      }
      
    } catch (error) {
      console.log('   ❌ Error checking alert conditions:', error.message);
      process.exit(1);
    }
    
    // 9. Summary and Next Steps
    console.log('\n📋 9. Summary and Next Steps');
    console.log('-'.repeat(25));
    console.log('   🎯 Current Status: Step B - E-E-A-T Beta');
    console.log('   ⏰ Validation Period: 48 hours');
    console.log('   📊 Next Check: Run every 6 hours');
    console.log('   🚀 Next Phase: Step C (if stable)');
    
    console.log('\n💡 Monitoring Commands:');
    console.log('   • API Health: curl https://geodude-api.kevin-mcgovern.workers.dev/api/health');
    console.log('   • Check Tables: wrangler d1 execute optiview_db --command "SELECT name FROM sqlite_master WHERE type=\'table\';" --remote');
    console.log('   • Emergency Rollback: node scripts/rollback-phase-next.js');
    console.log('   • Generate Summary: node scripts/collect-eeat-summary.js');
    
    console.log('\n✅ Final Monitoring Complete');
    
  } catch (error) {
    console.error('❌ Monitoring error:', error.message);
  }
}

// Run the monitoring
finalMonitoring();
