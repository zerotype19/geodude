#!/usr/bin/env node

/**
 * Import full scoring criteria into D1
 * Reads from exports/scoring_criteria_current_formatted.json and updates D1
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXPORT_FILE = path.join(__dirname, '../exports/scoring_criteria_current_formatted.json');
const DB_NAME = 'optiview';

console.log('📊 Importing full scoring criteria to D1...\n');

// Read the export file
const criteria = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf8'));

console.log(`Found ${criteria.length} criteria to import\n`);

// Function to escape SQL strings
function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// Function to format value
function formatValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  return escapeSql(val);
}

// Process each criterion
let successCount = 0;
let errorCount = 0;

for (const c of criteria) {
  try {
    const sql = `
UPDATE scoring_criteria SET
  version = ${c.version || 1},
  label = ${escapeSql(c.label)},
  description = ${escapeSql(c.description)},
  category = ${escapeSql(c.category)},
  scope = ${escapeSql(c.scope)},
  weight = ${c.weight},
  impact_level = ${escapeSql(c.impact_level)},
  pass_threshold = ${c.pass_threshold},
  warn_threshold = ${c.warn_threshold},
  check_type = ${escapeSql(c.check_type)},
  enabled = ${c.enabled},
  preview = ${c.preview},
  why_it_matters = ${escapeSql(c.why_it_matters)},
  how_to_fix = ${escapeSql(c.how_to_fix)},
  common_issues = ${escapeSql(c.common_issues)},
  quick_fixes = ${escapeSql(c.quick_fixes)},
  references_json = ${escapeSql(c.references_json)},
  learn_more_links = ${escapeSql(c.learn_more_links)},
  official_docs = ${escapeSql(c.official_docs)},
  display_order = ${formatValue(c.display_order)},
  points_possible = ${formatValue(c.points_possible)},
  importance_rank = ${formatValue(c.importance_rank)},
  scoring_approach = ${escapeSql(c.scoring_approach)},
  examples = ${escapeSql(c.examples)},
  view_in_ui = ${escapeSql(c.view_in_ui)},
  updated_at = datetime('now')
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

