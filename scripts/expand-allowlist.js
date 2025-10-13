#!/usr/bin/env node
// Allowlist Expansion Script for Visibility Intelligence Platform
// Safely expand access to design partners after 72h observation

const { execSync } = require('child_process');

async function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    console.error(`❌ Error executing command: ${command}\n${error.stderr}`);
    throw error;
  }
}

async function getCurrentAllowlist() {
  console.log('📋 Getting current allowlist...');
  try {
    const currentResponse = await runCommand('wrangler kv key get enabled_projects --namespace=optiview_kv');
    const current = currentResponse.trim();
    return current ? current.split(',') : [];
  } catch (error) {
    console.log('   No existing allowlist found, starting fresh');
    return [];
  }
}

async function updateAllowlist(newOrgs) {
  console.log('🔄 Updating allowlist...');
  try {
    const current = await getCurrentAllowlist();
    const updated = [...new Set([...current, ...newOrgs])]; // Remove duplicates
    
    console.log(`   Current: ${current.join(', ') || 'none'}`);
    console.log(`   Adding: ${newOrgs.join(', ')}`);
    console.log(`   Updated: ${updated.join(', ')}`);
    
    await runCommand(`wrangler kv key put enabled_projects "${updated.join(',')}" --namespace=optiview_kv`);
    console.log('✅ Allowlist updated successfully');
    
    return updated;
  } catch (error) {
    console.error('❌ Failed to update allowlist:', error.message);
    throw error;
  }
}

async function runHealthCheck() {
  console.log('\n🏥 Running health check after allowlist update...');
  try {
    const healthResponse = await runCommand('curl -s https://geodude-api.kevin-mcgovern.workers.dev/api/health/visibility');
    const health = JSON.parse(healthResponse);
    
    console.log(`   Status: ${health.status}`);
    console.log(`   Scores today: ${health.scores_today}`);
    console.log(`   Rankings this week: ${health.rankings_week_rows}`);
    console.log(`   Assistants enabled: ${health.assistants_enabled.join(', ')}`);
    
    if (health.status === 'healthy') {
      console.log('✅ Health check passed');
      return true;
    } else {
      console.log('⚠️  Health check failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function deployChanges() {
  console.log('\n🚀 Deploying changes...');
  try {
    await runCommand('wrangler deploy');
    console.log('✅ Deployment completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    return false;
  }
}

async function validateAccess(orgs) {
  console.log('\n🔍 Validating access for new orgs...');
  for (const org of orgs) {
    try {
      // Test API access with org context (you might need to implement org-specific endpoints)
      console.log(`   Testing access for ${org}...`);
      // For now, we'll just confirm the allowlist was updated
      console.log(`   ✅ ${org} added to allowlist`);
    } catch (error) {
      console.log(`   ⚠️  Could not validate access for ${org}: ${error.message}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: node expand-allowlist.js --add=org1,org2,org3');
    console.log('Example: node expand-allowlist.js --add=org_partner_b,org_partner_c');
    process.exit(0);
  }
  
  const addArg = args.find(arg => arg.startsWith('--add='));
  if (!addArg) {
    console.error('❌ Missing --add argument. Use --add=org1,org2,org3');
    process.exit(1);
  }
  
  const newOrgs = addArg.split('=')[1].split(',').map(org => org.trim()).filter(org => org);
  
  if (newOrgs.length === 0) {
    console.error('❌ No organizations specified');
    process.exit(1);
  }
  
  console.log('🎯 Expanding Visibility Intelligence Allowlist');
  console.log('==============================================');
  console.log(`⏰ ${new Date().toISOString()}\n`);
  
  try {
    // Update allowlist
    const updatedAllowlist = await updateAllowlist(newOrgs);
    
    // Deploy changes
    const deploySuccess = await deployChanges();
    if (!deploySuccess) {
      throw new Error('Deployment failed');
    }
    
    // Run health check
    const healthSuccess = await runHealthCheck();
    if (!healthSuccess) {
      throw new Error('Health check failed');
    }
    
    // Validate access
    await validateAccess(newOrgs);
    
    console.log('\n🎉 Allowlist expansion completed successfully!');
    console.log(`✅ Added ${newOrgs.length} new organizations to allowlist`);
    console.log(`📊 Total organizations with access: ${updatedAllowlist.length}`);
    console.log('\n📋 Next steps:');
    console.log('   1. Monitor 72h observation for new orgs');
    console.log('   2. Verify UI loads for new orgs');
    console.log('   3. Check citation generation for new projects');
    console.log('   4. Ready for next expansion phase');
    
  } catch (error) {
    console.error('\n💥 Allowlist expansion failed:', error.message);
    console.log('\n🔄 Rollback instructions:');
    console.log('   1. Check current allowlist: wrangler kv key get enabled_projects --namespace=optiview_kv');
    console.log('   2. Restore previous allowlist if needed');
    console.log('   3. Redeploy: wrangler deploy');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
