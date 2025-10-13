// Test script for gates and detectors
import { calculateScoresV2 } from './src/score-v2.js';
import { classifyPageType } from './src/detectors/page-type-classifier.js';
import { validateSchemaFitness } from './src/detectors/schema-fitness.js';
import { analyzeAnswerFitness } from './src/detectors/answer-fitness.js';
import { analyzeEEAT } from './src/detectors/eeat-detector.js';

console.log('🧪 Testing Gates and Detectors...\n');

// Test 1: Answer engines blocked
console.log('1️⃣ Testing Gate A: Answer engines blocked');
const blockedCrawlability = {
  robotsFound: true,
  sitemapFound: true,
  aiBotsAllowed: {
    'GPTBot': true,
    'ClaudeBot': true,
    'PerplexityBot': false, // Blocked
    'CCBot': true,
    'Google-Extended': true,
    'Claude-Web': false // Blocked
  },
  answerEngineAccess: {
    'PerplexityBot': { status: 403, bodyHash: 'blocked', cfChallenge: true },
    'Claude-Web': { status: 403, bodyHash: 'blocked', cfChallenge: true }
  },
  renderParity: 95
};

const testPages = [
  {
    url: 'https://example.com',
    status_code: 200,
    title: 'Test Page',
    h1: 'Test Heading',
    has_h1: true,
    jsonld_count: 1,
    faq_present: false,
    word_count: 500,
    rendered_words: 500,
    load_time_ms: 2000,
    error: null
  }
];

const scores = calculateScoresV2(testPages, [], blockedCrawlability);
console.log(`   Overall Score: ${scores.overall}%`);
console.log(`   Gate A (Answer engines blocked): ${scores.gates.gateA}`);
console.log(`   Expected: Overall ≤ 35%, Gate A = true`);
console.log(`   ✅ ${scores.overall <= 35 && scores.gates.gateA ? 'PASS' : 'FAIL'}\n`);

// Test 2: Render parity fail
console.log('2️⃣ Testing Gate C: Render parity diff >30%');
const lowParityCrawlability = {
  robotsFound: true,
  sitemapFound: true,
  aiBotsAllowed: {
    'GPTBot': true,
    'ClaudeBot': true,
    'PerplexityBot': true,
    'CCBot': true,
    'Google-Extended': true,
    'Claude-Web': true
  },
  answerEngineAccess: {
    'PerplexityBot': { status: 200, bodyHash: 'abc123', cfChallenge: false },
    'Claude-Web': { status: 200, bodyHash: 'abc123', cfChallenge: false }
  },
  renderParity: 65 // Low parity
};

const scores2 = calculateScoresV2(testPages, [], lowParityCrawlability);
console.log(`   Overall Score: ${scores2.overall}%`);
console.log(`   Gate C (Render parity diff >30%): ${scores2.gates.gateC}`);
console.log(`   Expected: Overall ≤ 55%, Gate C = true`);
console.log(`   ✅ ${scores2.overall <= 55 && scores2.gates.gateC ? 'PASS' : 'FAIL'}\n`);

// Test 3: Page Type Classifier
console.log('3️⃣ Testing Page Type Classifier');
const faqHtml = '<h1>Frequently Asked Questions</h1><div itemscope itemtype="https://schema.org/FAQPage">';
const faqResult = classifyPageType('https://example.com/faq', faqHtml, 'FAQ - Example', 'Frequently Asked Questions');
console.log(`   FAQ Page Type: ${faqResult.type}`);
console.log(`   Confidence: ${faqResult.confidence}%`);
console.log(`   Expected: type = 'faq', confidence > 50%`);
console.log(`   ✅ ${faqResult.type === 'faq' && faqResult.confidence > 50 ? 'PASS' : 'FAIL'}\n`);

// Test 4: Schema Fitness Validator
console.log('4️⃣ Testing Schema Fitness Validator');
const validArticleHtml = `
  <script type="application/ld+json">
  {
    "@type": "Article",
    "headline": "Test Article",
    "author": {
      "@type": "Person",
      "name": "John Doe"
    },
    "datePublished": "2024-01-01"
  }
  </script>
`;
const schemaResult = validateSchemaFitness(validArticleHtml, 'article');
console.log(`   Schema Valid: ${schemaResult.valid}`);
console.log(`   Fitness: ${schemaResult.fitness}%`);
console.log(`   Type: ${schemaResult.type}`);
console.log(`   Expected: valid = true, fitness > 80%`);
console.log(`   ✅ ${schemaResult.valid && schemaResult.fitness > 80 ? 'PASS' : 'FAIL'}\n`);

// Test 5: Answer Fitness Detector
console.log('5️⃣ Testing Answer Fitness Detector');
const goodContentHtml = `
  <h1>How to Build a Website</h1>
  <h2>Step 1: Choose a Platform</h2>
  <p>First, you need to choose a platform for your website...</p>
  <h2>Step 2: Get Hosting</h2>
  <p>Next, you'll need to get hosting for your website...</p>
  <h3>FAQ</h3>
  <p>What is the best platform? WordPress is a popular choice...</p>
`;
const answerResult = analyzeAnswerFitness(goodContentHtml, 'How to Build a Website', 'How to Build a Website');
console.log(`   Answer Fitness: ${answerResult.fitness}%`);
console.log(`   Chunkability: ${answerResult.chunkability}%`);
console.log(`   Q&A Scaffolds: ${answerResult.qaScaffolds}%`);
console.log(`   Expected: fitness > 50%, chunkability > 0, qaScaffolds > 0`);
console.log(`   ✅ ${answerResult.fitness > 50 && answerResult.chunkability > 0 && answerResult.qaScaffolds > 0 ? 'PASS' : 'FAIL'}\n`);

// Test 6: E-E-A-T Detector
console.log('6️⃣ Testing E-E-A-T Detector');
const eeatHtml = `
  <script type="application/ld+json">
  {
    "@type": "Person",
    "name": "John Doe",
    "sameAs": ["https://linkedin.com/in/johndoe", "https://github.com/johndoe"]
  }
  </script>
  <h1>Our Research Shows</h1>
  <p>Based on our testing, we found that...</p>
  <img src="/screenshots/test-results.png" alt="Test Results">
`;
const eeatResult = analyzeEEAT(eeatHtml, 'https://example.com', 'Research Article', 'Our Research Shows');
console.log(`   E-E-A-T Overall: ${eeatResult.overall}`);
console.log(`   Experience: ${eeatResult.experience}`);
console.log(`   Expertise: ${eeatResult.expertise}`);
console.log(`   Authority: ${eeatResult.authority}`);
console.log(`   Trust: ${eeatResult.trust}`);
console.log(`   Expected: overall > 50, expertise > 50, experience > 50`);
console.log(`   ✅ ${eeatResult.overall > 50 && eeatResult.expertise > 50 && eeatResult.experience > 50 ? 'PASS' : 'FAIL'}\n`);

console.log('🎉 All tests completed!');
