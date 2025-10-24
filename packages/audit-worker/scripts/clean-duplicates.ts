/**
 * Remove duplicate domains from industry-packs.default.json
 */

import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(__dirname, '../src/config/industry-packs.default.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Clean duplicates (keep first occurrence)
const domains = config.industry_rules.domains;
const seen = new Set<string>();
const cleaned: Record<string, string> = {};

for (const [domain, industry] of Object.entries(domains)) {
  if (!seen.has(domain)) {
    cleaned[domain] = industry as string;
    seen.add(domain);
  } else {
    console.log(`Removing duplicate: ${domain} (was: ${industry})`);
  }
}

config.industry_rules.domains = cleaned;

// Write back
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log(`\n✅ Cleaned ${Object.keys(domains).length - Object.keys(cleaned).length} duplicates`);
console.log(`📊 Total unique domains: ${Object.keys(cleaned).length}`);

