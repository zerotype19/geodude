/**
 * Domain Migration Script - V1 (Flat) → V2 (Hierarchical)
 * 
 * Maps all 1,244 domains from flat industry labels to hierarchical slugs
 * Uses automatic mapping + manual overrides for surgical classification
 */

import * as fs from 'fs';
import * as path from 'path';
import { mapLegacyToV2 } from '../src/config/industry-taxonomy-v2';

interface DomainRules {
  industry_rules: {
    default_industry: string;
    domains: Record<string, string>;
  };
  packs: any;
}

/**
 * Manual overrides for surgical classification
 * Use when automatic mapping is too generic
 */
const MANUAL_OVERRIDES: Record<string, string> = {
  // ==================== HEALTHCARE ====================
  // Pharmaceutical companies (not generic health)
  'pfizer.com': 'health.pharma.brand',
  'moderna.com': 'health.pharma.brand',
  'jnj.com': 'health.pharma.brand',
  'astrazeneca.com': 'health.pharma.brand',
  'roche.com': 'health.pharma.brand',
  'novartis.com': 'health.pharma.brand',
  'merck.com': 'health.pharma.brand',
  'gsk.com': 'health.pharma.brand',
  'sanofi.com': 'health.pharma.brand',
  'bayer.com': 'health.pharma.brand',
  'lilly.com': 'health.pharma.brand',
  'abbvie.com': 'health.pharma.brand',
  'bristol myers.com': 'health.pharma.brand',
  'gilead.com': 'health.pharma.brand',
  'takeda.com': 'health.pharma.brand',
  'boehringer-ingelheim.com': 'health.pharma.brand',
  'novonordisk.com': 'health.pharma.brand',
  'amgen.com': 'health.pharma.brand',
  'biogen.com': 'health.pharma.brand',
  'regeneron.com': 'health.pharma.brand',
  
  // Health systems (not pharma)
  'mayoclinic.org': 'health.providers',
  'clevelandclinic.org': 'health.providers',
  'hopkinsmedicine.org': 'health.providers',
  'stanfordhealthcare.org': 'health.providers',
  'uclahealth.org': 'health.providers',
  'massgeneral.org': 'health.providers',
  'nyu langone.org': 'health.providers',
  'mountsinai.org': 'health.providers',
  'kp.org': 'health.providers', // Kaiser Permanente
  'hcahealthcare.com': 'health.providers',
  'commonspirit.org': 'health.providers',
  'tenethealth.com': 'health.providers',
  'adventhealth.com': 'health.providers',
  'ascension.org': 'health.providers',
  
  // Pharmacies (retail health, not pure retail)
  'cvs.com': 'health.pharmacy',
  'walgreens.com': 'health.pharmacy',
  'riteaid.com': 'health.pharmacy',
  'cvshealth.com': 'health.pharmacy',
  
  // Health insurance
  'unitedhealthcare.com': 'health.payers',
  'anthem.com': 'health.payers',
  'cigna.com': 'health.payers',
  'humana.com': 'health.payers',
  'aetna.com': 'health.payers',
  'bluecrossblueeshield.com': 'health.payers',
  
  // ==================== SOFTWARE/SAAS ====================
  // CRM & CDP (not generic SaaS)
  'salesforce.com': 'software.cdp_crm',
  'hubspot.com': 'software.cdp_crm',
  'zoho.com': 'software.cdp_crm',
  
  // Developer tools (not generic SaaS)
  'github.com': 'software.devtools',
  'gitlab.com': 'software.devtools',
  'bitbucket.org': 'software.devtools',
  'circleci.com': 'software.devtools',
  'jenkins.io': 'software.devtools',
  'docker.com': 'software.devtools',
  
  // Analytics & BI (not generic SaaS)
  'tableau.com': 'software.analytics_bi',
  'looker.com': 'software.analytics_bi',
  'powerbi.microsoft.com': 'software.analytics_bi',
  'qlik.com': 'software.analytics_bi',
  'domo.com': 'software.analytics_bi',
  'sisense.com': 'software.analytics_bi',
  
  // Cybersecurity (not generic SaaS)
  'crowdstrike.com': 'software.security',
  'paloaltonetworks.com': 'software.security',
  'fortinet.com': 'software.security',
  'checkpoint.com': 'software.security',
  'proofpoint.com': 'software.security',
  'zscaler.com': 'software.security',
  'okta.com': 'software.security',
  'auth0.com': 'software.security',
  
  // ==================== RETAIL ====================
  // Horizontal marketplaces (not retail stores)
  'amazon.com': 'retail.marketplace.horizontal',
  'ebay.com': 'retail.marketplace.horizontal',
  'alibaba.com': 'retail.marketplace.horizontal',
  'etsy.com': 'retail.marketplace.horizontal',
  
  // Mass merchants (not grocery)
  'walmart.com': 'retail.mass_merch',
  'target.com': 'retail.mass_merch',
  'kmart.com': 'retail.mass_merch',
  
  // Grocery (not mass merch)
  'kroger.com': 'retail.grocery',
  'wholefoodsmarket.com': 'retail.grocery',
  'albertsons.com': 'retail.grocery',
  'safeway.com': 'retail.grocery',
  'publix.com': 'retail.grocery',
  'heb.com': 'retail.grocery',
  'wegmans.com': 'retail.grocery',
  
  // Warehouse clubs (not retail or grocery)
  'costco.com': 'retail.wholesale_club',
  'samsclub.com': 'retail.wholesale_club',
  'bjs.com': 'retail.wholesale_club',
  
  // ==================== RESTAURANTS ====================
  // QSR (fast food)
  'mcdonalds.com': 'food_restaurant.qsr',
  'subway.com': 'food_restaurant.qsr',
  'burgerking.com': 'food_restaurant.qsr',
  'wendys.com': 'food_restaurant.qsr',
  'tacobell.com': 'food_restaurant.qsr',
  'kfc.com': 'food_restaurant.qsr',
  'arbys.com': 'food_restaurant.qsr',
  'dunkindonuts.com': 'food_restaurant.qsr',
  'starbucks.com': 'food_restaurant.qsr',
  
  // Fast casual
  'chipotle.com': 'food_restaurant.fast_casual',
  'panera.com': 'food_restaurant.fast_casual',
  'sweetgreen.com': 'food_restaurant.fast_casual',
  'shake shack.com': 'food_restaurant.fast_casual',
  'fiveguys.com': 'food_restaurant.fast_casual',
  
  // Casual dining
  'olivegarden.com': 'food_restaurant.casual',
  'chilis.com': 'food_restaurant.casual',
  'applebees.com': 'food_restaurant.casual',
  'tgifridays.com': 'food_restaurant.casual',
  'redlobster.com': 'food_restaurant.casual',
  'cheesecakefactory.com': 'food_restaurant.casual',
  
  // ==================== UNIVERSITIES ====================
  // Private universities
  'harvard.edu': 'education.higher.private',
  'stanford.edu': 'education.higher.private',
  'yale.edu': 'education.higher.private',
  'princeton.edu': 'education.higher.private',
  'mit.edu': 'education.higher.private',
  'columbia.edu': 'education.higher.private',
  'upenn.edu': 'education.higher.private',
  'duke.edu': 'education.higher.private',
  'caltech.edu': 'education.higher.private',
  'northwestern.edu': 'education.higher.private',
  'brown.edu': 'education.higher.private',
  'dartmouth.edu': 'education.higher.private',
  'vanderbilt.edu': 'education.higher.private',
  'rice.edu': 'education.higher.private',
  'emory.edu': 'education.higher.private',
  'georgetown.edu': 'education.higher.private',
  'carnegiemellon.edu': 'education.higher.private',
  'usc.edu': 'education.higher.private',
  'nyu.edu': 'education.higher.private',
  
  // Public universities
  'berkeley.edu': 'education.higher.public',
  'umich.edu': 'education.higher.public',
  'ucla.edu': 'education.higher.public',
  'virginia.edu': 'education.higher.public',
  'unc.edu': 'education.higher.public',
  'michigan.edu': 'education.higher.public',
  'washington.edu': 'education.higher.public',
  'utexas.edu': 'education.higher.public',
  'wisc.edu': 'education.higher.public',
  'illinois.edu': 'education.higher.public',
  'gatech.edu': 'education.higher.public',
  'ucsd.edu': 'education.higher.public',
  
  // ==================== TRAVEL ====================
  // OTAs (not airlines)
  'expedia.com': 'travel.otasearch',
  'booking.com': 'travel.otasearch',
  'priceline.com': 'travel.otasearch',
  'kayak.com': 'travel.otasearch',
  'hotels.com': 'travel.otasearch',
  'trivago.com': 'travel.otasearch',
  
  // Theme parks (not hotels)
  'disneyworld.com': 'travel.parks.theme',
  'disneyland.com': 'travel.parks.theme',
  'universalstudios.com': 'travel.parks.theme',
  'seaworld.com': 'travel.parks.theme',
  'sixflags.com': 'travel.parks.theme',
  
  // ==================== FINANCIAL ====================
  // Mortgages (not banks)
  'quickenloans.com': 'finance.lending.mortgage',
  'rocketmortgage.com': 'finance.lending.mortgage',
  'better.com': 'finance.lending.mortgage',
  'loandepot.com': 'finance.lending.mortgage',
  
  // Brokerages (not banks)
  'schwab.com': 'finance.brokerage.trading',
  'fidelity.com': 'finance.brokerage.trading',
  'etrade.com': 'finance.brokerage.trading',
  'tdameritrade.com': 'finance.brokerage.trading',
  'robinhood.com': 'finance.brokerage.trading',
  'webull.com': 'finance.brokerage.trading',
  
  // Insurance (not banks)
  'geico.com': 'finance.insurance.p_and_c',
  'progressive.com': 'finance.insurance.p_and_c',
  'statefarm.com': 'finance.insurance.p_and_c',
  'allstate.com': 'finance.insurance.p_and_c',
  'usaa.com': 'finance.insurance.p_and_c',
  
  // ==================== TELECOM ====================
  // ISPs (not wireless)
  'comcast.com': 'telecom.isp_broadband',
  'spectrum.com': 'telecom.isp_broadband',
  'att.com': 'telecom.isp_broadband', // Also wireless, but primary is ISP
  'verizon.com': 'telecom.wireless', // Primary is wireless
  'tmobile.com': 'telecom.wireless',
  'sprint.com': 'telecom.wireless',
  
  // ==================== MEDIA ====================
  // Social media (not streaming)
  'facebook.com': 'media.social',
  'instagram.com': 'media.social',
  'twitter.com': 'media.social',
  'linkedin.com': 'media.social',
  'snapchat.com': 'media.social',
  'tiktok.com': 'media.social',
  'pinterest.com': 'media.social',
  'reddit.com': 'media.social'
};

