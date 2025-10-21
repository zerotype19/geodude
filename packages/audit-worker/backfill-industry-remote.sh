#!/bin/bash
# Backfill Industry Data for All Audits
# Tests industry resolution on existing audits and populates the industry columns

set -e

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║              INDUSTRY BACKFILL - TEST & POPULATE                     ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")"

echo "Step 1: Check how many audits need backfilling..."
echo ""

npx wrangler d1 execute optiview --remote --command \
  "SELECT COUNT(*) as null_count FROM audits WHERE industry IS NULL"

echo ""
echo "Step 2: Show sample of audits that will be updated..."
echo ""

npx wrangler d1 execute optiview --remote --command \
  "SELECT id, root_url, site_description FROM audits WHERE industry IS NULL LIMIT 10"

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo ""
read -p "Continue with backfill? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Backfill cancelled."
  exit 0
fi

echo ""
echo "Step 3: Running backfill SQL script..."
echo ""

# Create a SQL script that will resolve industry for each audit
cat > /tmp/backfill-industry.sql << 'EOSQL'
-- Backfill industry data for existing audits
-- This is a simpler approach: just set all to generic_consumer, 
-- then update known domains to their specific industries

-- First, set all NULL industries to generic_consumer (default)
UPDATE audits 
SET 
  industry = 'generic_consumer',
  industry_source = 'backfill_default',
  industry_locked = 1
WHERE industry IS NULL;

-- Now update known automotive OEM domains
UPDATE audits
SET 
  industry = 'automotive_oem',
  industry_source = 'backfill_domain_rules'
WHERE industry_locked = 1 
  AND industry_source = 'backfill_default'
  AND (
    root_url LIKE '%toyota.com%' OR
    root_url LIKE '%ford.com%' OR
    root_url LIKE '%gm.com%' OR
    root_url LIKE '%honda.com%' OR
    root_url LIKE '%nissan-usa.com%' OR
    root_url LIKE '%hyundai.com%' OR
    root_url LIKE '%kia.com%' OR
    root_url LIKE '%bmw.com%' OR
    root_url LIKE '%mercedes-benz.com%' OR
    root_url LIKE '%tesla.com%'
  );

-- Update retail domains
UPDATE audits
SET 
  industry = 'retail',
  industry_source = 'backfill_domain_rules'
WHERE industry_locked = 1 
  AND industry_source = 'backfill_default'
  AND (
    root_url LIKE '%bestbuy.com%' OR
    root_url LIKE '%target.com%' OR
    root_url LIKE '%walmart.com%' OR
    root_url LIKE '%amazon.com%'
  );

-- Update financial services domains
UPDATE audits
SET 
  industry = 'financial_services',
  industry_source = 'backfill_domain_rules'
WHERE industry_locked = 1 
  AND industry_source = 'backfill_default'
  AND (
    root_url LIKE '%chase.com%' OR
    root_url LIKE '%wellsfargo.com%' OR
    root_url LIKE '%usaa.com%'
  );

-- Update healthcare provider domains
UPDATE audits
SET 
  industry = 'healthcare_provider',
  industry_source = 'backfill_domain_rules'
WHERE industry_locked = 1 
  AND industry_source = 'backfill_default'
  AND (
    root_url LIKE '%mayoclinic.org%' OR
    root_url LIKE '%clevelandclinic.org%'
  );

-- Update travel/air domains
UPDATE audits
SET 
  industry = 'travel_air',
  industry_source = 'backfill_domain_rules'
WHERE industry_locked = 1 
  AND industry_source = 'backfill_default'
  AND (
    root_url LIKE '%delta.com%' OR
    root_url LIKE '%united.com%'
  );

-- Update travel/hotel domains
UPDATE audits
SET 
  industry = 'travel_hotels',
  industry_source = 'backfill_domain_rules'
WHERE industry_locked = 1 
  AND industry_source = 'backfill_default'
  AND (
    root_url LIKE '%marriott.com%'
  );

-- Show results
SELECT 'Backfill Complete' as status;

SELECT 
  industry,
  industry_source,
  COUNT(*) as count
FROM audits
GROUP BY industry, industry_source
ORDER BY count DESC;
EOSQL

echo "Executing backfill SQL..."
npx wrangler d1 execute optiview --remote --file /tmp/backfill-industry.sql

echo ""
echo "Step 4: Verify results..."
echo ""

npx wrangler d1 execute optiview --remote --command \
  "SELECT industry, industry_source, COUNT(*) as count 
   FROM audits 
   GROUP BY industry, industry_source 
   ORDER BY count DESC"

echo ""
echo "Step 5: Show Toyota audits specifically..."
echo ""

npx wrangler d1 execute optiview --remote --command \
  "SELECT id, root_url, industry, industry_source, started_at 
   FROM audits 
   WHERE root_url LIKE '%toyota%' 
   ORDER BY started_at DESC 
   LIMIT 5"

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║                     ✅ BACKFILL COMPLETE! ✅                         ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "All existing audits now have industry data!"
echo "New audits will use the live resolver with full KV-based rules."
echo ""

