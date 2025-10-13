#!/usr/bin/env node
/**
 * Setup Premium Projects for Step C
 * Creates premium-only list in KV for Assistant Visibility
 */

const { execSync } = require('child_process');

async function setupPremiumProjects() {
  console.log('🎯 Setting up Premium Projects for Step C...');
  
  try {
    // Create premium projects configuration
    const premiumConfig = {
      enabled_projects: ["prj_demo1", "prj_UHoetismrowc"],
      created_at: new Date().toISOString(),
      phase: "Step C - Assistant Visibility Beta",
      features: [
        "assistant_visibility",
        "mva_calculation",
        "citation_tracking",
        "screenshot_capture"
      ],
      rate_limits: {
        runs_per_day: 50,
        screenshots_per_run: 10,
        citations_per_run: 20
      }
    };
    
    console.log('1️⃣  Creating premium projects configuration...');
    console.log(`   Projects: ${premiumConfig.enabled_projects.join(', ')}`);
    
    // Store in KV
    const configJson = JSON.stringify(premiumConfig, null, 2);
    execSync(`wrangler kv key put "premium_projects" '${configJson}' --binding ASSISTANT_SCHEDULES --remote`, { stdio: 'inherit' });
    
    console.log('   ✅ Premium projects configuration stored in KV');
    
    // Verify storage
    console.log('\n2️⃣  Verifying configuration...');
    const verifyResult = execSync('wrangler kv key get "premium_projects" --binding ASSISTANT_SCHEDULES --remote', { encoding: 'utf8' });
    const storedConfig = JSON.parse(verifyResult);
    
    if (storedConfig.enabled_projects.length === premiumConfig.enabled_projects.length) {
      console.log('   ✅ Configuration verified successfully');
    } else {
      console.log('   ⚠️  Configuration verification failed');
    }
    
    // Create test project if it doesn't exist
    console.log('\n3️⃣  Preparing test projects...');
    console.log('   ℹ️  Ensure test projects exist in your system:');
    premiumConfig.enabled_projects.forEach(projectId => {
      console.log(`      - ${projectId}`);
    });
    
    console.log('\n✅ Premium Projects Setup Complete!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Verify test projects exist in your system');
    console.log('   2. Test Perplexity and ChatGPT endpoints');
    console.log('   3. Enable FEATURE_ASSISTANT_VISIBILITY=true');
    console.log('   4. Deploy and test with premium projects');
    
  } catch (error) {
    console.error('❌ Error setting up premium projects:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupPremiumProjects();
