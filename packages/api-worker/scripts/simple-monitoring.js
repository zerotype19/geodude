#!/usr/bin/env node
/**
 * Simple Phase Next Monitoring Script
 * Quick health check without complex queries
 */

const { execSync } = require('child_process');

async function simpleMonitoring() {
  console.log('📊 Phase Next Simple Monitoring');
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
      const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%assistant%' OR name LIKE '%ai_%';";
      const tablesResult = execSync(`wrangler d1 execute optiview_db --command "${tablesQuery}" --remote`, { 
        encoding: 'utf8',
        timeout: 10000
      });
      const tablesData = JSON.parse(tablesResult);
      const tables = tablesData[0]?.results || [];
      
      console.log(`   ✅ Phase Next tables: ${tables.length} found`);
      tables.forEach(table => console.log(`      - ${table.name}`));
      
      if (tables.length >= 5) {
        console.log('   ✅ All required tables present');
      } else {
        console.log('   ⚠️  Some tables may be missing');
      }
    } catch (error) {
      console.log('   ❌ Database check failed');
    }
    
    // 3. Recent Activity Check
    console.log('\n📈 3. Recent Activity Check');
    console.log('-'.repeat(25));
    try {
      const activityQuery = `
        SELECT 
          COUNT(*) as total_pages,
          COUNT(CASE WHEN created_at > datetime('now','-1 hour') THEN 1 END) as pages_1h,
          COUNT(CASE WHEN created_at > datetime('now','-24 hours') THEN 1 END) as pages_24h
        FROM audit_pages;
      `;
      
      const activityResult = execSync(`wrangler d1 execute optiview_db --command "${activityQuery}" --remote`, { 
        encoding: 'utf8',
        timeout: 10000
      });
      const activityData = JSON.parse(activityResult);
      const activity = activityData[0]?.results?.[0];
      
      if (activity) {
        console.log(`   📊 Total pages: ${activity.total_pages}`);
        console.log(`   📈 Pages (1h): ${activity.pages_1h}`);
        console.log(`   📈 Pages (24h): ${activity.pages_24h}`);
        
        if (activity.pages_1h > 0) {
          console.log('   ✅ Recent activity detected');
        } else {
          console.log('   ℹ️  No recent activity (normal for new deployment)');
        }
      } else {
        console.log('   ⚠️  No activity data available');
      }
    } catch (error) {
      console.log('   ❌ Activity check failed');
    }
    
    // 4. Assistant Runs Check
    console.log('\n🤖 4. Assistant Runs Check');
    console.log('-'.repeat(25));
    try {
      const runsQuery = `
        SELECT 
          COUNT(*) as total_runs,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_runs,
          COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_runs
        FROM assistant_runs;
      `;
      
      const runsResult = execSync(`wrangler d1 execute optiview_db --command "${runsQuery}" --remote`, { 
        encoding: 'utf8',
        timeout: 10000
      });
      const runsData = JSON.parse(runsResult);
      const runs = runsData[0]?.results?.[0];
      
      if (runs) {
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
      console.log('   ❌ Assistant runs check failed');
    }
    
    // 5. KV Status Check
    console.log('\n🗄️ 5. KV Status Check');
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
      console.log('   ❌ KV check failed');
    }
    
    // 6. Feature Flags Status (Simple)
    console.log('\n🚩 6. Feature Flags Status');
    console.log('-'.repeat(25));
    console.log('   🧠 E-E-A-T Scoring: ENABLED (Step B)');
    console.log('   👁️  Assistant Visibility: DISABLED (Step C)');
    console.log('   📊 Status: Monitoring 48-hour validation period');
    
    // 7. Summary
    console.log('\n📋 7. Summary');
    console.log('-'.repeat(25));
    console.log('   🎯 Current Status: Step B - E-E-A-T Beta');
    console.log('   ⏰ Validation Period: 48 hours');
    console.log('   📊 Next Check: Run every 6 hours');
    console.log('   🚀 Next Phase: Step C (if stable)');
    
    console.log('\n💡 Quick Commands:');
    console.log('   • API Health: curl https://geodude-api.kevin-mcgovern.workers.dev/api/health');
    console.log('   • Check Tables: wrangler d1 execute optiview_db --command "SELECT name FROM sqlite_master WHERE type=\'table\';" --remote');
    console.log('   • Emergency Rollback: node scripts/rollback-phase-next.js');
    
    console.log('\n✅ Simple Monitoring Complete');
    
  } catch (error) {
    console.error('❌ Monitoring error:', error.message);
  }
}

// Run the monitoring
simpleMonitoring();
