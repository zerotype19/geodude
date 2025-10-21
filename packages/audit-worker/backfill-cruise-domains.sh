#!/bin/bash

# Backfill obvious cruise domains with travel_cruise industry

DB_NAME="optiview"

echo "Backfilling cruise domains..."

# Update travel_cruise
npx wrangler d1 execute $DB_NAME --remote --command="
UPDATE audits
SET industry = 'travel_cruise', industry_source = 'backfill_domain_rules'
WHERE (
    LOWER(root_url) LIKE '%vikingcruises.com%' OR
    LOWER(root_url) LIKE '%vikingrivercruises.com%' OR
    LOWER(root_url) LIKE '%carnival.com%' OR
    LOWER(root_url) LIKE '%princess.com%' OR
    LOWER(root_url) LIKE '%royalcaribbean.com%' OR
    LOWER(root_url) LIKE '%norwegiancruiseline.com%' OR
    LOWER(root_url) LIKE '%msc.com%' OR
    LOWER(root_url) LIKE '%celebrity.com%'
) AND (industry IS NULL OR industry = 'generic_consumer');
"

echo "✅ Cruise domains updated!"
echo ""
echo "Now updating KV with domain mappings..."

# Update KV to add these domains
node -e "
const domains = [
  'vikingcruises.com',
  'vikingrivercruises.com',
  'carnival.com',
  'princess.com',
  'royalcaribbean.com',
  'norwegiancruiseline.com',
  'msccruises.com',
  'celebritycruises.com'
];

console.log('Add these to KV manually or via script:');
domains.forEach(d => console.log(\`  \\\"\${d}\\\": \\\"travel_cruise\\\",\`));
"

echo ""
echo "Done! Check D1 table with:"
echo "  npx wrangler d1 execute optiview --remote --command \"SELECT domain, industry, industry_source FROM audits WHERE industry = 'travel_cruise' LIMIT 10\""

