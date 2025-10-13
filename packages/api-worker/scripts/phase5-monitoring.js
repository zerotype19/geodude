#!/usr/bin/env node
// Phase 5 Analytics Monitoring Script
// Monitors visibility scores, rankings, and GEO index data

const { execSync } = require('child_process');

async function monitorPhase5() {
  console.log('=== Phase 5 Analytics Monitoring ===');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('==================================================\n');
  
  try {
    // 1. Check if Phase 5 tables exist
    console.log('🔍 1. Checking Phase 5 Tables');
    console.log('-------------------------');
    const tablesResult = execSync('wrangler d1 execute optiview_db --command "SELECT name FROM sqlite_master WHERE type=\'table\' AND (name LIKE \'ai_visibility%\' OR name LIKE \'ai_geo%\' OR name LIKE \'ai_alert%\') ORDER BY name;" --remote', { encoding: 'utf8' });
    console.log(tablesResult);
    
    // 2. Check visibility scores
    console.log('📊 2. Checking Visibility Scores');
    console.log('-------------------------');
    const scoresResult = execSync('wrangler d1 execute optiview_db --command "SELECT COUNT(*) as count, MAX(day) as latest, MIN(day) as earliest FROM ai_visibility_scores;" --remote', { encoding: 'utf8' });
    console.log(scoresResult);
    
    // 3. Check rankings
    console.log('🏆 3. Checking Rankings');
    console.log('-------------------------');
    const rankingsResult = execSync('wrangler d1 execute optiview_db --command "SELECT COUNT(*) as count, MAX(week_start) as latest, MIN(week_start) as earliest FROM ai_visibility_rankings;" --remote', { encoding: 'utf8' });
    console.log(rankingsResult);
    
    // 4. Check GEO index
    console.log('🌐 4. Checking GEO Index');
    console.log('-------------------------');
    const geoResult = execSync('wrangler d1 execute optiview_db --command "SELECT COUNT(*) as count, MAX(measured_at) as latest, MIN(measured_at) as earliest FROM ai_geo_index;" --remote', { encoding: 'utf8' });
    console.log(geoResult);
    
    // 5. Check alerts
    console.log('🚨 5. Checking Alerts');
    console.log('-------------------------');
    const alertsResult = execSync('wrangler d1 execute optiview_db --command "SELECT COUNT(*) as count, type, severity, COUNT(CASE WHEN resolved = 0 THEN 1 END) as unresolved FROM ai_alerts WHERE day >= date(\'now\', \'-7 days\') GROUP BY type, severity ORDER BY count DESC;" --remote', { encoding: 'utf8' });
    console.log(alertsResult);
    
    // 6. Test API endpoints
    console.log('🔌 6. Testing API Endpoints');
    console.log('-------------------------');
    
    // Test visibility score endpoint
    try {
      const scoreResponse = execSync('curl -s "https://geodude-api.kevin-mcgovern.workers.dev/api/visibility/score?domain=example.com"', { encoding: 'utf8' });
      console.log('✅ Score API:', scoreResponse.substring(0, 200) + '...');
    } catch (error) {
      console.log('❌ Score API not available or error:', error.message);
    }
    
    // Test rankings endpoint
    try {
      const rankingsResponse = execSync('curl -s "https://geodude-api.kevin-mcgovern.workers.dev/api/visibility/rankings?assistant=perplexity&limit=5"', { encoding: 'utf8' });
      console.log('✅ Rankings API:', rankingsResponse.substring(0, 200) + '...');
    } catch (error) {
      console.log('❌ Rankings API not available or error:', error.message);
    }
    
    // Test drift endpoint
    try {
      const driftResponse = execSync('curl -s "https://geodude-api.kevin-mcgovern.workers.dev/api/visibility/drift?domain=example.com"', { encoding: 'utf8' });
      console.log('✅ Drift API:', driftResponse.substring(0, 200) + '...');
    } catch (error) {
      console.log('❌ Drift API not available or error:', error.message);
    }
    
    // Test GEO index endpoint
    try {
      const geoResponse = execSync('curl -s "https://geodude-api.kevin-mcgovern.workers.dev/api/geo-index?domain=example.com"', { encoding: 'utf8' });
      console.log('✅ GEO Index API:', geoResponse.substring(0, 200) + '...');
    } catch (error) {
      console.log('❌ GEO Index API not available or error:', error.message);
    }
    
    // Test alerts endpoint
    try {
      const alertsResponse = execSync('curl -s "https://geodude-api.kevin-mcgovern.workers.dev/api/visibility/alerts?limit=5"', { encoding: 'utf8' });
      console.log('✅ Alerts API:', alertsResponse.substring(0, 200) + '...');
    } catch (error) {
      console.log('❌ Alerts API not available or error:', error.message);
    }
    
    // 7. Check feature flag status
    console.log('\n🚩 7. Feature Flag Status');
    console.log('-------------------------');
    try {
      const healthResponse = execSync('curl -s "https://geodude-api.kevin-mcgovern.workers.dev/api/health"', { encoding: 'utf8' });
      const health = JSON.parse(healthResponse);
      console.log('API Health:', health.ok ? '✅ HEALTHY' : '❌ UNHEALTHY');
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
    }
    
    // 8. Sample data analysis
    console.log('\n📈 8. Sample Data Analysis');
    console.log('-------------------------');
    
    // Top domains by visibility score
    try {
      const topDomainsResult = execSync('wrangler d1 execute optiview_db --command "SELECT domain, assistant, score_0_100, citations_count FROM ai_visibility_scores ORDER BY score_0_100 DESC LIMIT 10;" --remote', { encoding: 'utf8' });
      console.log('Top 10 domains by visibility score:');
      console.log(topDomainsResult);
    } catch (error) {
      console.log('❌ Could not fetch top domains:', error.message);
    }
    
    // Recent alerts
    try {
      const recentAlertsResult = execSync('wrangler d1 execute optiview_db --command "SELECT type, severity, message, created_at FROM ai_alerts WHERE day >= date(\'now\', \'-3 days\') ORDER BY created_at DESC LIMIT 5;" --remote', { encoding: 'utf8' });
      console.log('\nRecent alerts (last 3 days):');
      console.log(recentAlertsResult);
    } catch (error) {
      console.log('❌ Could not fetch recent alerts:', error.message);
    }
    
    console.log('\n✅ Phase 5 Monitoring Complete');
    console.log('==================================================');
    
  } catch (error) {
    console.error('❌ Phase 5 monitoring failed:', error.message);
    process.exit(1);
  }
}

// Run monitoring
monitorPhase5().catch(console.error);
