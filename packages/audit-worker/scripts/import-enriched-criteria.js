#!/usr/bin/env node

/**
 * Import enriched scoring criteria into D1
 * Reads from exports/scoring_criteria_latest.json and updates D1
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXPORT_FILE = path.join(__dirname, '../exports/scoring_criteria_latest.json');
const DB_NAME = 'optiview';

console.log('📊 Importing enriched scoring criteria to D1...\n');

// Read the export file
const exportData = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf8'));
const criteria = exportData[0].results;

console.log(`Found ${criteria.length} criteria to import\n`);

// Function to escape SQL strings
function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// Process each criterion
let successCount = 0;
let errorCount = 0;

for (const c of criteria) {
  try {
    const sql = `
UPDATE scoring_criteria SET
  why_it_matters = ${escapeSql(c.why_it_matters)},
  how_to_fix = ${escapeSql(c.how_to_fix)},
  common_issues = ${escapeSql(c.common_issues)},
  quick_fixes = ${escapeSql(c.quick_fixes)},
  learn_more_links = ${escapeSql(c.learn_more_links)},
  official_docs = ${escapeSql(c.official_docs)},
  examples = ${escapeSql(c.examples)},
  display_order = ${c.display_order || 'NULL'}
WHERE id = '${c.id}';
    `.trim();
    
    // Write SQL to temp file
    const tempFile = `/tmp/update_${c.id}.sql`;
    fs.writeFileSync(tempFile, sql);
    
    // Execute via wrangler
    execSync(
      `wrangler d1 execute ${DB_NAME} --remote --file=${tempFile}`,
      { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      }
    );
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    successCount++;
    process.stdout.write(`✅ ${c.id}\n`);
    
  } catch (error) {
    errorCount++;
    console.error(`❌ ${c.id}: ${error.message}`);
  }
}

console.log(`\n📈 Import complete:`);
console.log(`   ✅ Success: ${successCount}`);
console.log(`   ❌ Errors: ${errorCount}`);

if (successCount === criteria.length) {
  console.log('\n🎉 All criteria successfully imported to D1!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some criteria failed to import. Check errors above.');
  process.exit(1);
}