/**
 * Migrate all domains to V2 slugs
 */
function migrateDomains() {
  console.log('🔄 Migrating domains from V1 (flat) to V2 (hierarchical)\n');
  console.log('═'.repeat(100));
  
  // Load current flat domains
  const configPath = path.join(__dirname, '../src/config/industry-packs.default.json');
  const config: DomainRules = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const currentDomains = config.industry_rules.domains;
  
  console.log(`📊 Current domains: ${Object.keys(currentDomains).length}`);
  console.log(`📋 Manual overrides: ${Object.keys(MANUAL_OVERRIDES).length}`);
  console.log('');
  
  // Migrate domains
  const migratedDomains: Record<string, string> = {};
  const migrationStats: Record<string, number> = {};
  let manualCount = 0;
  let autoCount = 0;
  
  for (const [domain, legacyIndustry] of Object.entries(currentDomains)) {
    let newSlug: string;
    
    // Check for manual override first
    if (MANUAL_OVERRIDES[domain]) {
      newSlug = MANUAL_OVERRIDES[domain];
      manualCount++;
    } else {
      // Use automatic mapping
      newSlug = mapLegacyToV2(legacyIndustry);
      autoCount++;
    }
    
    migratedDomains[domain] = newSlug;
    migrationStats[newSlug] = (migrationStats[newSlug] || 0) + 1;
  }
  
  console.log('✅ Migration complete!');
  console.log('');
  console.log('📊 Migration Stats:');
  console.log('─'.repeat(100));
  console.log(`  Total domains:      ${Object.keys(migratedDomains).length}`);
  console.log(`  Manual overrides:   ${manualCount} (${((manualCount / Object.keys(migratedDomains).length) * 100).toFixed(1)}%)`);
  console.log(`  Auto-mapped:        ${autoCount} (${((autoCount / Object.keys(migratedDomains).length) * 100).toFixed(1)}%)`);
  console.log(`  Unique V2 slugs:    ${Object.keys(migrationStats).length}`);
  console.log('');
  
  // Show distribution by V2 slug
  console.log('📋 Domain Distribution by V2 Slug (Top 20):');
  console.log('─'.repeat(100));
  const sortedStats = Object.entries(migrationStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  
  for (const [slug, count] of sortedStats) {
    const bar = '█'.repeat(Math.ceil((count / sortedStats[0][1]) * 40));
    console.log(`  ${slug.padEnd(35)} ${count.toString().padStart(4)} ${bar}`);
  }
  console.log('');
  
  // Export to JSON
  const outputPath = path.join(__dirname, '../src/config/industry-packs-v2.json');
  const v2Config = {
    ...config,
    industry_rules: {
      ...config.industry_rules,
      domains: migratedDomains
    }
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(v2Config, null, 2));
  console.log(`✅ Exported to: ${outputPath}`);
  console.log('');
  
  // Show sample manual overrides
  console.log('📝 Sample Manual Overrides:');
  console.log('─'.repeat(100));
  const sampleOverrides = Object.entries(MANUAL_OVERRIDES).slice(0, 10);
  for (const [domain, slug] of sampleOverrides) {
    const legacyIndustry = currentDomains[domain];
    console.log(`  ${domain.padEnd(30)} ${legacyIndustry.padEnd(25)} → ${slug}`);
  }
  console.log('  ... and', Object.keys(MANUAL_OVERRIDES).length - 10, 'more');
  console.log('');
  
  console.log('═'.repeat(100));
  console.log('🎉 Migration complete! V2 config written to industry-packs-v2.json');
  console.log('═'.repeat(100));
  console.log('');
}

// Run migration
migrateDomains();

