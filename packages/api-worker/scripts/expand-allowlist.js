#!/usr/bin/env node

/**
 * Allowlist Expansion Script
 * 
 * Safely expands the allowlist after 48-hour observation period
 * 
 * Usage: node scripts/expand-allowlist.js --add project1,project2,project3
 */

const { execSync } = require('child_process');

async function expandAllowlist() {
  const args = process.argv.slice(2);
  const addFlag = args.find(arg => arg.startsWith('--add='));
  
  if (!addFlag) {
    console.log('Usage: node scripts/expand-allowlist.js --add=project1,project2,project3');
    process.exit(1);
  }
  
  const newProjects = addFlag.split('=')[1].split(',');
  
  console.log('🚀 Allowlist Expansion');
  console.log('📅 Started:', new Date().toISOString());
  console.log('='.repeat(40));
  
  try {
    // 1. Get current allowlist
    console.log('\n📋 1. Current Allowlist');
    console.log('-'.repeat(25));
    
    const currentResult = execSync(`wrangler kv:key get enabled_projects --binding=PROMPT_PACKS`, { encoding: 'utf8' });
    const currentProjects = currentResult ? JSON.parse(currentResult) : [];
    
    console.log(`   Current projects: ${currentProjects.length}`);
    console.log(`   Projects: ${currentProjects.join(', ')}`);
    
    // 2. Validate new projects
    console.log('\n✅ 2. Validating New Projects');
    console.log('-'.repeat(30));
    
    const validProjects = [];
    for (const project of newProjects) {
      if (project.trim() && project.startsWith('prj_')) {
        validProjects.push(project.trim());
        console.log(`   ✅ ${project.trim()}`);
      } else {
        console.log(`   ❌ ${project.trim()} (invalid format)`);
      }
    }
    
    if (validProjects.length === 0) {
      console.log('   ❌ No valid projects to add');
      process.exit(1);
    }
    
    // 3. Check for duplicates
    console.log('\n🔍 3. Checking for Duplicates');
    console.log('-'.repeat(30));
    
    const duplicates = validProjects.filter(project => currentProjects.includes(project));
    if (duplicates.length > 0) {
      console.log(`   ⚠️  Duplicates found: ${duplicates.join(', ')}`);
      console.log('   Removing duplicates...');
    }
    
    const uniqueNewProjects = validProjects.filter(project => !currentProjects.includes(project));
    console.log(`   New unique projects: ${uniqueNewProjects.length}`);
    
    // 4. Create expanded allowlist
    console.log('\n📝 4. Creating Expanded Allowlist');
    console.log('-'.repeat(30));
    
    const expandedProjects = [...currentProjects, ...uniqueNewProjects];
    console.log(`   Total projects: ${expandedProjects.length}`);
    console.log(`   New projects: ${uniqueNewProjects.join(', ')}`);
    
    // 5. Update KV store
    console.log('\n💾 5. Updating KV Store');
    console.log('-'.repeat(25));
    
    execSync(`wrangler kv:key put enabled_projects '${JSON.stringify(expandedProjects)}' --binding=PROMPT_PACKS`, { stdio: 'inherit' });
    console.log('   ✅ KV store updated');
    
    // 6. Test new projects
    console.log('\n🧪 6. Testing New Projects');
    console.log('-'.repeat(25));
    
    for (const project of uniqueNewProjects) {
      console.log(`   Testing ${project}...`);
      
      try {
        const testResponse = await fetch('https://geodude-api.kevin-mcgovern.workers.dev/api/visibility/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project,
            assistant: 'perplexity',
            prompts: [{
              text: 'What is generative engine optimization?',
              intentTag: 'test'
            }]
          })
        });
        
        if (testResponse.ok) {
          const result = await testResponse.json();
          console.log(`   ✅ ${project}: Run created (${result.runId})`);
        } else {
          console.log(`   ❌ ${project}: Failed to create run`);
        }
      } catch (error) {
        console.log(`   ❌ ${project}: Error - ${error.message}`);
      }
    }
    
    // 7. Summary
    console.log('\n📊 7. Expansion Summary');
    console.log('-'.repeat(25));
    console.log(`   ✅ Added: ${uniqueNewProjects.length} projects`);
    console.log(`   📊 Total: ${expandedProjects.length} projects`);
    console.log(`   🧪 Tested: ${uniqueNewProjects.length} projects`);
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Monitor new projects for 24 hours');
    console.log('   2. Verify citations are flowing');
    console.log('   3. Check MVA metrics are populating');
    console.log('   4. Tag v0.9.1-phase-next-c-stabilized');
    console.log('   5. Begin Phase 4 planning');
    
    console.log('\n✅ Allowlist Expansion Complete');
    
  } catch (error) {
    console.error('❌ Error expanding allowlist:', error.message);
    process.exit(1);
  }
}

// Run the expansion
expandAllowlist();
