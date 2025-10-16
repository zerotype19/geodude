import { readFileSync } from 'fs';
import { join } from 'path';

// Import the scoring functions (we'll need to extract them)
import { extractAll, scorePage, loadWeights } from '../src/index';

// Test fixtures
const FIXTURES_DIR = join(__dirname, 'fixtures');

const answerFirstGood = readFileSync(join(FIXTURES_DIR, 'answer_first_good.html'), 'utf8');
const factsRefsGood = readFileSync(join(FIXTURES_DIR, 'facts_refs_good.html'), 'utf8');
const bareMinimum = readFileSync(join(FIXTURES_DIR, 'bare_minimum.html'), 'utf8');

// Expected scores for key checks
const EXPECTED_SCORES = {
  answer_first_good: {
    A1: 3, // answerBox + jumpLinks/tables = strong
    G1: 3, // facts block = strong
    G2: 3, // provenance schema = strong
    G3: 2  // refs block + outbound links ≥ 3
  },
  facts_refs_good: {
    A1: 0, // no answer box design
    G1: 3, // facts block = strong
    G2: 3, // provenance schema = strong
    G3: 3  // refs block + outbound links ≥ 3
  },
  bare_minimum: {
    A1: 0, // no answer box
    G1: 0, // no facts block
    G2: 0, // no provenance
    G3: 0  // no refs
  }
};

async function runGoldenTests() {
  console.log('🧪 Running Golden Tests for AEO/GEO Scoring\n');

  // Load default weights
  const weights = {
    aeo: { A1:15, A2:15, A3:15, A4:12, A5:10, A6:10, A7:8, A8:6, A9:5, A10:4 },
    geo: { G1:15, G2:15, G3:12, G4:12, G5:10, G6:8, G7:8, G8:6, G9:7, G10:7 },
    patterns: {
      facts_headings: ["key facts","at-a-glance","highlights","summary"],
      refs_headings: ["references","sources","citations","footnotes"],
      glossary_headings: ["glossary","definitions"]
    }
  };

  const tests = [
    { name: 'answer_first_good', html: answerFirstGood, url: 'https://learnings.org/ml-guide' },
    { name: 'facts_refs_good', html: factsRefsGood, url: 'https://learnings.org/climate-facts' },
    { name: 'bare_minimum', html: bareMinimum, url: 'https://learnings.org/basic' }
  ];

  let allPassed = true;

  for (const test of tests) {
    console.log(`📄 Testing: ${test.name}`);
    
    try {
      // Extract analysis
      const analysis = await extractAll(test.html, { 
        url: test.url, 
        robots: {}, 
        rendered: false 
      });

      // Score the page
      const scores = scorePage(analysis, weights);

      // Check key expectations
      const expected = EXPECTED_SCORES[test.name];
      let testPassed = true;

      for (const [checkId, expectedScore] of Object.entries(expected)) {
        const actualCheck = scores.items.find(item => item.id === checkId);
        const actualScore = actualCheck?.score || 0;

        if (actualScore === expectedScore) {
          console.log(`  ✅ ${checkId}: ${actualScore}/3 (expected ${expectedScore})`);
        } else {
          console.log(`  ❌ ${checkId}: ${actualScore}/3 (expected ${expectedScore})`);
          testPassed = false;
          allPassed = false;
        }
      }

      // Show overall scores
      console.log(`  📊 AEO: ${scores.aeo}, GEO: ${scores.geo}`);
      console.log(`  ${testPassed ? '✅ PASS' : '❌ FAIL'}\n`);

    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}\n`);
      allPassed = false;
    }
  }

  console.log(`🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  return allPassed;
}

// Run if called directly
if (require.main === module) {
  runGoldenTests().catch(console.error);
}

export { runGoldenTests };
