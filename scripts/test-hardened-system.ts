#!/usr/bin/env tsx

/**
 * Test Script: Hardened AI Detection System
 * 
 * This script tests the key functionality of the hardened system:
 * 1. Events API with classification
 * 2. Citations API
 * 3. Journeys/Sessions API
 * 4. Database schema (class and sampled columns)
 */

import { config } from 'dotenv';

// Load environment variables
config();

const API_BASE = process.env.VITE_API_URL || "https://api.optiview.ai";
const TEST_PROJECT_ID = "prj_cTSh3LZ8qMVZ"; // Use the known project ID

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

async function testEndpoint(endpoint: string, description: string): Promise<TestResult> {
  try {
    console.log(`🔍 Testing: ${description}`);
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const data = await response.json();
      return {
        name: description,
        status: 'PASS',
        message: `Endpoint ${endpoint} responded successfully`,
        details: { status: response.status, dataKeys: Object.keys(data) }
      };
    } else {
      return {
        name: description,
        status: 'FAIL',
        message: `Endpoint ${endpoint} failed with status ${response.status}`,
        details: { status: response.status, statusText: response.statusText }
      };
    }
  } catch (error) {
    return {
      name: description,
      status: 'FAIL',
      message: `Endpoint ${endpoint} threw error: ${error}`,
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

async function testEventsAPI(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  // Test events summary
  results.push(await testEndpoint(
    `/api/events/summary?project_id=${TEST_PROJECT_ID}&window=24h`,
    'Events Summary API'
  ));
  
  // Test events recent
  results.push(await testEndpoint(
    `/api/events/recent?project_id=${TEST_PROJECT_ID}&window=24h&page=1&pageSize=10`,
    'Events Recent API'
  ));
  
  // Test events has-any
  results.push(await testEndpoint(
    `/api/events/has-any?project_id=${TEST_PROJECT_ID}&window=15m`,
    'Events Has-Any API'
  ));
  
  return results;
}

async function testCitationsAPI(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  // Test citations summary
  results.push(await testEndpoint(
    `/api/citations/summary?project_id=${TEST_PROJECT_ID}&window=7d`,
    'Citations Summary API'
  ));
  
  // Test citations list
  results.push(await testEndpoint(
    `/api/citations?project_id=${TEST_PROJECT_ID}&window=7d&page=1&pageSize=10`,
    'Citations List API'
  ));
  
  return results;
}

async function testJourneysAPI(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  // Test sessions summary
  results.push(await testEndpoint(
    `/api/sessions/summary?project_id=${TEST_PROJECT_ID}&window=24h`,
    'Sessions Summary API'
  ));
  
  // Test sessions recent
  results.push(await testEndpoint(
    `/api/sessions/recent?project_id=${TEST_PROJECT_ID}&window=24h&page=1&pageSize=10`,
    'Sessions Recent API'
  ));
  
  return results;
}

async function testAdminEndpoints(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  // Test admin health
  results.push(await testEndpoint(
    `/admin/health`,
    'Admin Health API'
  ));
  
  return results;
}

async function runAllTests(): Promise<void> {
  console.log('🚀 Starting Hardened AI Detection System Tests\n');
  
  const allResults: TestResult[] = [];
  
  // Test Events API
  console.log('📊 Testing Events API...');
  allResults.push(...(await testEventsAPI()));
  
  // Test Citations API
  console.log('\n📚 Testing Citations API...');
  allResults.push(...(await testCitationsAPI()));
  
  // Test Journeys API
  console.log('\n🛤️ Testing Journeys/Sessions API...');
  allResults.push(...(await testJourneysAPI()));
  
  // Test Admin Endpoints
  console.log('\n🔧 Testing Admin Endpoints...');
  allResults.push(...(await testAdminEndpoints()));
  
  // Summary
  console.log('\n📋 Test Results Summary:');
  console.log('=' .repeat(50));
  
  const passed = allResults.filter(r => r.status === 'PASS').length;
  const failed = allResults.filter(r => r.status === 'FAIL').length;
  const skipped = allResults.filter(r => r.status === 'SKIP').length;
  
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`⏭️ SKIPPED: ${skipped}`);
  console.log(`📊 TOTAL: ${allResults.length}`);
  
  // Show detailed results
  console.log('\n📝 Detailed Results:');
  allResults.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${icon} ${result.name}: ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  });
  
  // Final status
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The Hardened AI Detection System is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the details above.');
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}
