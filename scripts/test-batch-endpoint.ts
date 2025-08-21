#!/usr/bin/env tsx

/**
 * Test script for the new batch reclassification endpoint
 */

const API_BASE = 'https://api.optiview.ai';

async function testBatchEndpoint() {
  console.log('🧪 Testing batch reclassification endpoint...\n');
  
  // Test 1: GET method (backward compatibility)
  console.log('1️⃣ Testing GET method (backward compatibility)...');
  try {
    const response = await fetch(`${API_BASE}/admin/ai-backfill/reclassify?hours=1`);
    console.log(`   Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
    } else {
      console.log(`   Error: ${await response.text()}`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  console.log('\n2️⃣ Testing POST method (new batch processing)...');
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const response = await fetch(`${API_BASE}/admin/ai-backfill/reclassify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        start_time: oneHourAgo.toISOString(),
        end_time: now.toISOString(),
        batch_size: 50
      })
    });
    
    console.log(`   Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
    } else {
      console.log(`   Error: ${await response.text()}`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  console.log('\n✅ Test completed!');
}

testBatchEndpoint().catch(console.error);
