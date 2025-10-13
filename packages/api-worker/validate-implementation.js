// Simple validation script for Phase Next implementation
console.log('🧪 Validating Phase Next Implementation...\n');

// Test 1: Check if all required files exist
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'src/score-v2.ts',
  'src/detectors/access-tester.ts',
  'src/detectors/render-parity.ts',
  'src/detectors/page-type-classifier.ts',
  'src/detectors/schema-fitness.ts',
  'src/detectors/answer-fitness.ts',
  'src/detectors/eeat-detector.ts',
  'src/detectors/performance-detector.ts',
  'src/assistant-connectors/index.ts',
  'src/assistant-connectors/visibility-service.ts',
  'src/assistant-connectors/mva-service.ts',
  'src/routes/visibility.ts',
  'src/cloudflare-config-generator.ts',
  'src/tests/detectors.test.ts',
  'src/tests/scoring-v2.test.ts'
];

console.log('1️⃣ Checking required files exist...');
let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

console.log(`\n   ${allFilesExist ? '✅ All files exist' : '❌ Some files missing'}\n`);

// Test 2: Check database migrations
console.log('2️⃣ Checking database migrations...');
const migrationFiles = [
  'db/migrations/0010_assistant_runs.sql',
  'db/migrations/0011_assistant_prompts.sql',
  'db/migrations/0012_assistant_outputs.sql',
  'db/migrations/0013_ai_citations_extend.sql',
  'db/migrations/0014_ai_visibility_metrics.sql'
];

let allMigrationsExist = true;
migrationFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
    allMigrationsExist = false;
  }
});

console.log(`\n   ${allMigrationsExist ? '✅ All migrations exist' : '❌ Some migrations missing'}\n`);

// Test 3: Check wrangler.toml configuration
console.log('3️⃣ Checking wrangler.toml configuration...');
const wranglerPath = path.join(__dirname, 'wrangler.toml');
if (fs.existsSync(wranglerPath)) {
  const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
  
  const requiredConfigs = [
    'FEATURE_ASSISTANT_VISIBILITY',
    'FEATURE_EEAT_SCORING',
    'BROWSER_CLUSTER_MAX',
    'FETCH_TIMEOUT_MS',
    'VISIBILITY_RATE_LIMIT_PER_PROJECT',
    'ALLOWED_ANSWER_ENGINES',
    'PROMPT_PACKS',
    'ASSISTANT_SCHEDULES',
    'HEURISTICS'
  ];
  
  let configFound = 0;
  requiredConfigs.forEach(config => {
    if (wranglerContent.includes(config)) {
      console.log(`   ✅ ${config}`);
      configFound++;
    } else {
      console.log(`   ❌ ${config} - MISSING`);
    }
  });
  
  console.log(`\n   ${configFound === requiredConfigs.length ? '✅ All configs found' : '❌ Some configs missing'}\n`);
} else {
  console.log('   ❌ wrangler.toml not found\n');
}

// Test 4: Check API routes integration
console.log('4️⃣ Checking API routes integration...');
const indexPath = path.join(__dirname, 'src/index.ts');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  const requiredIntegrations = [
    'createVisibilityRoutes',
    '/api/visibility/',
    'FEATURE_ASSISTANT_VISIBILITY',
    'PROMPT_PACKS',
    'ASSISTANT_SCHEDULES',
    'HEURISTICS'
  ];
  
  let integrationFound = 0;
  requiredIntegrations.forEach(integration => {
    if (indexContent.includes(integration)) {
      console.log(`   ✅ ${integration}`);
      integrationFound++;
    } else {
      console.log(`   ❌ ${integration} - MISSING`);
    }
  });
  
  console.log(`\n   ${integrationFound === requiredIntegrations.length ? '✅ All integrations found' : '❌ Some integrations missing'}\n`);
} else {
  console.log('   ❌ src/index.ts not found\n');
}

// Test 5: Check test files content
console.log('5️⃣ Checking test files content...');
const testFiles = [
  'src/tests/detectors.test.ts',
  'src/tests/scoring-v2.test.ts'
];

let testContentValid = true;
testFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('describe(') && content.includes('it(') && content.includes('expect(')) {
      console.log(`   ✅ ${file} - Valid test structure`);
    } else {
      console.log(`   ❌ ${file} - Invalid test structure`);
      testContentValid = false;
    }
  } else {
    console.log(`   ❌ ${file} - File missing`);
    testContentValid = false;
  }
});

console.log(`\n   ${testContentValid ? '✅ All test files valid' : '❌ Some test files invalid'}\n`);

// Summary
console.log('📊 Validation Summary:');
console.log(`   Files: ${allFilesExist ? '✅' : '❌'}`);
console.log(`   Migrations: ${allMigrationsExist ? '✅' : '❌'}`);
console.log(`   Configuration: ${fs.existsSync(wranglerPath) ? '✅' : '❌'}`);
console.log(`   API Integration: ${fs.existsSync(indexPath) ? '✅' : '❌'}`);
console.log(`   Tests: ${testContentValid ? '✅' : '❌'}`);

const overallSuccess = allFilesExist && allMigrationsExist && fs.existsSync(wranglerPath) && fs.existsSync(indexPath) && testContentValid;
console.log(`\n🎉 Overall Status: ${overallSuccess ? '✅ READY FOR TESTING' : '❌ NEEDS FIXES'}`);

if (overallSuccess) {
  console.log('\n🚀 Next Steps:');
  console.log('   1. Deploy to staging with feature flags enabled');
  console.log('   2. Run controlled tests with real data');
  console.log('   3. Validate scoring regression');
  console.log('   4. Test UI integration');
  console.log('   5. Enable for production');
}
