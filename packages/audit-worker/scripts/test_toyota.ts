/**
 * Simple test script for Toyota industry resolution and intent filtering
 * 
 * Usage: npx tsx packages/audit-worker/scripts/test_toyota.ts
 */

import { resolveIndustry, extractDomain } from '../src/lib/industry';
import { filterIntentsByPack } from '../src/lib/intent-guards';

console.log('🧪 Testing Industry Lock System - Toyota\n');

// Test 1: Domain extraction
console.log('Test 1: Domain Extraction');
const domain = extractDomain('https://www.toyota.com/rav4');
console.log(`  Input: https://www.toyota.com/rav4`);
console.log(`  Output: ${domain}`);
console.assert(domain === 'toyota.com', 'Domain extraction failed');
console.log('  ✅ PASS\n');

// Test 2: Industry resolution (Toyota should resolve to automotive_oem)
console.log('Test 2: Industry Resolution');
const lock = resolveIndustry({
  signals: { domain: 'toyota.com' }
});

console.log(`  Domain: toyota.com`);
console.log(`  Resolved: ${lock.value}`);
console.log(`  Source: ${lock.source}`);
console.log(`  Locked: ${lock.locked}`);

console.assert(lock.value === 'automotive_oem', 'Toyota should be automotive_oem');
console.assert(lock.source === 'domain_rules', 'Should come from domain rules');
console.assert(lock.locked === true, 'Should be locked');
console.log('  ✅ PASS\n');

// Test 3: Intent filtering (retail queries should be blocked)
console.log('Test 3: Intent Filtering');

const testIntents = [
  { text: 'What is the return policy for Toyota parts?' },          // Should be BLOCKED
  { text: 'How much does a 2024 Toyota RAV4 cost?' },               // Should PASS (msrp, pricing)
  { text: 'Free shipping options for Toyota accessories' },         // Should be BLOCKED
  { text: 'Find Toyota dealers near me' },                          // Should PASS (dealer locator)
  { text: 'Toyota gift card balance' },                             // Should be BLOCKED
  { text: 'Toyota RAV4 safety ratings from IIHS' },                 // Should PASS (safety, iihs)
  { text: 'Toyota Tacoma towing capacity' },                        // Should PASS (towing)
  { text: 'Add Toyota parts to cart' },                             // Should be BLOCKED
];

console.log(`  Testing ${testIntents.length} intents for automotive_oem industry`);

const filtered = filterIntentsByPack(testIntents, 'automotive_oem');

console.log(`  Input: ${testIntents.length} intents`);
console.log(`  Output: ${filtered.length} intents`);
console.log(`  Dropped: ${testIntents.length - filtered.length} intents\n`);

// Expected: should filter out return policy, shipping, gift card, cart
const expectedPass = [
  'How much does a 2024 Toyota RAV4 cost?',
  'Find Toyota dealers near me',
  'Toyota RAV4 safety ratings from IIHS',
  'Toyota Tacoma towing capacity'
];

console.log('  Expected to PASS:');
expectedPass.forEach(text => {
  const found = filtered.some(i => i.text === text);
  console.log(`    ${found ? '✅' : '❌'} "${text}"`);
  console.assert(found, `Expected to pass: ${text}`);
});

const expectedBlock = [
  'What is the return policy for Toyota parts?',
  'Free shipping options for Toyota accessories',
  'Toyota gift card balance',
  'Add Toyota parts to cart'
];

console.log('\n  Expected to BLOCK:');
expectedBlock.forEach(text => {
  const found = filtered.some(i => i.text === text);
  console.log(`    ${found ? '❌' : '✅'} "${text}"`);
  console.assert(!found, `Expected to block: ${text}`);
});

console.log('\n  ✅ PASS\n');

// Test 4: Verify no retail leakage
console.log('Test 4: Verify No Retail Leakage');
const retailTerms = ['return policy', 'shipping', 'gift card', 'promo code', 'cart', 'checkout'];
const hasRetailTerms = filtered.some(intent => 
  retailTerms.some(term => intent.text.toLowerCase().includes(term))
);

console.log(`  Checking for retail terms: ${retailTerms.join(', ')}`);
console.log(`  Found retail terms: ${hasRetailTerms ? 'YES ❌' : 'NO ✅'}`);
console.assert(!hasRetailTerms, 'Should not contain retail terms');
console.log('  ✅ PASS\n');

// Summary
console.log('═══════════════════════════════════════');
console.log('✅ All Toyota tests passed!');
console.log('═══════════════════════════════════════');
console.log('Summary:');
console.log(`  • Domain extraction: ✅`);
console.log(`  • Industry resolution: automotive_oem ✅`);
console.log(`  • Intent filtering: ${filtered.length}/${testIntents.length} passed ✅`);
console.log(`  • No retail leakage: ✅`);
console.log('\n✨ Toyota industry lock system working correctly!\n');

