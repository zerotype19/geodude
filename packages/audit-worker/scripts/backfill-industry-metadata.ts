/**
 * Backfill Industry Metadata for Existing Audits
 * 
 * Populates industry_confidence, industry_ancestors, and industry_metadata
 * for all existing audits that have NULL values
 * 
 * Also serves as a validation test for the V2 taxonomy system
 */

import { getAncestorSlugs, mapLegacyToV2 } from '../src/config/industry-taxonomy-v2';

interface Audit {
  id: string;
  root_url: string;
  industry: string;
  industry_source: string;
  industry_confidence: number | null;
  industry_ancestors: string | null;
}

interface BackfillStats {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
  confidenceDistribution: Record<string, number>;
  sourceDistribution: Record<string, number>;
  hierarchyDepth: Record<number, number>;
}

/**
 * Infer confidence from industry source
 */
function inferConfidence(source: string): number {
  switch (source) {
    case 'domain_rules':
    case 'override':
      return 1.0; // 100% confident (explicit)
    case 'ai_worker':
      return 0.75; // High confidence (avg for AI)
    case 'ai_worker_medium_conf':
      return 0.55; // Medium confidence
    case 'heuristics':
      return 0.60; // Heuristics avg
    case 'default':
      return 0.0; // No confidence
    default:
      return 0.5; // Unknown
  }
}

/**
 * Backfill a single audit
 */
function backfillAudit(audit: Audit): {
  id: string;
  industry: string;
  confidence: number;
  ancestors: string[];
  ancestorsJson: string;
  updated: boolean;
} {
  // Skip if already has metadata
  if (audit.industry_confidence !== null || audit.industry_ancestors !== null) {
    return {
      id: audit.id,
      industry: audit.industry,
      confidence: audit.industry_confidence || 0,
      ancestors: [],
      ancestorsJson: '',
      updated: false
    };
  }
  
  // Ensure V2 slug
  const v2Slug = audit.industry.includes('.') 
    ? audit.industry 
    : mapLegacyToV2(audit.industry);
  
  // Get ancestors
  const ancestors = getAncestorSlugs(v2Slug);
  
  // Infer confidence from source
  const confidence = inferConfidence(audit.industry_source);
  
  return {
    id: audit.id,
    industry: v2Slug,
    confidence,
    ancestors,
    ancestorsJson: JSON.stringify(ancestors),
    updated: true
  };
}

/**
 * Run backfill via Wrangler
 */
