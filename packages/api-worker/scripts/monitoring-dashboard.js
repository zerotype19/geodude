#!/usr/bin/env node
/**
 * Phase Next Monitoring Dashboard
 * Comprehensive monitoring for 48-hour validation period
 */

const { execSync } = require('child_process');

async function monitoringDashboard() {
  console.log('📊 Phase Next Monitoring Dashboard');
  console.log('📅', new Date().toISOString());
  console.log('⏰ Phase: Step B - E-E-A-T Beta (48-hour validation)');
  console.log('=' .repeat(60));
  
  try {
    // 1. API Health Check
    console.log('\n🔍 1. API Health Check');
    console.log('-'.repeat(30));
    try {
      const healthResponse = execSync('curl -s "https://geodude-api.kevin-mcgovern.workers.dev/api/health"', { encoding: 'utf8' });
      const health = JSON.parse(healthResponse);
      console.log(`   ✅ API Status: ${health.ok ? 'HEALTHY' : 'UNHEALTHY'}`);
      console.log(`   📊 Service: ${health.service}`);
      console.log(`   🔢 Version: ${health.version}`);
    } catch (error) {
      console.log('   ❌ API Health Check Failed');
    }
    
    // 2. Feature Flags Status
    console.log('\n🚩 2. Feature Flags Status');
    console.log('-'.repeat(30));
    try {
      // Check if E-E-A-T scoring is enabled by looking at recent audit data
      const flagsQuery = `
        SELECT 
          COUNT(*) as recent_audits,
          COUNT(CASE WHEN pillar = 'authority_safety' THEN 1 END) as eeat_audits
        FROM audit_results 
        WHERE created_at > datetime('now','-1 hour');
      `;
      
      const flagsResult = execSync(`wrangler d1 execute optiview_db --command "${flagsQuery}" --remote`, { 
        encoding: 'utf8',
        timeout: 10000
      });
      const flagsData = JSON.parse(flagsResult);
      const flags = flagsData[0]?.results?.[0];
      
      if (flags) {
        console.log(`   📊 Recent audits (1h): ${flags.recent_audits}`);
        console.log(`   🧠 E-E-A-T audits: ${flags.eeat_audits}`);
        
        if (flags.eeat_audits > 0) {
          console.log('   ✅ E-E-A-T scoring active');
        } else if (flags.recent_audits > 0) {
          console.log('   ⚠️  E-E-A-T scoring may not be active');
        } else {
          console.log('   ℹ️  No recent audit activity');
        }
      } else {
        console.log('   ⚠️  Could not check feature flags status');
      }
    } catch (error) {
      console.log('   ⚠️  Could not check feature flags status');
    }
    
    // 3. E-E-A-T Processing Check
    console.log('\n🧠 3. E-E-A-T Processing Check');
    console.log('-'.repeat(30));
    try {
      const eeatQuery = `
        SELECT 
          COUNT(*) as total_audits,
          COUNT(CASE WHEN pillar = 'authority_safety' THEN 1 END) as eeat_audits,
          AVG(CASE WHEN pillar = 'authority_safety' THEN score END) as avg_eeat_score
        FROM audit_results 
        WHERE created_at > datetime('now','-6 hours');
      `;
      
      const eeatResult = execSync(`wrangler d1 execute optiview_db --command "${eeatQuery}" --remote`, { 
        encoding: 'utf8',
        timeout: 10000 // 10 second timeout
      });
      const eeatData = JSON.parse(eeatResult);
      const eeat = eeatData[0]?.results?.[0];
      
      if (eeat) {
        console.log(`   📊 Total audits (6h): ${eeat.total_audits}`);
        console.log(`   🧠 E-E-A-T audits: ${eeat.eeat_audits}`);
        if (eeat.avg_eeat_score) {
          console.log(`   📈 Avg E-E-A-T score: ${Math.round(eeat.avg_eeat_score * 100) / 100}`);
        }
        
        if (eeat.eeat_audits > 0) {
          console.log('   ✅ E-E-A-T processing active');
        } else {
          console.log('   ⚠️  No E-E-A-T audits in last 6 hours');
        }
      } else {
        console.log('   ⚠️  No audit data found');
      }
    } catch (error) {
      console.log('   ❌ E-E-A-T check failed:', error.message);
    }
    
    // 4. Error Rate Analysis
    console.log('\n❌ 4. Error Rate Analysis');
    console.log('-'.repeat(30));
    try {
      const errorQuery = `
        SELECT 
          COUNT(*) as total_audits,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
          SUM(CASE WHEN status = 'error' AND error_message LIKE '%EEAT%' THEN 1 ELSE 0 END) as eeat_errors
        FROM audit_pages 
        WHERE created_at > datetime('now','-6 hours');
      `;
      
      const errorResult = execSync(`wrangler d1 execute optiview_db --command "${errorQuery}" --remote`, { 
        encoding: 'utf8',
        timeout: 10000
      });
      const errorData = JSON.parse(errorResult);
      const error = errorData[0]?.results?.[0];
      
      if (error && error.total_audits > 0) {
        const errorRate = (error.error_count / error.total_audits) * 100;
        const eeatErrorRate = (error.eeat_errors / error.total_audits) * 100;
        
        console.log(`   📊 Total audits: ${error.total_audits}`);
        console.log(`   ❌ Total errors: ${error.error_count} (${Math.round(errorRate * 100) / 100}%)`);
        console.log(`   🧠 E-E-A-T errors: ${error.eeat_errors} (${Math.round(eeatErrorRate * 100) / 100}%)`);
        
        if (errorRate < 1) {
          console.log('   ✅ Error rate within target (<1%)');
        } else {
          console.log('   ⚠️  Error rate above target (≥1%)');
        }
        
        if (eeatErrorRate < 0.5) {
          console.log('   ✅ E-E-A-T error rate within target (<0.5%)');
        } else {
          console.log('   ⚠️  E-E-A-T error rate above target (≥0.5%)');
        }
      } else {
        console.log('   ℹ️  No recent audit data for error analysis');
      }
    } catch (error) {
      console.log('   ❌ Error rate analysis failed');
    }
    
    // 5. Database Growth Check
    console.log('\n💾 5. Database Growth Check');
    console.log('-'.repeat(30));
    try {
      const growthQuery = `
        SELECT 
          COUNT(*) as total_pages,
          COUNT(CASE WHEN created_at > datetime('now','-24 hours') THEN 1 END) as pages_24h,
          COUNT(CASE WHEN created_at > datetime('now','-6 hours') THEN 1 END) as pages_6h
        FROM audit_pages;
      `;
      
      const growthResult = execSync(`wrangler d1 execute optiview_db --command "${growthQuery}" --remote`, { 
        encoding: 'utf8',
        timeout: 10000
      });
      const growthData = JSON.parse(growthResult);
      const growth = growthData[0]?.results?.[0];
      
      if (growth) {
        console.log(`   📊 Total pages: ${growth.total_pages}`);
        console.log(`   📈 Pages (24h): ${growth.pages_24h}`);
        console.log(`   📈 Pages (6h): ${growth.pages_6h}`);
        
        const growthRate = growth.pages_24h / 24; // pages per hour
        console.log(`   📊 Growth rate: ${Math.round(growthRate * 100) / 100} pages/hour`);
        
        if (growthRate < 10) {
          console.log('   ✅ Database growth within normal range');
        } else {
          console.log('   ⚠️  High database growth rate detected');
        }
      } else {
        console.log('   ⚠️  No database growth data available');
      }
    } catch (error) {
      console.log('   ❌ Database growth check failed');
    }
    
    // 6. Performance Metrics
    console.log('\n⚡ 6. Performance Metrics');
    console.log('-'.repeat(30));
    try {
      const perfQuery = `
        SELECT 
          AVG(processing_time_ms) as avg_processing_time,
          MAX(processing_time_ms) as max_processing_time,
          COUNT(*) as audit_count
        FROM audit_pages 
        WHERE created_at > datetime('now','-6 hours')
        AND processing_time_ms IS NOT NULL;
      `;
      
      const perfResult = execSync(`wrangler d1 execute optiview_db --command "${perfQuery}" --remote`, { 
        encoding: 'utf8',
        timeout: 10000
      });
      const perfData = JSON.parse(perfResult);
      const perf = perfData[0]?.results?.[0];
      
      if (perf && perf.audit_count > 0) {
        console.log(`   ⏱️  Avg processing time: ${Math.round(perf.avg_processing_time)}ms`);
        console.log(`   ⏱️  Max processing time: ${perf.max_processing_time}ms`);
        console.log(`   📊 Audits analyzed: ${perf.audit_count}`);
        
        if (perf.avg_processing_time < 30000) { // 30 seconds
          console.log('   ✅ Processing time within target (<30s)');
        } else {
          console.log('   ⚠️  Processing time above target (≥30s)');
        }
      } else {
        console.log('   ℹ️  No performance data available');
      }
    } catch (error) {
      console.log('   ❌ Performance metrics check failed');
    }
    
    // 7. KV Status Check
    console.log('\n🗄️ 7. KV Status Check');
    console.log('-'.repeat(30));
    try {
      const kvCheck = execSync('wrangler kv key list --binding PROMPT_PACKS --remote', { encoding: 'utf8' });
      const kvLines = kvCheck.trim().split('\n').length - 1; // Subtract header line
      console.log(`   📊 Prompt packs: ${kvLines} keys`);
      
      if (kvLines > 0) {
        console.log('   ✅ KV storage operational');
      } else {
        console.log('   ⚠️  No KV data found');
      }
    } catch (error) {
      console.log('   ❌ KV status check failed');
    }
    
    // 8. Summary and Recommendations
    console.log('\n📋 8. Summary and Recommendations');
    console.log('-'.repeat(30));
    console.log('   🎯 Current Status: Step B - E-E-A-T Beta');
    console.log('   ⏰ Validation Period: 48 hours');
    console.log('   📊 Next Check: Run this script every 6 hours');
    console.log('   🚀 Next Phase: Step C - Assistant Visibility (if stable)');
    
    console.log('\n💡 Monitoring Commands:');
    console.log('   • Check logs: wrangler tail | grep "EEAT"');
    console.log('   • Run drift check: node scripts/monitor-scoring-drift.js');
    console.log('   • Generate summary: node scripts/collect-eeat-summary.js');
    console.log('   • Emergency rollback: node scripts/rollback-phase-next.js');
    
    console.log('\n✅ Monitoring Dashboard Complete');
    
  } catch (error) {
    console.error('❌ Monitoring dashboard error:', error.message);
  }
}

// Run the dashboard
monitoringDashboard();
