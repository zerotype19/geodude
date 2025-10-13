#!/usr/bin/env node

/**
 * Live Verification Script - 72h Observation
 * Monitors ChatGPT + Claude connectors for stability
 */

const API_BASE = 'https://geodude-api.kevin-mcgovern.workers.dev';

async function runHealthCheck() {
  try {
    const response = await fetch(`${API_BASE}/api/health/visibility`);
    const health = await response.json();
    
    console.log(`[${new Date().toISOString()}] Health Check:`);
    console.log(`  Status: ${health.status}`);
    console.log(`  Assistants: ${health.assistants_enabled?.join(', ')}`);
    console.log(`  Scores Today: ${health.scores_today}`);
    console.log(`  Last Rollup: ${health.last_rollup_at}`);
    
    // Check if rollup is fresh (within 6 hours)
    const lastRollup = new Date(health.last_rollup_at);
    const hoursSinceRollup = (Date.now() - lastRollup.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceRollup > 6) {
      console.log(`  ⚠️  WARNING: Rollup gap ${hoursSinceRollup.toFixed(1)}h > 6h`);
      return { status: 'warning', message: 'Rollup gap too large' };
    }
    
    return { status: 'healthy', message: 'All systems operational' };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Health check failed:`, error.message);
    return { status: 'error', message: error.message };
  }
}

async function checkCostUtilization() {
  try {
    const response = await fetch(`${API_BASE}/api/visibility/cost`);
    const cost = await response.json();
    
    console.log(`[${new Date().toISOString()}] Cost Check:`);
    console.log(`  Daily Cost: $${cost.daily_cost_usd?.toFixed(2) || '0.00'}`);
    console.log(`  Cost Cap: $${cost.cost_cap_usd}`);
    console.log(`  Utilization: ${((cost.daily_cost_usd / cost.cost_cap_usd) * 100).toFixed(1)}%`);
    
    const utilization = (cost.daily_cost_usd / cost.cost_cap_usd) * 100;
    if (utilization > 80) {
      console.log(`  ⚠️  WARNING: Cost utilization ${utilization.toFixed(1)}% > 80%`);
      return { status: 'warning', message: 'Cost cap approaching' };
    }
    
    return { status: 'healthy', message: 'Cost utilization normal' };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Cost check failed:`, error.message);
    return { status: 'error', message: error.message };
  }
}

async function validateConnectorHealth() {
  const assistants = ['perplexity', 'chatgpt_search', 'claude'];
  const results = {};
  
  for (const assistant of assistants) {
    try {
      const response = await fetch(`${API_BASE}/api/visibility/rankings?assistant=${assistant}&period=7d&limit=1`);
      const data = await response.json();
      
      const hasData = data.rankings && data.rankings.length > 0;
      results[assistant] = hasData ? 'healthy' : 'no_data';
      
      console.log(`[${new Date().toISOString()}] ${assistant}: ${hasData ? '✅' : '⚠️'} ${hasData ? 'Has rankings data' : 'No rankings data'}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ${assistant} check failed:`, error.message);
      results[assistant] = 'error';
    }
  }
  
  const healthyCount = Object.values(results).filter(status => status === 'healthy').length;
  const allHealthy = healthyCount === assistants.length;
  
  return { 
    status: allHealthy ? 'healthy' : 'warning', 
    message: `${healthyCount}/${assistants.length} connectors healthy`,
    details: results
  };
}

async function main() {
  console.log(`\n=== Live Verification Report - ${new Date().toISOString()} ===\n`);
  
  const health = await runHealthCheck();
  console.log('');
  
  const cost = await checkCostUtilization();
  console.log('');
  
  const connectors = await validateConnectorHealth();
  console.log('');
  
  // Summary
  console.log('=== SUMMARY ===');
  console.log(`Health: ${health.status.toUpperCase()}`);
  console.log(`Cost: ${cost.status.toUpperCase()}`);
  console.log(`Connectors: ${connectors.status.toUpperCase()}`);
  
  const overallHealthy = [health, cost, connectors].every(r => r.status === 'healthy');
  console.log(`\nOverall Status: ${overallHealthy ? '✅ HEALTHY' : '⚠️  ISSUES DETECTED'}`);
  
  if (!overallHealthy) {
    console.log('\nIssues to investigate:');
    [health, cost, connectors].forEach((result, i) => {
      if (result.status !== 'healthy') {
        console.log(`  - ${['Health', 'Cost', 'Connectors'][i]}: ${result.message}`);
      }
    });
  }
  
  console.log('\n=== END REPORT ===\n');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runHealthCheck, checkCostUtilization, validateConnectorHealth };