async function runBackfill() {
  console.log('🔄 Starting Industry Metadata Backfill\n');
  console.log('='.repeat(120));
  console.log('');
  
  const stats: BackfillStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    confidenceDistribution: {},
    sourceDistribution: {},
    hierarchyDepth: {}
  };
  
  console.log('📊 Fetching audits from D1...');
  
  // Use wrangler to execute the backfill
  const { execSync } = require('child_process');
  
  // Step 1: Get count of audits needing backfill
  const countQuery = `
    SELECT COUNT(*) as count 
    FROM audits 
    WHERE industry IS NOT NULL 
      AND (industry_confidence IS NULL OR industry_ancestors IS NULL)
  `;
  
  const countResult = execSync(
    `npx wrangler d1 execute optiview --remote --command "${countQuery.replace(/\n/g, ' ')}"`,
    { encoding: 'utf-8', cwd: process.cwd() }
  );
  
  console.log('\nCount query result:', countResult);
  
  // Step 2: Fetch audits in batches
  const batchSize = 100;
  let offset = 0;
  let hasMore = true;
  
  const allUpdates: Array<{
    id: string;
    industry: string;
    confidence: number;
    ancestors: string;
  }> = [];
  
  while (hasMore) {
    console.log(`\n📦 Fetching batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})...`);
    
    const fetchQuery = `
      SELECT id, root_url, industry, industry_source, industry_confidence, industry_ancestors
      FROM audits
      WHERE industry IS NOT NULL
        AND (industry_confidence IS NULL OR industry_ancestors IS NULL)
      ORDER BY started_at DESC
      LIMIT ${batchSize} OFFSET ${offset}
    `;
    
    let batchResult: string;
    try {
      batchResult = execSync(
        `npx wrangler d1 execute optiview --remote --json --command "${fetchQuery.replace(/\n/g, ' ')}"`,
        { encoding: 'utf-8', cwd: process.cwd() }
      );
    } catch (err) {
      console.error('Error fetching batch:', err);
      break;
    }
    
    // Parse JSON output from wrangler
    let audits: Audit[] = [];
    try {
      const lines = batchResult.split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.includes('"results"')) {
          const parsed = JSON.parse(line);
          audits = parsed[0]?.results || [];
          break;
        }
      }
    } catch (parseErr) {
      console.error('Error parsing batch result:', parseErr);
      break;
    }
    
    console.log(`  Found ${audits.length} audits`);
    
    if (audits.length === 0) {
      hasMore = false;
      break;
    }
    
    // Process batch
    for (const audit of audits) {
      stats.total++;
      
      try {
        const result = backfillAudit(audit);
        
        if (result.updated) {
          allUpdates.push({
            id: result.id,
            industry: result.industry,
            confidence: result.confidence,
            ancestors: result.ancestorsJson
          });
          
          stats.updated++;
          
          // Track distributions
          const confBucket = Math.floor(result.confidence * 10) / 10;
          stats.confidenceDistribution[confBucket] = (stats.confidenceDistribution[confBucket] || 0) + 1;
          stats.sourceDistribution[audit.industry_source] = (stats.sourceDistribution[audit.industry_source] || 0) + 1;
          stats.hierarchyDepth[result.ancestors.length] = (stats.hierarchyDepth[result.ancestors.length] || 0) + 1;
          
          if (stats.updated % 10 === 0) {
            process.stdout.write(`\r  Processed: ${stats.updated}`);
          }
        } else {
          stats.skipped++;
        }
      } catch (err) {
        console.error(`\n  Error processing ${audit.id}:`, err);
        stats.errors++;
      }
    }
    
    console.log(`\n  Batch complete: ${stats.updated} updated, ${stats.skipped} skipped, ${stats.errors} errors`);
    
    if (audits.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
    }
  }
  
  console.log('\n');
  console.log('='.repeat(120));
  console.log('');
  
  // Step 3: Apply updates in batches
  if (allUpdates.length > 0) {
    console.log(`📝 Applying ${allUpdates.length} updates to D1...\n`);
    
    const updateBatchSize = 10;
    for (let i = 0; i < allUpdates.length; i += updateBatchSize) {
      const batch = allUpdates.slice(i, i + updateBatchSize);
      
      console.log(`  Batch ${Math.floor(i / updateBatchSize) + 1}/${Math.ceil(allUpdates.length / updateBatchSize)}...`);
      
      for (const update of batch) {
        const updateQuery = `
          UPDATE audits 
          SET industry = '${update.industry}',
              industry_confidence = ${update.confidence},
              industry_ancestors = '${update.ancestors.replace(/'/g, "''")}'
          WHERE id = '${update.id}'
        `;
        
        try {
          execSync(
            `npx wrangler d1 execute optiview --remote --command "${updateQuery.replace(/\n/g, ' ')}"`,
            { encoding: 'utf-8', cwd: process.cwd(), stdio: 'pipe' }
          );
        } catch (updateErr) {
          console.error(`    Error updating ${update.id}:`, updateErr);
          stats.errors++;
        }
      }
    }
    
    console.log('\n✅ Updates applied!\n');
  }
  
  // Print summary
  console.log('='.repeat(120));
  console.log('📊 BACKFILL SUMMARY');
  console.log('='.repeat(120));
  console.log('');
  console.log(`Total Audits Processed:  ${stats.total}`);
  console.log(`✅ Updated:              ${stats.updated} (${((stats.updated / stats.total) * 100).toFixed(1)}%)`);
  console.log(`⏭️  Skipped:              ${stats.skipped} (${((stats.skipped / stats.total) * 100).toFixed(1)}%)`);
  console.log(`❌ Errors:               ${stats.errors} (${((stats.errors / stats.total) * 100).toFixed(1)}%)`);
  console.log('');
  
  console.log('📈 Confidence Distribution:');
  const confBuckets = Object.keys(stats.confidenceDistribution).map(Number).sort((a, b) => b - a);
  for (const bucket of confBuckets) {
    const count = stats.confidenceDistribution[bucket];
    const bar = '█'.repeat(Math.ceil((count / stats.updated) * 50));
    console.log(`  ${bucket.toFixed(1)}: ${count.toString().padStart(4)} ${bar}`);
  }
  console.log('');
  
  console.log('🔍 Source Distribution:');
  const sources = Object.entries(stats.sourceDistribution).sort((a, b) => b[1] - a[1]);
  for (const [source, count] of sources) {
    const bar = '█'.repeat(Math.ceil((count / stats.updated) * 50));
    console.log(`  ${source.padEnd(25)} ${count.toString().padStart(4)} ${bar}`);
  }
  console.log('');
  
  console.log('🌳 Hierarchy Depth Distribution:');
  const depths = Object.keys(stats.hierarchyDepth).map(Number).sort((a, b) => a - b);
  for (const depth of depths) {
    const count = stats.hierarchyDepth[depth];
    const bar = '█'.repeat(Math.ceil((count / stats.updated) * 50));
    console.log(`  ${depth} level${depth !== 1 ? 's' : ' '}: ${count.toString().padStart(4)} ${bar}`);
  }
  console.log('');
  
  console.log('='.repeat(120));
  if (stats.errors === 0) {
    console.log('🎉 BACKFILL COMPLETE! All audits now have V2 metadata.');
  } else {
    console.log(`⚠️  BACKFILL COMPLETE with ${stats.errors} errors. Review logs above.`);
  }
  console.log('='.repeat(120));
  console.log('');
}

// Run backfill
runBackfill().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});

