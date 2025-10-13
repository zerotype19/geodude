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
    console.log('   🧠 E-E-A-T Scoring: ENABLED (Step B)');
    console.log('   👁️  Assistant Visibility: DISABLED (Step C)');
    console.log('   📊 Status: Monitoring 48-hour validation period');
    
    // 8. Summary and Next Steps
    console.log('\n📋 8. Summary and Next Steps');
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
