#!/usr/bin/env tsx

/**
 * Test script to verify that new events have audit fields populated
 * This tests the buildAuditMeta integration in the events ingest handler
 */

import { buildAuditMeta } from '../apps/geodude-api/src/ai-lite/classifier';

// Mock classification result
const mockClassification = {
  class: 'human_via_ai' as const,
  aiSourceId: 10,
  aiSourceSlug: 'openai_chatgpt',
  aiSourceName: 'OpenAI/ChatGPT',
  reason: 'Referrer matches known AI assistant → human_via_ai (OpenAI/ChatGPT)',
  evidence: {
    refHost: 'chat.openai.com',
    refPath: '/share/abc123'
  },
  confidence: 0.95
};

// Test buildAuditMeta function
function testBuildAuditMeta() {
  console.log('🧪 Testing buildAuditMeta function...\n');

  const auditMeta = buildAuditMeta({
    referrerUrl: 'https://chat.openai.com/share/abc123',
    classification: mockClassification,
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    versions: {
      classifier: 'v2.0.0',
      manifest: '2025.1.0'
    }
  });

  console.log('Generated audit metadata:');
  console.log(JSON.stringify(auditMeta, null, 2));

  // Verify required fields are present
  const requiredFields = [
    'referrer_url',
    'referrer_host', 
    'referrer_path',
    'classification_reason',
    'confidence',
    'ai_source_slug',
    'ai_source_name',
    'classifier_version',
    'kv_manifest_version'
  ];

  const missingFields = requiredFields.filter(field => !(field in auditMeta));
  
  if (missingFields.length === 0) {
    console.log('\n✅ All required audit fields are present!');
  } else {
    console.log('\n❌ Missing required fields:', missingFields);
    process.exit(1);
  }

  // Verify field values
  console.log('\n🔍 Field validation:');
  console.log(`referrer_host: ${auditMeta.referrer_host} (expected: chat.openai.com)`);
  console.log(`referrer_path: ${auditMeta.referrer_path} (expected: /share/abc123)`);
  console.log(`classification_reason: ${auditMeta.classification_reason}`);
  console.log(`confidence: ${auditMeta.confidence} (expected: 0.95)`);
  console.log(`ai_source_slug: ${auditMeta.ai_source_slug} (expected: openai_chatgpt)`);
  console.log(`classifier_version: ${auditMeta.classifier_version} (expected: v2.0.0)`);

  // Test URL parsing edge cases
  console.log('\n🧪 Testing URL parsing edge cases...');
  
  const edgeCases = [
    'https://example.com/path?utm_source=test',
    'http://www.subdomain.example.com/',
    'invalid-url',
    null,
    undefined
  ];

  edgeCases.forEach((url, i) => {
    const result = buildAuditMeta({
      referrerUrl: url,
      classification: mockClassification,
      ua: 'test',
      versions: { classifier: 'test', manifest: 'test' }
    });
    
    console.log(`Case ${i + 1} (${url}):`);
    console.log(`  host: ${result.referrer_host}`);
    console.log(`  path: ${result.referrer_path}`);
    console.log(`  url: ${result.referrer_url}`);
  });

  console.log('\n✅ buildAuditMeta test completed successfully!');
}

// Run the test
if (require.main === module) {
  testBuildAuditMeta();
}
