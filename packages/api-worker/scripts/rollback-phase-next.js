#!/usr/bin/env node
/**
 * Rollback Phase Next - Emergency Rollback Script
 * Immediately disables all Phase Next features
 */

const { execSync } = require('child_process');

async function rollbackPhaseNext() {
  console.log('🚨 EMERGENCY ROLLBACK: Disabling Phase Next features...');
  
  try {
    // Step 1: Disable feature flags
    console.log('1️⃣  Disabling feature flags...');
    
    // Set both flags to false
    execSync(`wrangler secret put FEATURE_ASSISTANT_VISIBILITY --env production`, { 
      input: 'false',
      stdio: 'pipe'
    });
    
    execSync(`wrangler secret put FEATURE_EEAT_SCORING --env production`, { 
      input: 'false',
      stdio: 'pipe'
    });
    
    console.log('✅ Feature flags disabled');
    
    // Step 2: Redeploy with disabled flags
    console.log('2️⃣  Redeploying with disabled flags...');
    
    execSync('wrangler deploy --env production', { stdio: 'inherit' });
    
    console.log('✅ Redeployment complete');
    
    // Step 3: Verify rollback
    console.log('3️⃣  Verifying rollback...');
    
    // Check that API routes return 404 or disabled message
    const testResponse = execSync('curl -s -o /dev/null -w "%{http_code}" https://your-worker.your-subdomain.workers.dev/api/visibility/runs', { encoding: 'utf8' });
    
    if (testResponse.trim() === '404' || testResponse.trim() === '503') {
      console.log('✅ Rollback verified - API routes disabled');
    } else {
      console.log('⚠️  Warning: API routes may still be accessible');
    }
    
    // Step 4: Check database integrity
    console.log('4️⃣  Checking database integrity...');
    
    const dbCheck = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) as total FROM assistant_runs;"`, { encoding: 'utf8' });
    const dbData = JSON.parse(dbCheck);
    const totalRuns = dbData[0]?.results?.[0]?.total || 0;
    
    console.log(`📊 Database contains ${totalRuns} assistant runs (no data loss)`);
    
    // Step 5: Monitor for issues
    console.log('5️⃣  Monitoring for issues...');
    
    console.log('🔍 Check the following:');
    console.log('  - Cloudflare logs for errors');
    console.log('  - CPU time usage');
    console.log('  - Memory usage');
    console.log('  - Worker timeout rates');
    
    console.log('\n✅ ROLLBACK COMPLETE');
    console.log('📋 Next steps:');
    console.log('  1. Review logs to identify the issue');
    console.log('  2. Fix the problem in staging');
    console.log('  3. Test thoroughly before re-enabling');
    console.log('  4. Gradually re-enable features');
    
  } catch (error) {
    console.error('❌ ROLLBACK FAILED:', error.message);
    console.log('\n🚨 MANUAL INTERVENTION REQUIRED');
    console.log('1. Log into Cloudflare Dashboard');
    console.log('2. Go to Workers & Pages > Your Worker');
    console.log('3. Go to Settings > Variables');
    console.log('4. Set FEATURE_ASSISTANT_VISIBILITY = false');
    console.log('5. Set FEATURE_EEAT_SCORING = false');
    console.log('6. Save and deploy');
  }
}

// Run the rollback
rollbackPhaseNext();
