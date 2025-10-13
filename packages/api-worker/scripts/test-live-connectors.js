#!/usr/bin/env node

/**
 * Test Live Connectors
 * 
 * Tests each live connector individually to verify they work
 * 
 * Usage: node scripts/test-live-connectors.js [assistant]
 */

const { execSync } = require('child_process');

async function testConnector(assistant) {
  console.log(`🧪 Testing ${assistant} connector...`);
  
  try {
    const response = await fetch('https://geodude-api.kevin-mcgovern.workers.dev/api/visibility/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'prj_demo1',
        assistant: assistant,
        prompts: [{
          text: 'What is generative engine optimization?',
          intentTag: 'test'
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`   ✅ ${assistant}: Run created (${result.runId})`);
    
    // Wait a moment for processing
    console.log(`   ⏳ Waiting for processing...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if outputs were created
    const outputsResult = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) as count FROM assistant_outputs WHERE prompt_id IN (SELECT id FROM assistant_prompts WHERE run_id = '${result.runId}');" --remote`, { encoding: 'utf8' });
    const outputsData = JSON.parse(outputsResult);
    const outputCount = outputsData[0]?.results?.[0]?.['count'] || 0;
    
    // Check if citations were created
    const citationsResult = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) as count FROM ai_citations WHERE prompt_id IN (SELECT id FROM assistant_prompts WHERE run_id = '${result.runId}');" --remote`, { encoding: 'utf8' });
    const citationsData = JSON.parse(citationsResult);
    const citationCount = citationsData[0]?.results?.[0]?.['count'] || 0;
    
    console.log(`   📊 Outputs: ${outputCount}, Citations: ${citationCount}`);
    
    if (outputCount > 0 && citationCount > 0) {
      console.log(`   ✅ ${assistant}: SUCCESS - Data flowing`);
      return true;
    } else {
      console.log(`   ⚠️  ${assistant}: No data generated`);
      return false;
    }
    
  } catch (error) {
    console.log(`   ❌ ${assistant}: FAILED - ${error.message}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const targetAssistant = args[0];
  
  console.log('🚀 Live Connector Test Suite');
  console.log('============================');
  
  if (targetAssistant) {
    // Test specific assistant
    await testConnector(targetAssistant);
  } else {
    // Test all assistants
    const assistants = ['perplexity', 'chatgpt_search', 'claude'];
    const results = {};
    
    for (const assistant of assistants) {
      results[assistant] = await testConnector(assistant);
      console.log(''); // Empty line for readability
    }
    
    console.log('📊 Test Results Summary:');
    console.log('========================');
    for (const [assistant, success] of Object.entries(results)) {
      console.log(`   ${success ? '✅' : '❌'} ${assistant}: ${success ? 'PASS' : 'FAIL'}`);
    }
    
    const successCount = Object.values(results).filter(Boolean).length;
    console.log(`\n🎯 Overall: ${successCount}/${assistants.length} connectors working`);
  }
}

main().catch(console.error);
