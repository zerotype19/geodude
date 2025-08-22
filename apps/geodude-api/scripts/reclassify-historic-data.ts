#!/usr/bin/env tsx
/**
 * Historic Data Reclassification Script
 * 
 * This script updates existing records from the old 'ai_agent_crawl' class
 * to the new 'crawler' class and attempts to infer bot categories
 * from existing metadata.
 */

import { BotCategory } from '../src/classifier/botCategoryMap';

interface ReclassificationResult {
  totalRecords: number;
  updatedRecords: number;
  errors: string[];
  botCategoriesAdded: number;
}

/**
 * Infer bot category from user agent and other metadata
 */
function inferBotCategory(userAgent: string, metadata: any): BotCategory | null {
  const ua = userAgent.toLowerCase();
  
  // AI Training bots
  if (ua.includes('gptbot') || ua.includes('openai')) {
    return 'ai_training';
  }
  if (ua.includes('perplexitybot') || ua.includes('perplexity')) {
    return 'ai_training';
  }
  if (ua.includes('claudebot') || ua.includes('anthropic')) {
    return 'ai_training';
  }
  if (ua.includes('googleother') || ua.includes('gemini')) {
    return 'ai_training';
  }
  if (ua.includes('ccbot') || ua.includes('commoncrawl')) {
    return 'ai_training';
  }
  
  // Search crawlers
  if (ua.includes('googlebot') || ua.includes('bingbot')) {
    return 'search_crawler';
  }
  
  // Preview bots
  if (ua.includes('slack') || ua.includes('discord') || ua.includes('facebook')) {
    return 'preview_bot';
  }
  
  // SEO tools
  if (ua.includes('semrush') || ua.includes('ahrefs') || ua.includes('moz')) {
    return 'seo_tool';
  }
  
  // Uptime monitors
  if (ua.includes('uptimerobot') || ua.includes('pingdom')) {
    return 'uptime_monitor';
  }
  
  // Security scanners
  if (ua.includes('security') || ua.includes('scan')) {
    return 'security';
  }
  
  // Marketing bots
  if (ua.includes('adsbot') || ua.includes('adwords')) {
    return 'marketing';
  }
  
  // Default to other if we can't determine
  return 'other';
}

/**
 * Reclassify historic data from ai_agent_crawl to crawler
 */
export async function reclassifyHistoricData(db: any): Promise<ReclassificationResult> {
  const result: ReclassificationResult = {
    totalRecords: 0,
    updatedRecords: 0,
    errors: [],
    botCategoriesAdded: 0
  };

  try {
    console.log('🔍 Starting historic data reclassification...');
    
    // Get all records with ai_agent_crawl class
    const oldRecords = await db.prepare(`
      SELECT id, metadata, user_agent
      FROM interaction_events 
      WHERE class = 'ai_agent_crawl'
      ORDER BY occurred_at DESC
    `).all<any>();

    result.totalRecords = oldRecords.results?.length || 0;
    console.log(`📊 Found ${result.totalRecords} records to reclassify`);

    if (result.totalRecords === 0) {
      console.log('✅ No records need reclassification');
      return result;
    }

    // Process in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < result.totalRecords; i += batchSize) {
      const batch = oldRecords.results.slice(i, i + batchSize);
      
      for (const record of batch) {
        try {
          // Parse metadata to get user agent
          let userAgent = '';
          let metadata = {};
          
          try {
            metadata = JSON.parse(record.metadata || '{}');
            userAgent = metadata.user_agent || metadata.ua || '';
          } catch (e) {
            // Metadata parsing failed, continue with empty values
          }

          // Infer bot category
          const botCategory = inferBotCategory(userAgent, metadata);
          
          // Update the record
          await db.prepare(`
            UPDATE interaction_events 
            SET class = 'crawler', bot_category = ?
            WHERE id = ?
          `).bind(botCategory, record.id).run();

          result.updatedRecords++;
          if (botCategory) {
            result.botCategoriesAdded++;
          }

          if (result.updatedRecords % 100 === 0) {
            console.log(`✅ Updated ${result.updatedRecords}/${result.totalRecords} records...`);
          }

        } catch (error) {
          const errorMsg = `Failed to update record ${record.id}: ${error}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }
    }

    console.log(`✅ Reclassification complete!`);
    console.log(`   Total records: ${result.totalRecords}`);
    console.log(`   Updated: ${result.updatedRecords}`);
    console.log(`   Bot categories added: ${result.botCategoriesAdded}`);
    console.log(`   Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.slice(0, 10).forEach(error => console.log(`   ${error}`));
      if (result.errors.length > 10) {
        console.log(`   ... and ${result.errors.length - 10} more errors`);
      }
    }

  } catch (error) {
    const errorMsg = `Reclassification failed: ${error}`;
    result.errors.push(errorMsg);
    console.error(errorMsg);
  }

  return result;
}

/**
 * Verify the reclassification results
 */
export async function verifyReclassification(db: any): Promise<void> {
  console.log('\n🔍 Verifying reclassification results...');
  
  try {
    // Check class distribution
    const classDistribution = await db.prepare(`
      SELECT class, COUNT(*) as count 
      FROM interaction_events 
      GROUP BY class 
      ORDER BY count DESC
    `).all<any>();

    console.log('\n📊 Current class distribution:');
    classDistribution.results?.forEach(row => {
      console.log(`   ${row.class}: ${row.count}`);
    });

    // Check bot category distribution for crawler class
    const botCategoryDistribution = await db.prepare(`
      SELECT bot_category, COUNT(*) as count 
      FROM interaction_events 
      WHERE class = 'crawler' 
      GROUP BY bot_category 
      ORDER BY count DESC
    `).all<any>();

    console.log('\n🤖 Bot category distribution for crawler class:');
    botCategoryDistribution.results?.forEach(row => {
      const category = row.bot_category || 'null';
      console.log(`   ${category}: ${row.count}`);
    });

    // Check for any remaining ai_agent_crawl records
    const remainingOldRecords = await db.prepare(`
      SELECT COUNT(*) as count 
      FROM interaction_events 
      WHERE class = 'ai_agent_crawl'
    `).first<any>();

    if (remainingOldRecords.count > 0) {
      console.log(`\n⚠️  Warning: ${remainingOldRecords.count} records still have 'ai_agent_crawl' class`);
    } else {
      console.log('\n✅ All records have been successfully reclassified!');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 Historic Data Reclassification Script');
  console.log('=======================================');
  
  // This script is designed to be imported and run from the worker
  // For now, just export the functions
  console.log('✅ Reclassification functions exported for use in worker');
  console.log('   - reclassifyHistoricData()');
  console.log('   - verifyReclassification()');
}

if (import.meta.main) {
  main().catch(console.error);
}

export { reclassifyHistoricData, verifyReclassification };
